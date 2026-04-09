"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Snapshot } from "@/lib/firebase/firestore";
import type { Post } from "@/lib/firebase/firestore";
import type { KpiDefinition, PlatformConfig } from "@/lib/platforms/types";
import { calculateWeightedKpis, formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  currentSnapshot: Snapshot;
  currentPosts: Post[];
  compareSnapshot: Snapshot;
  comparePosts: Post[];
  kpiDefs: KpiDefinition[];
  config: PlatformConfig;
};

function getMetricTotals(snapshot: Snapshot): Record<string, number> {
  return snapshot.totals;
}

function resolveKpis(
  kpiDefs: KpiDefinition[],
  posts: Post[]
): Record<string, number> {
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
  const currentKpis = resolveKpis(kpiDefs, currentPosts);
  const compareKpis = resolveKpis(kpiDefs, comparePosts);

  const curTotals = getMetricTotals(currentSnapshot);
  const prevTotals = getMetricTotals(compareSnapshot);

  // Build metric rows from platform config (required metrics first, then important optional ones)
  const displayMetrics = config.metrics.filter(
    (m) => m.required || curTotals[m.key] != null || prevTotals[m.key] != null
  );

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
                  </th>
                  <th className="text-right px-3 py-2 font-medium">
                    {currentSnapshot.label}
                  </th>
                  <th className="text-right px-3 py-2 font-medium">差分</th>
                  <th className="text-right px-3 py-2 font-medium">変化率</th>
                </tr>
              </thead>
              <tbody>
                {displayMetrics
                  .filter((m) => curTotals[m.key] != null || prevTotals[m.key] != null)
                  .map((m) => {
                    const curVal = curTotals[m.key] ?? 0;
                    const prevVal = prevTotals[m.key] ?? 0;
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
