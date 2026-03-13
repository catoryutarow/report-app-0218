import { NextRequest } from "next/server";
import { getStoredToken, igFetch, errorResponse, requireAccountId } from "../../lib";

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

type MediaFields = {
  id: string;
  thumbnail_url?: string;
  media_url?: string;
};

/**
 * POST: Fetch thumbnail URLs for a list of IG media IDs.
 * Body: { accountId, mediaIds: string[] }
 * Returns: { thumbnails: { [mediaId]: string | null } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const accountId = requireAccountId(null, body);
    const { mediaIds } = body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return Response.json({ error: "mediaIds array is required" }, { status: 400 });
    }

    const stored = await getStoredToken(accountId);
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 401 });
    }

    const thumbnails: Record<string, string | null> = {};

    for (const mediaId of mediaIds) {
      try {
        const fields = await igFetch<MediaFields>(
          `${GRAPH_API_BASE}/${mediaId}?fields=id,thumbnail_url,media_url`,
          stored.accessToken
        );
        thumbnails[mediaId] = fields.thumbnail_url ?? fields.media_url ?? null;
      } catch {
        thumbnails[mediaId] = null;
      }
    }

    return Response.json({ thumbnails });
  } catch (error) {
    return errorResponse(error);
  }
}
