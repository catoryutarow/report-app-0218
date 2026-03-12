import { NextRequest } from "next/server";
import {
  exchangeToken,
  getIgBusinessAccountId,
  saveToken,
  deleteToken,
  errorResponse,
} from "../../lib";

export async function POST(req: NextRequest) {
  try {
    const { shortToken } = await req.json();
    if (!shortToken || typeof shortToken !== "string") {
      return Response.json({ error: "shortToken is required" }, { status: 400 });
    }

    // Exchange short-lived → long-lived token
    const { access_token, expires_in } = await exchangeToken(shortToken);

    // Discover IG Business Account ID
    const { igUserId, accountName } = await getIgBusinessAccountId(access_token);

    // Calculate expiry date
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Save to Firestore
    await saveToken({
      accessToken: access_token,
      igUserId,
      tokenExpiresAt: expiresAt,
      connectedAccountName: accountName,
    });

    return Response.json({
      success: true,
      igUserId,
      connectedAccountName: accountName,
      tokenExpiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    await deleteToken();
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
