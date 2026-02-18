"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Snapshot } from "@/lib/firebase/firestore";

type Props = {
  snapshots: Snapshot[];
};

const METRIC_OPTIONS = [
  { key: "views", label: "視聴回数", color: "#2563eb" },
  { key: "impressions", label: "インプレッション数", color: "#7c3aed" },
  { key: "likes", label: "高評価数", color: "#dc2626" },
  { key: "comments", label: "コメント数", color: "#059669" },
  { key: "shares", label: "共有数", color: "#d97706" },
  { key: "subs_net", label: "登録者純増", color: "#0891b2" },
  { key: "watch_time_hours", label: "総再生時間(h)", color: "#9333ea" },
  { key: "estimated_revenue", label: "推定収益", color: "#16a34a" },
];

export function SnapshotTrendChart({ snapshots }: Props) {
  const [selectedMetric, setSelectedMetric] = useState("views");

  // Sort snapshots by periodEnd (oldest first for chart)
  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => {
      const aTime = a.periodEnd?.toDate?.()?.getTime() ?? 0;
      const bTime = b.periodEnd?.toDate?.()?.getTime() ?? 0;
      return aTime - bTime;
    }),
    [snapshots]
  );

  const chartData = useMemo(() => {
    return sortedSnapshots.map((s) => ({
      label: s.label,
      value: s.totals[selectedMetric] ?? 0,
      postCount: s.postCount,
    }));
  }, [sortedSnapshots, selectedMetric]);

  // Filter to only show metrics that have data
  const availableMetrics = useMemo(() => {
    return METRIC_OPTIONS.filter((opt) =>
      snapshots.some((s) => (s.totals[opt.key] ?? 0) > 0)
    );
  }, [snapshots]);

  const metricConfig = METRIC_OPTIONS.find((m) => m.key === selectedMetric)!;

  if (snapshots.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>スナップショットが2つ以上あると推移グラフが表示されます</p>
          <p className="text-sm mt-1">毎週CSVをインポートすると、週次の推移が見られます</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">全体推移</CardTitle>
        <p className="text-xs text-muted-foreground">
          スナップショット間のチャンネル合計値の変化
        </p>
      </CardHeader>
      <CardContent>
        {/* Metric selector buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {availableMetrics.map((opt) => (
            <Button
              key={opt.key}
              variant={selectedMetric === opt.key ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSelectedMetric(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => v.toLocaleString("ja-JP")}
            />
            <Tooltip
              formatter={((value: number) => [
                value.toLocaleString("ja-JP"),
                metricConfig.label,
              ]) as never}
              labelFormatter={((label: string) => label) as never}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={metricConfig.color}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
