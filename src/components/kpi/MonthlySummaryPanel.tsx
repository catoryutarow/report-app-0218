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
import type { MonthlySummary } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";

type Props = {
  summaries: MonthlySummary[];
  config: PlatformConfig;
};

export function MonthlySummaryPanel({ summaries, config }: Props) {
  const [selectedMetric, setSelectedMetric] = useState("reach");

  const availableMetrics = useMemo(() => {
    const metricsWithData = new Set<string>();
    for (const s of summaries) {
      for (const [key, val] of Object.entries(s.metrics)) {
        if (val != null && val !== 0) metricsWithData.add(key);
      }
    }
    return config.metrics.filter((m) => metricsWithData.has(m.key));
  }, [summaries, config.metrics]);

  const sortedSummaries = useMemo(
    () =>
      [...summaries].sort((a, b) => {
        const aTime = a.periodEnd?.toDate?.()?.getTime() ?? 0;
        const bTime = b.periodEnd?.toDate?.()?.getTime() ?? 0;
        return aTime - bTime;
      }),
    [summaries]
  );

  const chartData = useMemo(
    () =>
      sortedSummaries.map((s) => ({
        label: s.label,
        value: s.metrics[selectedMetric] ?? 0,
      })),
    [sortedSummaries, selectedMetric]
  );

  const current = summaries[0] ?? null;
  const previous = summaries[1] ?? null;

  if (summaries.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
        <p className="text-lg mb-2">月次サマリーがありません</p>
        <p className="text-sm">「月サマリー取得」ボタンでInstagram APIから取得してください</p>
      </div>
    );
  }

  const selectedLabel =
    availableMetrics.find((m) => m.key === selectedMetric)?.label ?? selectedMetric;
  const selectedColor = "#2563eb";

  return (
    <div className="space-y-6">
      {current && previous && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">月次比較</CardTitle>
            <p className="text-xs text-muted-foreground">
              {previous.label} → {current.label}
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">指標</th>
                    <th className="text-right px-3 py-2 font-medium">{previous.label}</th>
                    <th className="text-right px-3 py-2 font-medium">{current.label}</th>
                    <th className="text-right px-3 py-2 font-medium">差分</th>
                    <th className="text-right px-3 py-2 font-medium">変化率</th>
                  </tr>
                </thead>
                <tbody>
                  {availableMetrics.map((m) => {
                    const curVal = current.metrics[m.key] ?? 0;
                    const prevVal = previous.metrics[m.key] ?? 0;
                    const diff = curVal - prevVal;
                    const pctChange =
                      prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : null;
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
                        <td
                          className={`px-3 py-1.5 text-right ${isPositive ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}
                        >
                          {isPositive ? "+" : ""}
                          {diff.toLocaleString("ja-JP")}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right ${isPositive ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}
                        >
                          {pctChange != null
                            ? `${isPositive ? "+" : ""}${pctChange.toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedSummaries.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">月次推移</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 mb-4">
              {availableMetrics.map((m) => (
                <Button
                  key={m.key}
                  size="sm"
                  variant={selectedMetric === m.key ? "default" : "outline"}
                  onClick={() => setSelectedMetric(m.key)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [
                    Number(value).toLocaleString("ja-JP"),
                    selectedLabel,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={selectedColor}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">全サマリー</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">期間</th>
                  {availableMetrics.map((m) => (
                    <th key={m.key} className="text-right px-3 py-2 font-medium">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{s.label}</td>
                    {availableMetrics.map((m) => (
                      <td key={m.key} className="px-3 py-1.5 text-right">
                        {(s.metrics[m.key] ?? 0).toLocaleString("ja-JP")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
