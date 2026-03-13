import { NextRequest } from "next/server";
import { getStoredToken, requireAccountId } from "../../lib";

export async function GET(req: NextRequest) {
  try {
    const accountId = requireAccountId(req);
    const stored = await getStoredToken(accountId);

    if (!stored) {
      return Response.json({ connected: false });
    }

    const expiresAt = stored.tokenExpiresAt.toDate();
    const now = new Date();
    const daysRemaining = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return Response.json({
      connected: true,
      igUserId: stored.igUserId,
      connectedAccountName: stored.connectedAccountName,
      tokenExpiresAt: expiresAt.toISOString(),
      daysRemaining,
      expired: daysRemaining < 0,
    });
  } catch {
    return Response.json({ connected: false });
  }
}
