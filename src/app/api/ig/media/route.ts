import { NextRequest } from "next/server";
import { getStoredToken, igFetch, errorResponse } from "../lib";

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

type IgMedia = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type: string;
  timestamp: string;
  permalink: string;
  thumbnail_url?: string;
};

export async function GET(req: NextRequest) {
  try {
    const stored = await getStoredToken();
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 401 });
    }

    const limit = req.nextUrl.searchParams.get("limit") ?? "25";

    const data = await igFetch<{ data: IgMedia[] }>(
      `${GRAPH_API_BASE}/${stored.igUserId}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url&limit=${limit}`,
      stored.accessToken
    );

    return Response.json({
      media: (data.data ?? []).map((m) => ({
        igMediaId: m.id,
        caption: m.caption ?? "",
        mediaType: m.media_type,
        mediaProductType: m.media_product_type,
        timestamp: m.timestamp,
        permalink: m.permalink,
        thumbnailUrl: m.thumbnail_url ?? null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
