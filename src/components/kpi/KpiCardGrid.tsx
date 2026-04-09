"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Post } from "@/lib/firebase/firestore";
import type { KpiDefinition } from "@/lib/platforms/types";
import { calculateWeightedKpis, formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  posts: Post[];
  kpiDefs: KpiDefinition[];
  targets: Record<string, number>;
};

export function KpiCardGrid({ posts, kpiDefs, targets }: Props) {
  if (posts.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {kpiDefs.map((kpi) => (
          <Card key={kpi.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-1">データなし</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const postKpis = calculateWeightedKpis(kpiDefs, posts.map((p) => p.metrics));

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {kpiDefs.map((kpi) => {
        const postValue = postKpis[kpi.key];
        const target = targets[kpi.key];
        const higherIsBetter = kpi.higherIsBetter ?? true;

        let status: "good" | "bad" | "neutral" = "neutral";
        if (postValue != null && target != null) {
          if (higherIsBetter) {
            status = postValue >= target ? "good" : "bad";
          } else {
            status = postValue <= target ? "good" : "bad";
          }
        }

        return (
          <Card key={kpi.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">
                  {formatKpiValue(postValue, kpi.format)}
                </p>
                {status === "good" && (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
                {status === "bad" && (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                {status === "neutral" && (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {target != null && (
                  <>目標: {formatKpiValue(target, kpi.format)} ・ </>
                )}
                初動集計({posts.length}件)
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
