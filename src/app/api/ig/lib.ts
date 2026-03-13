import { doc, getDoc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// --- Token storage (per-account, using client Firestore SDK) ---

export type StoredToken = {
  accessToken: string;
  igUserId: string;
  tokenExpiresAt: Timestamp;
  connectedAccountName: string;
  updatedAt: Timestamp;
};

function igTokenDoc(accountId: string) {
  return doc(db(), "accounts", accountId, "settings", "instagram");
}

export async function getStoredToken(accountId: string): Promise<StoredToken | null> {
  const snap = await getDoc(igTokenDoc(accountId));
  if (!snap.exists()) return null;
  return snap.data() as StoredToken;
}

export async function saveToken(accountId: string, data: {
  accessToken: string;
  igUserId: string;
  tokenExpiresAt: Date;
  connectedAccountName: string;
}): Promise<void> {
  await setDoc(igTokenDoc(accountId), {
    accessToken: data.accessToken,
    igUserId: data.igUserId,
    tokenExpiresAt: Timestamp.fromDate(data.tokenExpiresAt),
    connectedAccountName: data.connectedAccountName,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteToken(accountId: string): Promise<void> {
  await deleteDoc(igTokenDoc(accountId));
}

// --- IG API helpers ---

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

export class IgApiException extends Error {
  constructor(
    public code: number,
    public igMessage: string,
    public igType: string
  ) {
    super(`IG API Error ${code}: ${igMessage}`);
    this.name = "IgApiException";
  }
}

/**
 * Make an authenticated request to the Instagram/Graph API.
 */
export async function igFetch<T>(
  url: string,
  token: string,
): Promise<T> {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}access_token=${token}`;

  const res = await fetch(fullUrl);
  const data = await res.json();

  if (data.error) {
    throw new IgApiException(
      data.error.code ?? res.status,
      data.error.message ?? "Unknown error",
      data.error.type ?? "Unknown"
    );
  }

  return data as T;
}

/**
 * Exchange a short-lived token for a long-lived one.
 */
export async function exchangeToken(shortToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${shortToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new IgApiException(
      data.error.code ?? 400,
      data.error.message ?? "Token exchange failed",
      data.error.type ?? "OAuthException"
    );
  }
  return data;
}

/**
 * Refresh a long-lived token.
 */
export async function refreshToken(currentToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${currentToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new IgApiException(
      data.error.code ?? 400,
      data.error.message ?? "Token refresh failed",
      data.error.type ?? "OAuthException"
    );
  }
  return data;
}

/**
 * Get the IG Business Account ID linked to the user's Facebook Page.
 */
export async function getIgBusinessAccountId(token: string): Promise<{
  igUserId: string;
  accountName: string;
}> {
  const pagesRes = await igFetch<{
    data: Array<{ id: string; name: string; access_token: string }>;
  }>(`${GRAPH_API_BASE}/me/accounts`, token);

  let pages = pagesRes.data ?? [];

  if (pages.length === 0) {
    try {
      const bizRes = await igFetch<{
        businesses?: {
          data: Array<{
            owned_pages?: {
              data: Array<{ id: string; name: string }>;
            };
          }>;
        };
      }>(`${GRAPH_API_BASE}/me?fields=businesses{owned_pages}`, token);

      for (const biz of bizRes.businesses?.data ?? []) {
        for (const page of biz.owned_pages?.data ?? []) {
          pages.push({ ...page, access_token: "" });
        }
      }
    } catch {
      // business_management permission may not be granted — ignore
    }
  }

  if (pages.length === 0) {
    throw new Error("Facebookページが見つかりません。business_managementパーミッションを含めてトークンを再生成してください。");
  }

  for (const page of pages) {
    const igRes = await igFetch<{
      instagram_business_account?: { id: string };
    }>(`${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account`, token);

    if (igRes.instagram_business_account) {
      const igAccount = await igFetch<{ username: string }>(
        `${GRAPH_API_BASE}/${igRes.instagram_business_account.id}?fields=username`,
        token
      );

      return {
        igUserId: igRes.instagram_business_account.id,
        accountName: `@${igAccount.username}`,
      };
    }
  }

  throw new Error("InstagramビジネスアカウントがリンクされたFacebookページが見つかりません");
}

/**
 * Normalize IG API errors to a consistent JSON response.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof IgApiException) {
    const status =
      error.code === 190 ? 401 :
      error.code === 10 ? 403 :
      error.code === 4 ? 429 :
      400;
    return Response.json(
      { error: error.igMessage, code: error.code, type: error.igType },
      { status }
    );
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return Response.json({ error: message }, { status: 500 });
}

/** Extract and validate accountId from request searchParams */
export function requireAccountId(req: { nextUrl: URL } | null, body?: { accountId?: string }): string {
  const id = req?.nextUrl?.searchParams?.get("accountId") ?? body?.accountId;
  if (!id || typeof id !== "string") {
    throw new Error("accountId is required");
  }
  return id;
}
