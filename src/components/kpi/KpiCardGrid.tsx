"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Post, Snapshot } from "@/lib/firebase/firestore";
import type { KpiDefinition } from "@/lib/platforms/types";
import { calculatePostKpis, calculateWeightedKpis, formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  posts: Post[];
  kpiDefs: KpiDefinition[];
  targets: Record<string, number>;
  snapshot?: Snapshot | null;
};

export function KpiCardGrid({ posts, kpiDefs, targets, snapshot }: Props) {
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

  // Two independent perspectives — both always computed when data exists
  const postKpis = calculateWeightedKpis(kpiDefs, posts.map((p) => p.metrics));

  const hasChannelSummary =
    snapshot?.channelSummary && Object.keys(snapshot.channelSummary).length > 0;
  const channelKpis = hasChannelSummary
    ? calculatePostKpis(kpiDefs, snapshot!.channelSummary!)
    : null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {kpiDefs.map((kpi) => {
        const postValue = postKpis[kpi.key];
        const channelValue = channelKpis?.[kpi.key];
        const target = targets[kpi.key];
        const higherIsBetter = kpi.higherIsBetter ?? true;

        // Target comparison uses channelValue if available, else postValue
        const primaryValue = channelValue ?? postValue;
        let status: "good" | "bad" | "neutral" = "neutral";
        if (primaryValue != null && target != null) {
          if (higherIsBetter) {
            status = primaryValue >= target ? "good" : "bad";
          } else {
            status = primaryValue <= target ? "good" : "bad";
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
              {hasChannelSummary ? (
                <>
                  {/* Both perspectives shown side by side */}
                  <div className="flex items-baseline gap-3">
                    <div>
                      <p className="text-2xl font-bold">
                        {channelValue != null ? formatKpiValue(channelValue, kpi.format) : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">チャンネル全体</p>
                    </div>
                    <div className="border-l pl-3">
                      <p className="text-lg font-semibold text-muted-foreground">
                        {postValue != null ? formatKpiValue(postValue, kpi.format) : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">初動({posts.length}件)</p>
                    </div>
                    {status === "good" && (
                      <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                    {status === "bad" && (
                      <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                  </div>
                  {target != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      目標: {formatKpiValue(target, kpi.format)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* Single perspective: post-level aggregation only */}
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
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
