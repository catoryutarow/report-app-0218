import type { MetricDefinition } from "@/lib/platforms/types";

export type ColumnMapping = {
  csvColumn: string;
  metricKey: string | null; // null = unmapped
  confidence: "exact" | "fuzzy" | "manual";
};

/**
 * Auto-match CSV column headers to platform metric definitions.
 * Tries exact match first, then case-insensitive fuzzy match via csvAliases.
 */
export function autoMapColumns(
  csvHeaders: string[],
  metrics: MetricDefinition[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedMetrics = new Set<string>();

  for (const header of csvHeaders) {
    const trimmed = header.trim();
    let matched: { key: string; confidence: "exact" | "fuzzy" } | null = null;

    // Try exact match against csvAliases
    for (const metric of metrics) {
      if (usedMetrics.has(metric.key)) continue;
      if (metric.csvAliases.includes(trimmed)) {
        matched = { key: metric.key, confidence: "exact" };
        break;
      }
    }

    // Try case-insensitive fuzzy match
    if (!matched) {
      const lower = trimmed.toLowerCase();
      for (const metric of metrics) {
        if (usedMetrics.has(metric.key)) continue;
        const lowerAliases = metric.csvAliases.map((a) => a.toLowerCase());
        if (lowerAliases.includes(lower)) {
          matched = { key: metric.key, confidence: "fuzzy" };
          break;
        }
        // Also check if the header contains the metric key
        if (lower.includes(metric.key.toLowerCase()) || metric.key.toLowerCase().includes(lower)) {
          matched = { key: metric.key, confidence: "fuzzy" };
          break;
        }
      }
    }

    if (matched) {
      usedMetrics.add(matched.key);
      mappings.push({
        csvColumn: trimmed,
        metricKey: matched.key,
        confidence: matched.confidence,
      });
    } else {
      mappings.push({ csvColumn: trimmed, metricKey: null, confidence: "manual" });
    }
  }

  return mappings;
}

/**
 * Special columns that are not metrics but need mapping.
 */
export const SPECIAL_COLUMNS = {
  postKey: {
    label: "投稿ID",
    aliases: [
      "post_key", "post_id", "video_id", "reel_id", "投稿ID", "ID", "Post ID",
      "コンテンツ",  // YouTube Studio CSV
    ],
  },
  title: {
    label: "タイトル",
    aliases: [
      "title", "タイトル", "動画のタイトル",  // YouTube Studio CSV
      "投稿タイトル", "Title",
    ],
  },
  publishedAt: {
    label: "投稿日時",
    aliases: [
      "published_at", "posted_at", "post_date", "date", "日時", "投稿日時",
      "投稿日", "公開日", "PUBLISH_DATETIME",
      "動画公開時刻",  // YouTube Studio CSV (format: "Feb 13, 2026")
    ],
  },
  permalink: {
    label: "投稿URL",
    aliases: ["permalink", "url", "video_url", "投稿URL", "URL", "リンク"],
  },
} as const;

/**
 * Find the best match for a special column from CSV headers.
 */
export function findSpecialColumn(
  csvHeaders: string[],
  specialKey: keyof typeof SPECIAL_COLUMNS
): string | null {
  const spec = SPECIAL_COLUMNS[specialKey];
  for (const header of csvHeaders) {
    const trimmed = header.trim();
    if (spec.aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      return trimmed;
    }
  }
  return null;
}
