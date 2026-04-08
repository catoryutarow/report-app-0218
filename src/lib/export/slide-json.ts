import type { Account, Post, Snapshot } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";
import {
  calculateWeightedKpis,
  formatKpiValue,
  percentChange,
} from "@/lib/kpi/calculator";
import { compareKpis } from "@/lib/kpi/comparator";

// ---- SNS Report JSON types (domain-specific, consumed by GAS) ----

type KpiEntry = {
  label: string;
  value: string;
  target: string;
  change: string;
  status: "good" | "bad" | "neutral";
};

type MetricEntry = {
  label: string;
  total: string;
  average: string;
};

type ComparisonItem = {
  label: string;
  previous: string;
  current: string;
  change: string;
  trend: "up" | "down" | "flat";
};

type TopPostMetric = {
  label: string;
  value: string;
};

type TopPostEntry = {
  rank: number;
  title: string;
  sortKpiLabel: string;
  sortKpiValue: string;
  metrics: TopPostMetric[];
};

export type SnsReportJson = {
  version: string;
  generatedAt: string;
  account: {
    name: string;
    platform: string;
    platformLabel: string;
    handle: string;
  };
  period: {
    label: string;
    start: string;
    end: string;
    postCount: number;
  };
  kpis: KpiEntry[];
  metrics: MetricEntry[];
  comparison: {
    previousLabel: string;
    items: ComparisonItem[];
  } | null;
  topPosts: TopPostEntry[];
};

// ---- Builder ----

type BuildSlideJsonInput = {
  account: Account;
  config: PlatformConfig;
  targets: Record<string, number>;
  currentSnapshot: Snapshot;
  currentPosts: Post[];
  compareSnapshot?: Snapshot | null;
  comparePosts?: Post[] | null;
};

export function buildSlideJson({
  account,
  config,
  targets,
  currentSnapshot,
  currentPosts,
  compareSnapshot,
  comparePosts,
}: BuildSlideJsonInput): SnsReportJson {
  const postCount = currentPosts.length;

  // Precompute KPIs
  const currentMetricsList = currentPosts.map((p) => p.metrics);
  const currentWeightedKpis = calculateWeightedKpis(config.kpis, currentMetricsList);

  const hasCompare = compareSnapshot && comparePosts && comparePosts.length > 0;
  const prevWeightedKpis = hasCompare
    ? calculateWeightedKpis(config.kpis, comparePosts.map((p) => p.metrics))
    : null;

  const higherIsBetterMap: Record<string, boolean> = {};
  for (const kpi of config.kpis) {
    higherIsBetterMap[kpi.key] = kpi.higherIsBetter ?? true;
  }

  // ---- KPIs ----
  const kpis: KpiEntry[] = config.kpis.map((kpi) => {
    const value = currentWeightedKpis[kpi.key];
    const formatted = formatKpiValue(value, kpi.format);

    let change = "";
    let status: KpiEntry["status"] = "neutral";

    if (prevWeightedKpis) {
      const prev = prevWeightedKpis[kpi.key];
      const pct = prev != null && value != null ? percentChange(value, prev) : null;
      if (pct != null) {
        const sign = pct > 0 ? "+" : "";
        change = `${sign}${(pct * 100).toFixed(1)}%`;
        const higherIsBetter = higherIsBetterMap[kpi.key];
        status = (higherIsBetter ? pct > 0 : pct < 0) ? "good" : "bad";
      }
    }

    // Override status with target comparison if target exists
    const target = targets[kpi.key];
    if (target != null && value != null) {
      const higherIsBetter = higherIsBetterMap[kpi.key];
      status = (higherIsBetter ? value >= target : value <= target) ? "good" : "bad";
    }

    return {
      label: kpi.label,
      value: formatted,
      target: target != null ? formatKpiValue(target, kpi.format) : "",
      change,
      status,
    };
  });

  // ---- Metrics ----
  const metrics: MetricEntry[] = config.metrics
    .filter((m) => currentSnapshot.totals[m.key] != null)
    .map((m) => {
      const total = currentSnapshot.totals[m.key];
      const avg = postCount > 0 ? Math.round(total / postCount) : 0;
      return {
        label: m.label,
        total: formatNumber(total),
        average: formatNumber(avg),
      };
    });

  // ---- Comparison ----
  let comparison: SnsReportJson["comparison"] = null;

  if (hasCompare && prevWeightedKpis) {
    const compItems: ComparisonItem[] = [];

    // Metric totals comparison
    for (const m of config.metrics) {
      const cur = currentSnapshot.totals[m.key];
      const prev = compareSnapshot!.totals[m.key];
      if (cur == null && prev == null) continue;
      const pct = cur != null && prev != null ? percentChange(cur, prev) : null;
      const trend: ComparisonItem["trend"] =
        pct == null ? "flat" : pct > 0 ? "up" : pct < 0 ? "down" : "flat";
      const changeStr = pct != null ? `${pct > 0 ? "+" : ""}${(pct * 100).toFixed(1)}%` : "—";
      compItems.push({
        label: m.label,
        previous: formatNumber(prev ?? 0),
        current: formatNumber(cur ?? 0),
        change: changeStr,
        trend,
      });
    }

    // KPI comparisons
    const kpiComparisons = compareKpis(currentWeightedKpis, prevWeightedKpis, higherIsBetterMap);
    for (const c of kpiComparisons) {
      const kpiDef = config.kpis.find((k) => k.key === c.kpiKey);
      if (!kpiDef) continue;
      const trend: ComparisonItem["trend"] =
        c.change == null ? "flat" : c.change > 0 ? "up" : c.change < 0 ? "down" : "flat";
      const changeStr =
        c.change != null ? `${c.change > 0 ? "+" : ""}${(c.change * 100).toFixed(1)}%` : "—";
      compItems.push({
        label: kpiDef.label,
        previous: formatKpiValue(c.previous, kpiDef.format),
        current: formatKpiValue(c.current, kpiDef.format),
        change: changeStr,
        trend,
      });
    }

    comparison = {
      previousLabel: compareSnapshot!.label,
      items: compItems,
    };
  }

  // ---- Top Posts ----
  const topPosts: TopPostEntry[] = [];

  if (postCount > 0) {
    const sortKpi = config.kpis[0];
    const displayMetrics = config.metrics.slice(0, 2);

    const sorted = [...currentPosts].sort((a, b) => {
      const va = a.calculatedKpis?.[sortKpi.key] ?? -Infinity;
      const vb = b.calculatedKpis?.[sortKpi.key] ?? -Infinity;
      return vb - va;
    });

    const topN = sorted.slice(0, 5);
    for (let i = 0; i < topN.length; i++) {
      const p = topN[i];
      topPosts.push({
        rank: i + 1,
        title: truncate(p.title ?? p.postKey, 20),
        sortKpiLabel: sortKpi.label,
        sortKpiValue: formatKpiValue(p.calculatedKpis?.[sortKpi.key], sortKpi.format),
        metrics: displayMetrics.map((m) => ({
          label: m.label,
          value: formatNumber(p.metrics[m.key] ?? 0),
        })),
      });
    }
  }

  // ---- Period dates ----
  const periodStart = currentSnapshot.periodStart.toDate();
  const periodEnd = currentSnapshot.periodEnd.toDate();

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    account: {
      name: account.name,
      platform: account.platform,
      platformLabel: config.label,
      handle: account.handle ? `@${account.handle}` : "",
    },
    period: {
      label: currentSnapshot.label,
      start: formatDate(periodStart),
      end: formatDate(periodEnd),
      postCount,
    },
    kpis,
    metrics,
    comparison,
    topPosts,
  };
}

// ---- Helpers ----

function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}
