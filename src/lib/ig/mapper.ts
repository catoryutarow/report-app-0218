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
 */
export function mapReelMetrics(
  fields: IgMediaFields,
  insights: IgInsightValue[]
): Record<string, number> {
  const insightMap = new Map(
    insights.map((i) => [i.name, i.values[0]?.value ?? 0])
  );

  const metrics: Record<string, number> = {};

  // views: v22.0 replaced plays/ig_reels_aggregated_all_plays_count with "views"
  if (insightMap.has("views")) metrics.plays = insightMap.get("views")!;
  if (insightMap.has("reach")) metrics.reach = insightMap.get("reach")!;
  if (insightMap.has("saved")) metrics.saves = insightMap.get("saved")!;
  if (insightMap.has("shares")) metrics.shares = insightMap.get("shares")!;

  // Watch time metrics (v22.0)
  // ig_reels_video_view_total_time returns ms → convert to seconds
  if (insightMap.has("ig_reels_video_view_total_time")) {
    metrics.total_watch_time_sec = insightMap.get("ig_reels_video_view_total_time")! / 1000;
  }
  // ig_reels_avg_watch_time returns ms → store raw for debugging/display
  if (insightMap.has("ig_reels_avg_watch_time")) {
    metrics.ig_reels_avg_watch_time = insightMap.get("ig_reels_avg_watch_time")!;
  }

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

/**
 * IG Account Insights API returns daily values for each metric.
 * Sum daily values for impressions/reach, compute follower delta from follower_count.
 */
type AccountInsightEntry = {
  name: string;
  values: Array<{ value: number; end_time: string }>;
};

export function mapAccountInsights(
  insights: AccountInsightEntry[]
): Record<string, number> {
  const summary: Record<string, number> = {};

  for (const metric of insights) {
    const values = metric.values.map((v) => v.value);
    if (values.length === 0) continue;

    switch (metric.name) {
      case "reach":
      case "likes":
      case "comments":
      case "shares":
      case "saves":
      case "total_interactions":
        summary[metric.name] = values.reduce((a, b) => a + b, 0);
        break;
      case "follower_count":
        // Daily snapshots — delta = last - first
        summary.follows = values[values.length - 1] - values[0];
        break;
    }
  }

  return summary;
}
