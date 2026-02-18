"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";
import { formatKpiValue } from "@/lib/kpi/calculator";
import { getThumbnailUrl } from "@/lib/platforms/utils";

type Props = {
  posts: Post[];
  config: PlatformConfig;
  limit?: number;
};

type SortOption = {
  key: string;
  label: string;
  type: "kpi" | "metric";
  format?: "percent" | "number" | "currency" | "duration";
  higherIsBetter: boolean;
};

export function TopPostsPanel({ posts, config, limit = 5 }: Props) {
  // Build sort options: KPIs first, then key raw metrics
  const sortOptions = useMemo<SortOption[]>(() => {
    const opts: SortOption[] = config.kpis.map((k) => ({
      key: k.key,
      label: k.label,
      type: "kpi" as const,
      format: k.format,
      higherIsBetter: k.higherIsBetter ?? true,
    }));

    // Add important raw metrics (required + commonly useful)
    for (const m of config.metrics) {
      if (m.required || ["shares", "comments", "subs_net", "watch_time_hours", "estimated_revenue"].includes(m.key)) {
        opts.push({
          key: m.key,
          label: m.label,
          type: "metric" as const,
          format: m.type === "currency" ? "currency" : "number",
          higherIsBetter: true,
        });
      }
    }

    return opts;
  }, [config]);

  const [selectedKey, setSelectedKey] = useState(sortOptions[0]?.key ?? "");

  const selected = sortOptions.find((o) => o.key === selectedKey) ?? sortOptions[0];
  if (!selected) return null;

  const sorted = [...posts]
    .filter((p) => {
      const val = selected.type === "kpi"
        ? p.calculatedKpis?.[selected.key]
        : p.metrics?.[selected.key];
      return val != null;
    })
    .sort((a, b) => {
      const aVal = (selected.type === "kpi" ? a.calculatedKpis?.[selected.key] : a.metrics?.[selected.key]) ?? 0;
      const bVal = (selected.type === "kpi" ? b.calculatedKpis?.[selected.key] : b.metrics?.[selected.key]) ?? 0;
      return selected.higherIsBetter ? bVal - aVal : aVal - bVal;
    })
    .slice(0, limit);

  // Get primary metric for sub-info display
  const primaryMetric = config.metrics.find((m) => m.required);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">TOP投稿</CardTitle>
        {/* Sort option buttons */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {sortOptions.map((opt) => (
            <Button
              key={opt.key}
              variant={selectedKey === opt.key ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSelectedKey(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">データなし</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((post, i) => {
              const thumb = getThumbnailUrl(config.id, post.postKey);
              const displayValue = selected.type === "kpi"
                ? post.calculatedKpis?.[selected.key]
                : post.metrics?.[selected.key];

              return (
                <div
                  key={post.id ?? i}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <span className="text-lg font-bold text-muted-foreground w-6 text-center shrink-0">
                    {i + 1}
                  </span>
                  {thumb && (
                    <a
                      href={post.permalink || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 hover:opacity-80"
                    >
                      <img
                        src={thumb}
                        alt=""
                        className="w-24 h-[54px] rounded object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {post.permalink ? (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm truncate hover:underline"
                        >
                          {post.title || post.postKey}
                        </a>
                      ) : (
                        <span className="text-sm truncate">
                          {post.title || post.postKey}
                        </span>
                      )}
                      {Object.entries(post.tags)
                        .filter(([, v]) => v)
                        .slice(0, 2)
                        .map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="text-xs">
                            {v}
                          </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {post.publishedAt?.toDate?.()?.toLocaleDateString("ja-JP") ?? "—"}
                      {post.capturedAt?.toDate?.() && post.publishedAt?.toDate?.() && (() => {
                        const diffH = Math.floor(
                          (post.capturedAt!.toDate().getTime() - post.publishedAt.toDate().getTime()) / (1000 * 60 * 60)
                        );
                        const label = diffH < 1 ? "<1h" : diffH < 48 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`;
                        return <span className="text-amber-600 ml-1">({label}後)</span>;
                      })()}
                      {primaryMetric && post.metrics[primaryMetric.key] != null && (
                        <>
                          {" "}・ {primaryMetric.label}:{" "}
                          {post.metrics[primaryMetric.key].toLocaleString("ja-JP")}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">
                      {displayValue != null
                        ? (selected.format
                          ? formatKpiValue(displayValue, selected.format)
                          : displayValue.toLocaleString("ja-JP"))
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{selected.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
