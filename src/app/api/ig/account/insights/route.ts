import { NextRequest } from "next/server";
import { getStoredToken, igFetch, errorResponse } from "../../lib";
import { mapAccountInsights } from "@/lib/ig/mapper";

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

type AccountInsightsResponse = {
  data: Array<{
    name: string;
    values: Array<{ value: number; end_time: string }>;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, periodStart, periodEnd } = body;

    if (!accountId || typeof accountId !== "string") {
      return Response.json({ error: "accountId is required" }, { status: 400 });
    }
    if (!periodStart || !periodEnd) {
      return Response.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
    }

    const stored = await getStoredToken(accountId);
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 401 });
    }

    // IG Account Insights requires unix timestamps
    const since = Math.floor(new Date(periodStart).getTime() / 1000);
    const until = Math.floor(new Date(periodEnd).getTime() / 1000);

    const data = await igFetch<AccountInsightsResponse>(
      `${GRAPH_API_BASE}/${stored.igUserId}/insights?metric=reach,likes,comments,shares,saves,total_interactions,follows_and_unfollows&metric_type=total_value&period=day&since=${since}&until=${until}`,
      stored.accessToken
    );

    // Debug: log raw response for follows_and_unfollows
    const followsMetric = (data.data ?? []).find((d) => d.name === "follows_and_unfollows");
    console.log("follows_and_unfollows raw:", JSON.stringify(followsMetric ?? "not found"));

    const summary = mapAccountInsights(data.data ?? []);
    console.log("mapped summary:", JSON.stringify(summary));

    return Response.json({ summary });
  } catch (error) {
    return errorResponse(error);
  }
}
