import type { Post, Snapshot } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";
import {
  calculatePostKpis,
  calculateWeightedKpis,
  formatKpiValue,
} from "@/lib/kpi/calculator";

type ExportData = {
  snapshot: Snapshot;
  posts: Post[];
  config: PlatformConfig;
  targets: Record<string, number>;
};

// ---- JSON ----

export function buildJsonExport({
  snapshot,
  posts,
  config,
  targets,
}: ExportData): object {
  const postMetricsList = posts.map((p) => p.metrics);
  const weightedKpis = calculateWeightedKpis(config.kpis, postMetricsList);

  const channelKpis =
    snapshot.channelSummary && Object.keys(snapshot.channelSummary).length > 0
      ? calculatePostKpis(config.kpis, snapshot.channelSummary)
      : null;

  return {
    exportedAt: new Date().toISOString(),
    platform: config.id,
    platformLabel: config.label,
    snapshot: {
      label: snapshot.label,
      periodStart: snapshot.periodStart?.toDate?.()?.toISOString() ?? null,
      periodEnd: snapshot.periodEnd?.toDate?.()?.toISOString() ?? null,
      postCount: posts.length,
      totals: snapshot.totals,
      ...(snapshot.channelSummary
        ? { channelSummary: snapshot.channelSummary }
        : {}),
    },
    summary: {
      weightedKpis: Object.fromEntries(
        config.kpis.map((kpi) => [
          kpi.key,
          {
            label: kpi.label,
            value: weightedKpis[kpi.key] ?? null,
            formatted: formatKpiValue(weightedKpis[kpi.key], kpi.format),
            target: targets[kpi.key] ?? null,
          },
        ])
      ),
      ...(channelKpis
        ? {
            channelKpis: Object.fromEntries(
              config.kpis.map((kpi) => [
                kpi.key,
                {
                  label: kpi.label,
                  value: channelKpis[kpi.key] ?? null,
                  formatted: formatKpiValue(channelKpis[kpi.key], kpi.format),
                },
              ])
            ),
          }
        : {}),
    },
    posts: posts.map((p) => ({
      postKey: p.postKey,
      title: p.title ?? "",
      publishedAt: p.publishedAt?.toDate?.()?.toISOString() ?? null,
      permalink: p.permalink ?? "",
      source: p.source,
      tags: p.tags,
      metrics: p.metrics,
      kpis: p.calculatedKpis,
    })),
  };
}

// ---- CSV ----

export function buildCsvExport({
  snapshot,
  posts,
  config,
  targets,
}: ExportData): string {
  const metricDefs = config.metrics;
  const kpiDefs = config.kpis;

  // Header
  const headers = [
    "投稿",
    "タイトル",
    "投稿日",
    "URL",
    "入力元",
    ...config.tagDimensions.map((d) => d.label),
    ...metricDefs.map((m) => m.label),
    ...kpiDefs.map((k) => k.label),
  ];

  const rows: string[][] = [];

  // Post rows
  for (const p of posts) {
    const row: string[] = [
      p.postKey,
      p.title ?? "",
      p.publishedAt?.toDate?.()?.toLocaleDateString("ja-JP") ?? "",
      p.permalink ?? "",
      p.source,
      ...config.tagDimensions.map(
        (d) => (p.tags as Record<string, string>)[d.key] ?? ""
      ),
      ...metricDefs.map((m) =>
        p.metrics[m.key] != null ? String(p.metrics[m.key]) : ""
      ),
      ...kpiDefs.map((k) =>
        p.calculatedKpis?.[k.key] != null
          ? formatKpiValue(p.calculatedKpis[k.key], k.format)
          : ""
      ),
    ];
    rows.push(row);
  }

  // Summary row
  const postMetricsList = posts.map((p) => p.metrics);
  const weightedKpis = calculateWeightedKpis(kpiDefs, postMetricsList);

  const summaryRow: string[] = [
    `【集計】${snapshot.label}`,
    `${posts.length}件`,
    "",
    "",
    "",
    ...config.tagDimensions.map(() => ""),
    ...metricDefs.map((m) =>
      snapshot.totals[m.key] != null ? String(snapshot.totals[m.key]) : ""
    ),
    ...kpiDefs.map((k) => formatKpiValue(weightedKpis[k.key], k.format)),
  ];
  rows.push(summaryRow);

  // Target row
  if (Object.keys(targets).length > 0) {
    const targetRow: string[] = [
      "【目標】",
      "",
      "",
      "",
      "",
      ...config.tagDimensions.map(() => ""),
      ...metricDefs.map(() => ""),
      ...kpiDefs.map((k) =>
        targets[k.key] != null ? formatKpiValue(targets[k.key], k.format) : ""
      ),
    ];
    rows.push(targetRow);
  }

  // Build CSV string with BOM for Excel compatibility
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];

  return "\uFEFF" + lines.join("\n");
}

// ---- Download helpers ----

export function downloadJson(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, filename);
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
