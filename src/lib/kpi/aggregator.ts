import type { Post } from "@/lib/firebase/firestore";
import type { KpiDefinition } from "@/lib/platforms/types";
import { calculateWeightedKpis } from "./calculator";

type AggregationBucket = {
  label: string;
  posts: Post[];
  metrics: Record<string, number>[]; // extracted from posts
  totalMetrics: Record<string, number>; // summed raw metrics
  kpis: Record<string, number>; // weighted-average KPIs
  count: number;
};

/** Group posts by week (Monday start) */
export function aggregateByWeek(
  posts: Post[],
  kpiDefs: KpiDefinition[]
): AggregationBucket[] {
  const buckets = groupBy(posts, (p) => {
    const d = p.publishedAt.toDate();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return formatDate(monday) + "週";
  });
  return toBuckets(buckets, kpiDefs);
}

/** Group posts by month */
export function aggregateByMonth(
  posts: Post[],
  kpiDefs: KpiDefinition[]
): AggregationBucket[] {
  const buckets = groupBy(posts, (p) => {
    const d = p.publishedAt.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  return toBuckets(buckets, kpiDefs);
}

/** Group posts by a specific tag dimension */
export function aggregateByTag(
  posts: Post[],
  tagKey: string,
  kpiDefs: KpiDefinition[]
): AggregationBucket[] {
  const buckets = groupBy(posts, (p) => {
    const val = p.tags[tagKey as keyof typeof p.tags];
    return val || "未分類";
  });
  return toBuckets(buckets, kpiDefs);
}

// ---- Helpers ----

function groupBy(posts: Post[], keyFn: (p: Post) => string): Map<string, Post[]> {
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    const key = keyFn(post);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(post);
  }
  return map;
}

function toBuckets(
  groups: Map<string, Post[]>,
  kpiDefs: KpiDefinition[]
): AggregationBucket[] {
  const result: AggregationBucket[] = [];

  for (const [label, posts] of groups) {
    const metricsList = posts.map((p) => p.metrics);

    // Sum raw metrics
    const totalMetrics: Record<string, number> = {};
    for (const m of metricsList) {
      for (const [key, val] of Object.entries(m)) {
        totalMetrics[key] = (totalMetrics[key] ?? 0) + (val ?? 0);
      }
    }

    const kpis = calculateWeightedKpis(kpiDefs, metricsList);

    result.push({
      label,
      posts,
      metrics: metricsList,
      totalMetrics,
      kpis,
      count: posts.length,
    });
  }

  // Sort by label (chronological for dates)
  result.sort((a, b) => a.label.localeCompare(b.label));
  return result;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
