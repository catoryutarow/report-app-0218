"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KpiDefinition } from "@/lib/platforms/types";
import { calculateWeightedKpis, formatKpiValue } from "@/lib/kpi/calculator";
import { compareKpis, type PeriodComparison } from "@/lib/kpi/comparator";
import type { Post } from "@/lib/firebase/firestore";

type Props = {
  currentPosts: Post[];
  previousPosts: Post[];
  kpiDefs: KpiDefinition[];
  currentLabel: string;
  previousLabel: string;
};

export function KpiComparisonCard({
  currentPosts,
  previousPosts,
  kpiDefs,
  currentLabel,
  previousLabel,
}: Props) {
  const currentKpis = calculateWeightedKpis(
    kpiDefs,
    currentPosts.map((p) => p.metrics)
  );
  const previousKpis = calculateWeightedKpis(
    kpiDefs,
    previousPosts.map((p) => p.metrics)
  );

  const higherIsBetterMap: Record<string, boolean> = {};
  for (const kpi of kpiDefs) {
    higherIsBetterMap[kpi.key] = kpi.higherIsBetter ?? true;
  }

  const comparisons = compareKpis(currentKpis, previousKpis, higherIsBetterMap);

  if (comparisons.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          前期比（{currentLabel} vs {previousLabel}）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {comparisons.map((comp) => {
            const kpiDef = kpiDefs.find((k) => k.key === comp.kpiKey);
            if (!kpiDef) return null;

            return (
              <div key={comp.kpiKey} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{kpiDef.label}</p>
                  <p className="text-lg font-bold">
                    {formatKpiValue(comp.current, kpiDef.format)}
                  </p>
                </div>
                <div className="text-right">
                  {comp.change != null ? (
                    <div className="flex items-center gap-1">
                      {comp.improved === true && (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      )}
                      {comp.improved === false && (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      {comp.improved === null && (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          comp.improved === true
                            ? "text-green-600"
                            : comp.improved === false
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {comp.change > 0 ? "+" : ""}
                        {(comp.change * 100).toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    前期: {formatKpiValue(comp.previous, kpiDef.format)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
