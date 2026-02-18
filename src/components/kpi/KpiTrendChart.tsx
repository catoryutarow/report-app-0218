"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KpiDefinition } from "@/lib/platforms/types";
import type { Post } from "@/lib/firebase/firestore";
import { aggregateByWeek } from "@/lib/kpi/aggregator";

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 95%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(0, 70%, 55%)",
];

type Props = {
  posts: Post[];
  kpiDefs: KpiDefinition[];
};

export function KpiTrendChart({ posts, kpiDefs }: Props) {
  if (posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI推移（週次）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            データが蓄積されるとグラフが表示されます
          </div>
        </CardContent>
      </Card>
    );
  }

  const buckets = aggregateByWeek(posts, kpiDefs);

  const data = buckets.map((b) => {
    const row: Record<string, string | number> = { week: b.label.replace("週", "") };
    for (const kpi of kpiDefs) {
      const val = b.kpis[kpi.key];
      if (val != null) {
        row[kpi.key] = kpi.format === "percent" ? Number((val * 100).toFixed(2)) : Number(val.toFixed(2));
      }
    }
    return row;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">KPI推移（週次）</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                fontSize: "12px",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => {
                const kpi = kpiDefs.find((k) => k.key === name);
                const v = value ?? 0;
                if (kpi?.format === "percent") return [`${v}%`, kpi.label];
                return [String(v), kpi?.label ?? name];
              }) as never}
            />
            <Legend
              formatter={(value: string) => {
                const kpi = kpiDefs.find((k) => k.key === value);
                return kpi?.label ?? value;
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
            {kpiDefs.map((kpi, i) => (
              <Line
                key={kpi.key}
                type="monotone"
                dataKey={kpi.key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
