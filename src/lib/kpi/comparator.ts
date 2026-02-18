import { percentChange } from "./calculator";

export type PeriodComparison = {
  kpiKey: string;
  current: number;
  previous: number;
  change: number | null; // percent change
  improved: boolean | null; // null if not computable
};

/**
 * Compare two sets of KPI values and return changes.
 * @param higherIsBetterMap - Map of kpiKey -> boolean (true if higher values are better)
 */
export function compareKpis(
  current: Record<string, number>,
  previous: Record<string, number>,
  higherIsBetterMap: Record<string, boolean>
): PeriodComparison[] {
  const results: PeriodComparison[] = [];

  for (const kpiKey of Object.keys(current)) {
    const cur = current[kpiKey];
    const prev = previous[kpiKey];
    if (cur == null) continue;

    const change = prev != null ? percentChange(cur, prev) : null;
    const higherIsBetter = higherIsBetterMap[kpiKey] ?? true;

    let improved: boolean | null = null;
    if (change != null) {
      improved = higherIsBetter ? change > 0 : change < 0;
    }

    results.push({
      kpiKey,
      current: cur,
      previous: prev ?? 0,
      change,
      improved,
    });
  }

  return results;
}
