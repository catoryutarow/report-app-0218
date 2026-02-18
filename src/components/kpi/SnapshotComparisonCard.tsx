"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Snapshot } from "@/lib/firebase/firestore";
import type { Post } from "@/lib/firebase/firestore";
import type { KpiDefinition, PlatformConfig } from "@/lib/platforms/types";
import { calculatePostKpis, calculateWeightedKpis, formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  currentSnapshot: Snapshot;
  currentPosts: Post[];
  compareSnapshot: Snapshot;
  comparePosts: Post[];
  kpiDefs: KpiDefinition[];
  config: PlatformConfig;
};

/**
 * Get metric totals for comparison.
 * Uses channelSummary when available (channel-level overview perspective),
 * otherwise uses post-derived totals (initial-performance perspective).
 * Both are valid — the key is comparing like-with-like across snapshots.
 */
function getMetricTotals(snapshot: Snapshot): { totals: Record<string, number>; isChannelLevel: boolean } {
  const cs = snapshot.channelSummary;
  if (cs && Object.keys(cs).length > 0) return { totals: cs, isChannelLevel: true };
  return { totals: snapshot.totals, isChannelLevel: false };
}

/** Calculate KPIs matching the metric source of getMetricTotals */
function resolveKpis(
  kpiDefs: KpiDefinition[],
  snapshot: Snapshot,
  posts: Post[]
): Record<string, number> {
  const cs = snapshot.channelSummary;
  if (cs && Object.keys(cs).length > 0) {
    return calculatePostKpis(kpiDefs, cs);
  }
  return calculateWeightedKpis(kpiDefs, posts.map((p) => p.metrics));
}

export function SnapshotComparisonCard({
  currentSnapshot,
  currentPosts,
  compareSnapshot,
  comparePosts,
  kpiDefs,
  config,
}: Props) {
  const currentKpis = resolveKpis(kpiDefs, currentSnapshot, currentPosts);
  const compareKpis = resolveKpis(kpiDefs, compareSnapshot, comparePosts);

  const curData = getMetricTotals(currentSnapshot);
  const prevData = getMetricTotals(compareSnapshot);

  // Build metric rows from platform config (required metrics first, then important optional ones)
  const displayMetrics = config.metrics.filter(
    (m) => m.required || curData.totals[m.key] != null || prevData.totals[m.key] != null
  );

  // Source label for each snapshot column
  const curSourceLabel = curData.isChannelLevel ? "CH全体" : "初動";
  const prevSourceLabel = prevData.isChannelLevel ? "CH全体" : "初動";
  // When sources differ, warn the user
  const sourcesMixed = curData.isChannelLevel !== prevData.isChannelLevel;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            スナップショット比較
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {compareSnapshot.label} → {currentSnapshot.label}
          </p>
          {sourcesMixed && (
            <p className="text-[10px] text-amber-600 mt-1">
              ※ データソースが異なります（{prevSourceLabel} vs {curSourceLabel}）。同じ種類同士の比較を推奨します。
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* Raw metric totals comparison */}
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">指標</th>
                  <th className="text-right px-3 py-2 font-medium">
                    {compareSnapshot.label}
                    <Badge variant="outline" className="ml-1 text-[10px] py-0">{prevSourceLabel}</Badge>
                  </th>
                  <th className="text-right px-3 py-2 font-medium">
                    {currentSnapshot.label}
                    <Badge variant="outline" className="ml-1 text-[10px] py-0">{curSourceLabel}</Badge>
                  </th>
                  <th className="text-right px-3 py-2 font-medium">差分</th>
                  <th className="text-right px-3 py-2 font-medium">変化率</th>
                </tr>
              </thead>
              <tbody>
                {displayMetrics
                  .filter((m) => curData.totals[m.key] != null || prevData.totals[m.key] != null)
                  .map((m) => {
                    const curVal = curData.totals[m.key] ?? 0;
                    const prevVal = prevData.totals[m.key] ?? 0;
                    const diff = curVal - prevVal;
                    const pctChange = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : null;
                    const isPositive = diff > 0;

                    return (
                      <tr key={m.key} className="border-t">
                        <td className="px-3 py-1.5">{m.label}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {prevVal.toLocaleString("ja-JP")}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium">
                          {curVal.toLocaleString("ja-JP")}
                        </td>
                        <td className={`px-3 py-1.5 text-right ${isPositive ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}>
                          {isPositive ? "+" : ""}{diff.toLocaleString("ja-JP")}
                        </td>
                        <td className={`px-3 py-1.5 text-right ${isPositive ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}>
                          {pctChange != null ? `${isPositive ? "+" : ""}${pctChange.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* KPI comparison */}
          <p className="text-xs text-muted-foreground font-medium mb-2">
            KPI
            {curData.isChannelLevel ? "（チャンネル全体）" : "（初動集計）"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpiDefs.map((kpi) => {
              const curKpi = currentKpis[kpi.key];
              const prevKpi = compareKpis[kpi.key];
              const diff = curKpi != null && prevKpi != null ? curKpi - prevKpi : null;
              const higherIsBetter = kpi.higherIsBetter ?? true;
              const isGood = diff != null ? (higherIsBetter ? diff > 0 : diff < 0) : null;

              return (
                <div key={kpi.key} className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-semibold">
                      {curKpi != null ? formatKpiValue(curKpi, kpi.format) : "—"}
                    </span>
                    {diff != null && (
                      <span className={`text-sm ${isGood ? "text-green-600" : "text-red-600"}`}>
                        {isGood ? "↑" : "↓"}{" "}
                        {formatKpiValue(Math.abs(diff), kpi.format)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    前回: {prevKpi != null ? formatKpiValue(prevKpi, kpi.format) : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
