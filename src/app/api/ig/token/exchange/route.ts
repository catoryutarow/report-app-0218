import { NextRequest } from "next/server";
import {
  exchangeToken,
  getIgBusinessAccountId,
  saveToken,
  deleteToken,
  errorResponse,
  requireAccountId,
} from "../../lib";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const accountId = requireAccountId(null, body);
    const { shortToken } = body;
    if (!shortToken || typeof shortToken !== "string") {
      return Response.json({ error: "shortToken is required" }, { status: 400 });
    }

    const { access_token, expires_in } = await exchangeToken(shortToken);
    const { igUserId, accountName } = await getIgBusinessAccountId(access_token);

    const expiresInSec = Number(expires_in) || 5184000;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);

    await saveToken(accountId, {
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

export async function DELETE(req: NextRequest) {
  try {
    const accountId = requireAccountId(req);
    await deleteToken(accountId);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
