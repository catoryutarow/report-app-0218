import type { KpiDefinition } from "@/lib/platforms/types";

/**
 * Calculate all KPIs for a single post's metrics.
 * Returns a map of kpiKey -> value.
 */
export function calculatePostKpis(
  kpiDefs: KpiDefinition[],
  metrics: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const kpi of kpiDefs) {
    const value = kpi.calculate(metrics);
    if (value != null && isFinite(value)) {
      result[kpi.key] = value;
    }
  }
  return result;
}

/**
 * Calculate weighted-average KPIs across multiple posts.
 *
 * CRITICAL: This uses sum(numerator) / sum(denominator), NOT average of per-post rates.
 * Example: ER = sum(all engagement) / sum(all reach)
 *
 * This prevents small-reach posts from disproportionately affecting the aggregate.
 */
export function calculateWeightedKpis(
  kpiDefs: KpiDefinition[],
  postMetricsList: Record<string, number>[]
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const kpi of kpiDefs) {
    if (!kpi.weightedParts) continue;

    let totalNumerator = 0;
    let totalDenominator = 0;

    for (const metrics of postMetricsList) {
      const parts = kpi.weightedParts(metrics);
      if (parts) {
        totalNumerator += parts.numerator;
        totalDenominator += parts.denominator;
      }
    }

    if (totalDenominator > 0) {
      result[kpi.key] = totalNumerator / totalDenominator;
    }
  }

  return result;
}

/** Format a KPI value for display */
export function formatKpiValue(
  value: number | null | undefined,
  format: KpiDefinition["format"]
): string {
  if (value == null || !isFinite(value)) return "—";

  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(2)}%`;
    case "currency":
      return `¥${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}`;
    case "duration":
      return `${value.toFixed(1)}秒`;
    case "number":
      return value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
    default:
      return String(value);
  }
}

/** Calculate percent change between two values */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 1 : null;
  return (current - previous) / Math.abs(previous);
}
