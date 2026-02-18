/** Raw metric definition for a single SNS platform */
export type MetricDefinition = {
  key: string;
  label: string; // Japanese display name (e.g. "リーチ")
  type: "integer" | "float" | "duration_sec" | "currency";
  required: boolean;
  csvAliases: string[]; // Japanese/English CSV column name variants
  description?: string;
};

/** KPI derived from raw metrics via a formula */
export type KpiDefinition = {
  key: string;
  label: string; // Japanese display name (e.g. "保存率")
  format: "percent" | "number" | "currency" | "duration";
  /** Calculate KPI from a single post's metrics */
  calculate: (metrics: Record<string, number>) => number | null;
  /**
   * Weighted average aggregation across multiple posts.
   * Returns { numerator, denominator } so caller can do sum(num)/sum(den).
   * If null, this KPI is not aggregatable (e.g. it's per-post only).
   */
  weightedParts: (metrics: Record<string, number>) => {
    numerator: number;
    denominator: number;
  } | null;
  /** Higher is better? Used for trend arrows. Default: true */
  higherIsBetter?: boolean;
  description?: string;
};

/** Tag dimension for classifying posts */
export type TagDimension = {
  key: string;
  label: string;
  examples: string[];
};

/** Full platform configuration */
export type PlatformConfig = {
  id: string;
  label: string;
  icon: string; // emoji or lucide icon name
  metrics: MetricDefinition[];
  kpis: KpiDefinition[];
  tagDimensions: TagDimension[];
  defaultTargets: Record<string, number>;
};
