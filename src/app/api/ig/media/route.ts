import { NextRequest } from "next/server";
import { getStoredToken, igFetch, errorResponse, requireAccountId } from "../lib";

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

type MediaPage = {
  data: IgMedia[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
};

const MAX_PAGES = 4;

export async function GET(req: NextRequest) {
  try {
    const accountId = requireAccountId(req);
    const stored = await getStoredToken(accountId);
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 401 });
    }

    const limit = req.nextUrl.searchParams.get("limit") ?? "50";
    // Optional: stop fetching when posts are older than this date
    const sinceParam = req.nextUrl.searchParams.get("since"); // ISO string
    const sinceDate = sinceParam ? new Date(sinceParam) : null;

    const allMedia: IgMedia[] = [];
    let url: string | null =
      `${GRAPH_API_BASE}/${stored.igUserId}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url&limit=${limit}`;
    let pages = 0;
    let reachedBoundary = false;

    while (url && pages < MAX_PAGES && !reachedBoundary) {
      const page: MediaPage = await igFetch<MediaPage>(url, stored.accessToken);

      for (const m of page.data ?? []) {
        if (sinceDate && new Date(m.timestamp) < sinceDate) {
          reachedBoundary = true;
          break;
        }
        allMedia.push(m);
      }

      url = page.paging?.next ?? null;
      pages++;
    }

    return Response.json({
      media: allMedia.map((m) => ({
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
