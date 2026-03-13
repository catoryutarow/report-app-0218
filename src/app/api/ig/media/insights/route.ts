import { NextRequest } from "next/server";
import { getStoredToken, igFetch, IgApiException, errorResponse } from "../../lib";
import { toPlatformId, mapMetrics } from "@/lib/ig/mapper";

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

const FEED_INSIGHT_METRICS = "impressions,reach,saved,shares";
const REEL_INSIGHT_METRICS = "views,reach,saved,shares";

type InsightData = {
  data: Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
};

type MediaFields = {
  id: string;
  like_count: number;
  comments_count: number;
  media_type: string;
  media_product_type: string;
  timestamp: string;
  permalink: string;
  caption?: string;
  thumbnail_url?: string;
};

type MediaResult = {
  igMediaId: string;
  platformId: "ig_feed" | "ig_reel";
  metrics: Record<string, number>;
  caption: string;
  permalink: string;
  timestamp: string;
  thumbnailUrl: string | null;
  insightWarning?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { mediaIds } = await req.json();
    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return Response.json({ error: "mediaIds array is required" }, { status: 400 });
    }

    const stored = await getStoredToken();
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 401 });
    }

    const results: MediaResult[] = [];
    const errors: Array<{ igMediaId: string; error: string }> = [];

    for (const mediaId of mediaIds) {
      try {
        // Step 1: Get media fields
        const fields = await igFetch<MediaFields>(
          `${GRAPH_API_BASE}/${mediaId}?fields=id,like_count,comments_count,media_type,media_product_type,timestamp,permalink,caption,thumbnail_url`,
          stored.accessToken
        );

        const platformId = toPlatformId(fields.media_type, fields.media_product_type);

        // Step 2: Get insights (different metrics per type)
        const insightMetrics =
          platformId === "ig_reel" ? REEL_INSIGHT_METRICS : FEED_INSIGHT_METRICS;

        let insightData: InsightData["data"] = [];
        let insightWarning: string | undefined;
        let rawInsightResponse: unknown;
        try {
          const insights = await igFetch<InsightData>(
            `${GRAPH_API_BASE}/${mediaId}/insights?metric=${insightMetrics}`,
            stored.accessToken
          );
          rawInsightResponse = insights;
          insightData = insights.data ?? [];
          if (insightData.length === 0) {
            insightWarning = `Empty insights data. Raw: ${JSON.stringify(insights).slice(0, 300)}`;
          }
        } catch (e) {
          insightWarning = e instanceof IgApiException ? e.igMessage : `Unknown insights error: ${e instanceof Error ? e.message : String(e)}`;
          console.warn(`Insights unavailable for ${mediaId}: ${insightWarning}`);
        }

        // Step 3: Map to PlatformConfig metric keys
        const metrics = mapMetrics(
          platformId,
          { like_count: fields.like_count, comments_count: fields.comments_count },
          insightData
        );

        results.push({
          igMediaId: mediaId,
          platformId,
          metrics,
          caption: fields.caption ?? "",
          permalink: fields.permalink,
          timestamp: fields.timestamp,
          thumbnailUrl: fields.thumbnail_url ?? null,
          ...(insightWarning ? { insightWarning } : {}),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push({ igMediaId: mediaId, error: message });
      }
    }

    return Response.json({ results, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
