import {
  getStoredToken,
  refreshToken,
  saveToken,
  errorResponse,
} from "../../lib";

export async function POST() {
  try {
    const stored = await getStoredToken();
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 404 });
    }

    const { access_token, expires_in } = await refreshToken(stored.accessToken);
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await saveToken({
      accessToken: access_token,
      igUserId: stored.igUserId,
      tokenExpiresAt: expiresAt,
      connectedAccountName: stored.connectedAccountName,
    });

    return Response.json({
      success: true,
      tokenExpiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
