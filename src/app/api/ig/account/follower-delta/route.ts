import { NextRequest } from "next/server";
import { getStoredToken, igFetch, errorResponse } from "../../lib";

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

type FollowerCountResponse = {
  data: Array<{
    name: string;
    values: Array<{ value: number; end_time: string }>;
  }>;
};

/**
 * Get follower count delta for a period using follower_count metric.
 * Only works for periods within the last 30 days.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, periodStart, periodEnd } = body;

    if (!accountId || !periodStart || !periodEnd) {
      return Response.json({ error: "accountId, periodStart, periodEnd required" }, { status: 400 });
    }

    const stored = await getStoredToken(accountId);
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 401 });
    }

    const since = Math.floor(new Date(periodStart).getTime() / 1000);
    const until = Math.floor(new Date(periodEnd).getTime() / 1000);

    const data = await igFetch<FollowerCountResponse>(
      `${GRAPH_API_BASE}/${stored.igUserId}/insights?metric=follower_count&period=day&since=${since}&until=${until}`,
      stored.accessToken
    );

    const metric = (data.data ?? []).find((d) => d.name === "follower_count");
    if (!metric?.values || metric.values.length < 2) {
      return Response.json({ follows: null });
    }

    const values = metric.values.map((v) => v.value);
    const delta = values[values.length - 1] - values[0];

    return Response.json({ follows: delta });
  } catch (error) {
    return errorResponse(error);
  }
}
