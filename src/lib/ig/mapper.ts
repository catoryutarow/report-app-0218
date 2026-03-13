/**
 * Maps Instagram Graph API responses to PlatformConfig metric keys.
 *
 * Two data sources per media:
 * - Media fields: like_count, comments_count (from GET /{media-id}?fields=...)
 * - Insights: reach, impressions, saved, shares, plays, etc. (from GET /{media-id}/insights)
 */

/** Determine platform ID from IG API media_type and media_product_type */
export function toPlatformId(
  mediaType: string,
  mediaProductType: string
): "ig_feed" | "ig_reel" {
  if (mediaProductType === "REELS") return "ig_reel";
  return "ig_feed"; // IMAGE, CAROUSEL_ALBUM, non-REELS VIDEO
}

type IgMediaFields = {
  like_count?: number;
  comments_count?: number;
};

type IgInsightValue = {
  name: string;
  values: Array<{ value: number }>;
};

/**
 * Map IG API data to PlatformConfig metric keys for ig_feed.
 */
export function mapFeedMetrics(
  fields: IgMediaFields,
  insights: IgInsightValue[]
): Record<string, number> {
  const insightMap = new Map(
    insights.map((i) => [i.name, i.values[0]?.value ?? 0])
  );

  const metrics: Record<string, number> = {};

  if (insightMap.has("reach")) metrics.reach = insightMap.get("reach")!;
  if (insightMap.has("impressions")) metrics.impressions = insightMap.get("impressions")!;
  if (insightMap.has("saved")) metrics.saves = insightMap.get("saved")!;
  if (insightMap.has("shares")) metrics.shares = insightMap.get("shares")!;

  if (fields.like_count != null) metrics.likes = fields.like_count;
  if (fields.comments_count != null) metrics.comments = fields.comments_count;

  return metrics;
}

/**
 * Map IG API data to PlatformConfig metric keys for ig_reel.
 *
 * Note: total_watch_time_ms and duration_sec are NOT available from IG API.
 */
export function mapReelMetrics(
  fields: IgMediaFields,
  insights: IgInsightValue[]
): Record<string, number> {
  const insightMap = new Map(
    insights.map((i) => [i.name, i.values[0]?.value ?? 0])
  );

  const metrics: Record<string, number> = {};

  // plays: try new metric name first, then legacy
  const playsKey = insightMap.has("ig_reels_aggregated_all_plays_count")
    ? "ig_reels_aggregated_all_plays_count"
    : "plays";
  if (insightMap.has(playsKey)) metrics.plays = insightMap.get(playsKey)!;
  if (insightMap.has("reach")) metrics.reach = insightMap.get("reach")!;
  if (insightMap.has("saved")) metrics.saves = insightMap.get("saved")!;
  if (insightMap.has("shares")) metrics.shares = insightMap.get("shares")!;

  if (fields.like_count != null) metrics.likes = fields.like_count;
  if (fields.comments_count != null) metrics.comments = fields.comments_count;

  return metrics;
}

/** Map metrics using platform ID to pick the right mapper */
export function mapMetrics(
  platformId: "ig_feed" | "ig_reel",
  fields: IgMediaFields,
  insights: IgInsightValue[]
): Record<string, number> {
  return platformId === "ig_reel"
    ? mapReelMetrics(fields, insights)
    : mapFeedMetrics(fields, insights);
}
