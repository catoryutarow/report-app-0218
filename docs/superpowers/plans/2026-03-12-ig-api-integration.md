# Phase 1.5: Instagram Graph API Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram Graph API integration to auto-import Feed + Reels post metrics via a button click, replacing manual QuickEntry input for IG accounts.

**Architecture:** Next.js API Routes handle all IG API calls server-side (token secrecy). Tokens stored in Firestore `settings/instagram` doc. Frontend gets a new `IgImportDialog` component. Existing platform configs, KPI calculator, and snapshot model are reused as-is.

**Tech Stack:** Next.js 16 App Router API Routes, Instagram Graph API v22.0, Firebase Admin (Firestore server-side read for tokens), existing React + shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-03-12-ig-api-integration-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/app/api/ig/lib.ts` | Shared: read token from Firestore (server-side), IG API client wrapper, error normalization |
| `src/app/api/ig/token/exchange/route.ts` | POST: short-lived → long-lived token exchange, save to Firestore |
| `src/app/api/ig/token/refresh/route.ts` | POST: refresh long-lived token (60-day extension) |
| `src/app/api/ig/token/status/route.ts` | GET: return token status (expiry, account name) — no secret exposed |
| `src/app/api/ig/media/route.ts` | GET: fetch recent media list from IG API |
| `src/app/api/ig/media/insights/route.ts` | POST: fetch insights for selected media IDs, return normalized metrics |
| `src/lib/ig/mapper.ts` | Map IG API response → PlatformConfig metric keys (ig_feed / ig_reel) |
| `src/components/ig/IgConnectForm.tsx` | Token input form for /settings (short token → exchange) |
| `src/components/ig/IgTokenStatus.tsx` | Connection status + expiry display + refresh/disconnect buttons |
| `src/components/ig/IgImportDialog.tsx` | Media list selection + snapshot creation dialog |

### Modified files

| File | Change |
|------|--------|
| `src/lib/firebase/firestore.ts` | Add `getIgSettings()`, `saveIgSettings()`, `deleteIgSettings()` |
| `src/app/(dashboard)/settings/page.tsx` | Add Instagram API section using IgConnectForm + IgTokenStatus |
| `src/app/(dashboard)/accounts/[accountId]/page.tsx` | Add "APIから取得" button for IG accounts, wire IgImportDialog |
| `src/components/layout/Header.tsx` | Add token expiry warning banner (≤7 days) |
| `firestore.rules` | Add `settings/{docId}` rule blocking client reads for token doc |
| `.env.example` | Add `META_APP_ID`, `META_APP_SECRET` |
| `next.config.ts` | Add Instagram CDN to `images.remotePatterns` |

---

## Chunk 1: Foundation — Firestore helpers, env, IG API client, mapper

### Task 1: Environment & config setup

**Files:**
- Modify: `.env.example`
- Modify: `next.config.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Add Meta env vars to `.env.example`**

Append to `.env.example`:

```
# Meta / Instagram Graph API
META_APP_ID=
META_APP_SECRET=
```

- [ ] **Step 2: Add Instagram CDN to `next.config.ts`**

Add to the `remotePatterns` array in `next.config.ts`:

```typescript
{
  protocol: "https",
  hostname: "*.cdninstagram.com",
},
{
  protocol: "https",
  hostname: "scontent*.cdninstagram.com",
},
```

- [ ] **Step 3: Add Firestore rules for settings collection**

Add a new top-level match block inside the `match /databases/{database}/documents` block in `firestore.rules`:

```
// Settings: block all client access (server-side API routes only)
match /settings/{docId} {
  allow read, write: if false;
}
```

- [ ] **Step 4: Commit**

```bash
git add .env.example next.config.ts firestore.rules
git commit -m "feat(ig-api): add env vars, CDN patterns, and firestore rules for IG integration"
```

---

### Task 2: Firestore helpers for IG settings

**Files:**
- Modify: `src/lib/firebase/firestore.ts`

- [ ] **Step 1: Add IgSettings type and CRUD helpers**

Add the following at the end of `src/lib/firebase/firestore.ts`:

```typescript
// ---- Instagram API Settings ----

export type IgSettings = {
  accessToken: string;
  igUserId: string;
  tokenExpiresAt: Timestamp;
  connectedAccountName: string;
  updatedAt: Timestamp;
};

/** Public-safe subset (no accessToken) */
export type IgSettingsPublic = Omit<IgSettings, "accessToken">;

export async function getIgSettings(): Promise<IgSettings | null> {
  const snap = await getDoc(doc(db(), "settings", "instagram"));
  if (!snap.exists()) return null;
  return snap.data() as IgSettings;
}

export async function saveIgSettings(data: IgSettings): Promise<void> {
  const { setDoc } = await import("firebase/firestore");
  await setDoc(doc(db(), "settings", "instagram"), data);
}

export async function deleteIgSettings(): Promise<void> {
  await deleteDoc(doc(db(), "settings", "instagram"));
}
```

- [ ] **Step 2: Add `setDoc` to the import if not already present**

Check the existing imports at the top of `firestore.ts`. If `setDoc` is not in the import from `"firebase/firestore"`, add it. Otherwise the dynamic import in `saveIgSettings` handles it.

Note: Since Firestore rules block client reads on `settings/*`, these helpers will only work from API Routes where Firebase Admin or server-side context has access. For the client-side token status check, we'll use the `/api/ig/token/status` API route instead.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/firestore.ts
git commit -m "feat(ig-api): add IgSettings type and Firestore CRUD helpers"
```

---

### Task 3: IG API mapper

**Files:**
- Create: `src/lib/ig/mapper.ts`

- [ ] **Step 1: Create the mapper module**

Create `src/lib/ig/mapper.ts`:

```typescript
/**
 * Maps Instagram Graph API responses to PlatformConfig metric keys.
 *
 * Two data sources per media:
 * - Media fields: like_count, comments_count (from GET /{media-id}?fields=...)
 * - Insights: reach, impressions, saved, shares, plays, etc. (from GET /{media-id}/insights)
 */

/** Determine platform ID from IG API media_type and media_product_type */
export function toPlatformId(
  mediaType: string,
  mediaProductType: string
): "ig_feed" | "ig_reel" {
  if (mediaProductType === "REELS") return "ig_reel";
  return "ig_feed"; // IMAGE, CAROUSEL_ALBUM, non-REELS VIDEO
}

type IgMediaFields = {
  like_count?: number;
  comments_count?: number;
};

type IgInsightValue = {
  name: string;
  values: Array<{ value: number }>;
};

/**
 * Map IG API data to PlatformConfig metric keys for ig_feed.
 *
 * Feed metrics: reach, impressions, saves, likes, comments, shares, follows
 */
export function mapFeedMetrics(
  fields: IgMediaFields,
  insights: IgInsightValue[]
): Record<string, number> {
  const insightMap = new Map(
    insights.map((i) => [i.name, i.values[0]?.value ?? 0])
  );

  const metrics: Record<string, number> = {};

  // From insights endpoint
  if (insightMap.has("reach")) metrics.reach = insightMap.get("reach")!;
  if (insightMap.has("impressions")) metrics.impressions = insightMap.get("impressions")!;
  if (insightMap.has("saved")) metrics.saves = insightMap.get("saved")!;
  if (insightMap.has("shares")) metrics.shares = insightMap.get("shares")!;

  // From media fields
  if (fields.like_count != null) metrics.likes = fields.like_count;
  if (fields.comments_count != null) metrics.comments = fields.comments_count;

  return metrics;
}

/**
 * Map IG API data to PlatformConfig metric keys for ig_reel.
 *
 * Reel metrics: plays, reach, total_watch_time_ms, duration_sec, likes, comments, saves, shares, follows
 * Note: total_watch_time_ms and duration_sec are NOT available from IG API — must be entered manually.
 */
export function mapReelMetrics(
  fields: IgMediaFields,
  insights: IgInsightValue[]
): Record<string, number> {
  const insightMap = new Map(
    insights.map((i) => [i.name, i.values[0]?.value ?? 0])
  );

  const metrics: Record<string, number> = {};

  // From insights endpoint
  if (insightMap.has("plays")) metrics.plays = insightMap.get("plays")!;
  if (insightMap.has("reach")) metrics.reach = insightMap.get("reach")!;
  if (insightMap.has("saved")) metrics.saves = insightMap.get("saved")!;
  if (insightMap.has("shares")) metrics.shares = insightMap.get("shares")!;

  // From media fields
  if (fields.like_count != null) metrics.likes = fields.like_count;
  if (fields.comments_count != null) metrics.comments = fields.comments_count;

  return metrics;
}

/** Map metrics using platform ID to pick the right mapper */
export function mapMetrics(
  platformId: "ig_feed" | "ig_reel",
  fields: IgMediaFields,
  insights: IgInsightValue[]
): Record<string, number> {
  return platformId === "ig_reel"
    ? mapReelMetrics(fields, insights)
    : mapFeedMetrics(fields, insights);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ig/mapper.ts
git commit -m "feat(ig-api): add IG API response mapper for Feed and Reel metrics"
```

---

### Task 4: IG API client library (shared by all routes)

**Files:**
- Create: `src/app/api/ig/lib.ts`

- [ ] **Step 1: Create the shared IG API library**

Create `src/app/api/ig/lib.ts`:

```typescript
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// --- Firebase Admin (server-side only) ---

let adminApp: App | undefined;

function getAdminApp(): App {
  if (!adminApp) {
    adminApp = getApps().length === 0
      ? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
      : getApps()[0];
  }
  return adminApp;
}

function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

// --- Token helpers ---

export type StoredToken = {
  accessToken: string;
  igUserId: string;
  tokenExpiresAt: FirebaseFirestore.Timestamp;
  connectedAccountName: string;
  updatedAt: FirebaseFirestore.Timestamp;
};

export async function getStoredToken(): Promise<StoredToken | null> {
  const snap = await adminDb().doc("settings/instagram").get();
  if (!snap.exists) return null;
  return snap.data() as StoredToken;
}

export async function saveToken(data: {
  accessToken: string;
  igUserId: string;
  tokenExpiresAt: Date;
  connectedAccountName: string;
}): Promise<void> {
  const { Timestamp } = await import("firebase-admin/firestore");
  await adminDb().doc("settings/instagram").set({
    accessToken: data.accessToken,
    igUserId: data.igUserId,
    tokenExpiresAt: Timestamp.fromDate(data.tokenExpiresAt),
    connectedAccountName: data.connectedAccountName,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteToken(): Promise<void> {
  await adminDb().doc("settings/instagram").delete();
}

// --- IG API helpers ---

const IG_API_BASE = "https://graph.instagram.com";
const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

export type IgApiError = {
  code: number;
  message: string;
  type: string;
};

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
 * Throws IgApiException on API errors.
 */
export async function igFetch<T>(
  url: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}access_token=${token}`;

  const res = await fetch(fullUrl, options);
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
 * Returns { access_token, token_type, expires_in }.
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
 * Refresh a long-lived token. Returns new token + expires_in.
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
  // Step 1: Get user's pages
  const pagesRes = await igFetch<{
    data: Array<{ id: string; name: string; access_token: string }>;
  }>(`${GRAPH_API_BASE}/me/accounts`, token);

  if (!pagesRes.data || pagesRes.data.length === 0) {
    throw new Error("No Facebook Pages found for this account");
  }

  // Step 2: Get IG Business Account from first page
  const page = pagesRes.data[0];
  const igRes = await igFetch<{
    instagram_business_account?: { id: string };
  }>(`${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account`, token);

  if (!igRes.instagram_business_account) {
    throw new Error("No Instagram Business Account linked to this Facebook Page");
  }

  // Step 3: Get IG account username
  const igAccount = await igFetch<{ username: string }>(
    `${GRAPH_API_BASE}/${igRes.instagram_business_account.id}?fields=username`,
    token
  );

  return {
    igUserId: igRes.instagram_business_account.id,
    accountName: `@${igAccount.username}`,
  };
}

/**
 * Normalize IG API errors to a consistent JSON response.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof IgApiException) {
    const status =
      error.code === 190 ? 401 :   // Invalid/expired token
      error.code === 10 ? 403 :    // Permission denied
      error.code === 4 ? 429 :     // Rate limit
      400;
    return Response.json(
      { error: error.igMessage, code: error.code, type: error.igType },
      { status }
    );
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return Response.json({ error: message }, { status: 500 });
}
```

- [ ] **Step 2: Install firebase-admin**

```bash
npm install firebase-admin
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ig/lib.ts package.json package-lock.json
git commit -m "feat(ig-api): add shared IG API client library with Firebase Admin"
```

---

## Chunk 2: Token management API routes

### Task 5: Token exchange route

**Files:**
- Create: `src/app/api/ig/token/exchange/route.ts`

- [ ] **Step 1: Create the exchange route**

```typescript
import { NextRequest } from "next/server";
import {
  exchangeToken,
  getIgBusinessAccountId,
  saveToken,
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/token/exchange/route.ts
git commit -m "feat(ig-api): add token exchange API route"
```

---

### Task 6: Token refresh route

**Files:**
- Create: `src/app/api/ig/token/refresh/route.ts`

- [ ] **Step 1: Create the refresh route**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/token/refresh/route.ts
git commit -m "feat(ig-api): add token refresh API route"
```

---

### Task 7: Token status route

**Files:**
- Create: `src/app/api/ig/token/status/route.ts`

- [ ] **Step 1: Create the status route**

```typescript
import { getStoredToken } from "../../lib";

export async function GET() {
  const stored = await getStoredToken();

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
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/token/status/route.ts
git commit -m "feat(ig-api): add token status API route"
```

---

## Chunk 3: Media fetching API routes

### Task 8: Media list route

**Files:**
- Create: `src/app/api/ig/media/route.ts`

- [ ] **Step 1: Create the media list route**

```typescript
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

    // Return media list (no token exposed)
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/media/route.ts
git commit -m "feat(ig-api): add media list API route"
```

---

### Task 9: Media insights route

**Files:**
- Create: `src/app/api/ig/media/insights/route.ts`

- [ ] **Step 1: Create the insights route**

This is the main route that fetches metrics for selected media IDs.

```typescript
import { NextRequest } from "next/server";
import { getStoredToken, igFetch, IgApiException, errorResponse } from "../../lib";
import { toPlatformId, mapMetrics } from "@/lib/ig/mapper";

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

/** Insight metric names to request per media type */
const FEED_INSIGHT_METRICS = "impressions,reach,saved,shares";
const REEL_INSIGHT_METRICS = "reach,saved,shares,plays";

type InsightData = {
  data: Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
};

type MediaFields = {
  id: string;
  like_count: number;
  comments_count: number;
  media_type: string;
  media_product_type: string;
  timestamp: string;
  permalink: string;
  caption?: string;
  thumbnail_url?: string;
};

type MediaResult = {
  igMediaId: string;
  platformId: "ig_feed" | "ig_reel";
  metrics: Record<string, number>;
  caption: string;
  permalink: string;
  timestamp: string;
  thumbnailUrl: string | null;
  error?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { mediaIds } = await req.json();
    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return Response.json({ error: "mediaIds array is required" }, { status: 400 });
    }

    const stored = await getStoredToken();
    if (!stored) {
      return Response.json({ error: "No token configured" }, { status: 401 });
    }

    const results: MediaResult[] = [];
    const errors: Array<{ igMediaId: string; error: string }> = [];

    for (const mediaId of mediaIds) {
      try {
        // Step 1: Get media fields (like_count, comments_count, type info)
        const fields = await igFetch<MediaFields>(
          `${GRAPH_API_BASE}/${mediaId}?fields=id,like_count,comments_count,media_type,media_product_type,timestamp,permalink,caption,thumbnail_url`,
          stored.accessToken
        );

        const platformId = toPlatformId(fields.media_type, fields.media_product_type);

        // Step 2: Get insights (different metrics per type)
        const insightMetrics =
          platformId === "ig_reel" ? REEL_INSIGHT_METRICS : FEED_INSIGHT_METRICS;

        let insightData: InsightData["data"] = [];
        try {
          const insights = await igFetch<InsightData>(
            `${GRAPH_API_BASE}/${mediaId}/insights?metric=${insightMetrics}`,
            stored.accessToken
          );
          insightData = insights.data ?? [];
        } catch (e) {
          // Insights may fail for old posts (>194 days) — continue with fields only
          if (e instanceof IgApiException) {
            console.warn(`Insights unavailable for ${mediaId}: ${e.igMessage}`);
          }
        }

        // Step 3: Map to PlatformConfig metric keys
        const metrics = mapMetrics(
          platformId,
          { like_count: fields.like_count, comments_count: fields.comments_count },
          insightData
        );

        results.push({
          igMediaId: mediaId,
          platformId,
          metrics,
          caption: fields.caption ?? "",
          permalink: fields.permalink,
          timestamp: fields.timestamp,
          thumbnailUrl: fields.thumbnail_url ?? null,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push({ igMediaId: mediaId, error: message });
      }
    }

    return Response.json({ results, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/media/insights/route.ts
git commit -m "feat(ig-api): add media insights API route with Feed/Reel mapping"
```

---

## Chunk 4: Settings UI — Connect form & token status

### Task 10: IgConnectForm component

**Files:**
- Create: `src/components/ig/IgConnectForm.tsx`

- [ ] **Step 1: Create the connect form**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  onConnected: () => void;
};

export function IgConnectForm({ onConnected }: Props) {
  const [shortToken, setShortToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortToken.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ig/token/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortToken: shortToken.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "トークンの交換に失敗しました");
        return;
      }

      toast.success(`${data.connectedAccountName} に接続しました`);
      setShortToken("");
      onConnected();
    } catch {
      toast.error("接続に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="ig-short-token" className="text-sm">
          短期アクセストークン
        </Label>
        <Input
          id="ig-short-token"
          value={shortToken}
          onChange={(e) => setShortToken(e.target.value)}
          placeholder="Graph API Explorerで取得したトークンを貼り付け"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Meta for Developers → Graph API Explorer → Generate Access Token
        </p>
      </div>
      <Button type="submit" size="sm" disabled={loading || !shortToken.trim()}>
        {loading ? "接続中..." : "接続"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ig/IgConnectForm.tsx
git commit -m "feat(ig-api): add IgConnectForm component for token setup"
```

---

### Task 11: IgTokenStatus component

**Files:**
- Create: `src/components/ig/IgTokenStatus.tsx`

- [ ] **Step 1: Create the token status component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";

type TokenStatus = {
  connected: boolean;
  igUserId?: string;
  connectedAccountName?: string;
  tokenExpiresAt?: string;
  daysRemaining?: number;
  expired?: boolean;
};

type Props = {
  status: TokenStatus;
  onRefreshed: () => void;
  onDisconnected: () => void;
};

export function IgTokenStatus({ status, onRefreshed, onDisconnected }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ig/token/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "トークンの更新に失敗しました");
        return;
      }
      toast.success("トークンを更新しました");
      onRefreshed();
    } catch {
      toast.error("トークンの更新に失敗しました");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Instagram API連携を解除しますか？")) return;
    setDisconnecting(true);
    try {
      // We'll call a delete endpoint or handle client-side
      // For now, use the token status to clear
      const res = await fetch("/api/ig/token/exchange", {
        method: "DELETE",
      });
      toast.success("接続を解除しました");
      onDisconnected();
    } catch {
      toast.error("解除に失敗しました");
    } finally {
      setDisconnecting(false);
    }
  };

  const expiryColor =
    status.expired
      ? "text-destructive"
      : (status.daysRemaining ?? 99) <= 7
        ? "text-destructive"
        : (status.daysRemaining ?? 99) <= 14
          ? "text-orange-500"
          : "text-green-600";

  const expiryDate = status.tokenExpiresAt
    ? new Date(status.tokenExpiresAt).toLocaleDateString("ja-JP")
    : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={status.expired ? "destructive" : "secondary"}>
          {status.expired ? "期限切れ" : "接続中"}
        </Badge>
        <span className="text-sm font-medium">{status.connectedAccountName}</span>
      </div>

      <p className={`text-sm ${expiryColor}`}>
        トークン有効期限: {expiryDate}
        {status.daysRemaining != null && (
          <span>（残り{status.daysRemaining}日）</span>
        )}
      </p>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "更新中..." : "トークンを更新"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-muted-foreground"
        >
          <Unlink className="mr-1 h-4 w-4" />
          接続を解除
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ig/IgTokenStatus.tsx
git commit -m "feat(ig-api): add IgTokenStatus component with refresh and disconnect"
```

---

### Task 12: Add Instagram API section to settings page

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Add IG settings section**

Add imports at the top of `settings/page.tsx`:

```typescript
import { IgConnectForm } from "@/components/ig/IgConnectForm";
import { IgTokenStatus } from "@/components/ig/IgTokenStatus";
```

Add state and fetch logic inside `SettingsPage` component, after existing state:

```typescript
const [igStatus, setIgStatus] = useState<{
  connected: boolean;
  igUserId?: string;
  connectedAccountName?: string;
  tokenExpiresAt?: string;
  daysRemaining?: number;
  expired?: boolean;
} | null>(null);

const fetchIgStatus = useCallback(async () => {
  try {
    const res = await fetch("/api/ig/token/status");
    const data = await res.json();
    setIgStatus(data);
  } catch {
    setIgStatus({ connected: false });
  }
}, []);

useEffect(() => {
  fetchIgStatus();
}, [fetchIgStatus]);
```

Add the Instagram section JSX before the accounts list (inside the return, after `<h1>設定</h1>`):

```tsx
{/* Instagram API Connection */}
<Card>
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <span>📸</span>
      Instagram API連携
    </CardTitle>
    <CardDescription>
      Instagram Graph APIで投稿の指標を自動取得します
    </CardDescription>
  </CardHeader>
  <CardContent>
    {igStatus === null ? (
      <div className="h-12 bg-muted animate-pulse rounded" />
    ) : igStatus.connected ? (
      <IgTokenStatus
        status={igStatus}
        onRefreshed={fetchIgStatus}
        onDisconnected={fetchIgStatus}
      />
    ) : (
      <IgConnectForm onConnected={fetchIgStatus} />
    )}
  </CardContent>
</Card>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\\(dashboard\\)/settings/page.tsx
git commit -m "feat(ig-api): add Instagram API section to settings page"
```

---

## Chunk 5: Import dialog & account page integration

### Task 13: IgImportDialog component

**Files:**
- Create: `src/components/ig/IgImportDialog.tsx`

- [ ] **Step 1: Create the import dialog**

This is the main user-facing component. It:
1. Fetches media list from `/api/ig/media`
2. Lets user select posts with checkboxes
3. Fetches insights for selected posts
4. Creates a snapshot with the imported posts

```tsx
"use client";

import { useState, useEffect } from "react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Check, AlertTriangle, Loader2 } from "lucide-react";
import {
  createSnapshotWithPosts,
  addPostsToSnapshot,
  type Snapshot,
  type Post,
} from "@/lib/firebase/firestore";
import { toPlatformId } from "@/lib/ig/mapper";
import { calculatePostKpis } from "@/lib/kpi/calculator";
import { getPlatformConfig } from "@/lib/platforms";
import { toast } from "sonner";

type IgMedia = {
  igMediaId: string;
  caption: string;
  mediaType: string;
  mediaProductType: string;
  timestamp: string;
  permalink: string;
  thumbnailUrl: string | null;
};

type InsightResult = {
  igMediaId: string;
  platformId: "ig_feed" | "ig_reel";
  metrics: Record<string, number>;
  caption: string;
  permalink: string;
  timestamp: string;
  thumbnailUrl: string | null;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ig_feed or ig_reel account ID in Firestore */
  accountId: string;
  accountPlatform: "ig_feed" | "ig_reel";
  /** Existing posts in current snapshot (for duplicate detection) */
  existingPermalinks: Set<string>;
  /** Existing snapshots for "add to" option */
  snapshots: Snapshot[];
  onComplete: () => void;
};

export function IgImportDialog({
  open,
  onOpenChange,
  accountId,
  accountPlatform,
  existingPermalinks,
  snapshots,
  onComplete,
}: Props) {
  const [media, setMedia] = useState<IgMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Date filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Save target
  const [saveMode, setSaveMode] = useState<"new" | "existing">("new");
  const [targetSnapshotId, setTargetSnapshotId] = useState<string>("");

  // Import results
  const [results, setResults] = useState<{
    success: InsightResult[];
    errors: Array<{ igMediaId: string; error: string }>;
  } | null>(null);

  // Fetch media list
  const fetchMedia = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/ig/media?limit=50");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "投稿一覧の取得に失敗しました");
        return;
      }
      setMedia(data.media ?? []);
      // Auto-select all non-duplicate, matching-platform posts
      const autoSelect = new Set<string>();
      for (const m of data.media ?? []) {
        const pid = toPlatformId(m.mediaType, m.mediaProductType);
        if (pid === accountPlatform && !existingPermalinks.has(m.permalink)) {
          autoSelect.add(m.igMediaId);
        }
      }
      setSelected(autoSelect);
    } catch {
      toast.error("投稿一覧の取得に失敗しました");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMedia();
      setResults(null);
    }
  }, [open]);

  // Filter media by date and platform
  const filteredMedia = media.filter((m) => {
    const pid = toPlatformId(m.mediaType, m.mediaProductType);
    if (pid !== accountPlatform) return false;

    if (dateFrom || dateTo) {
      const postDate = parseISO(m.timestamp);
      if (dateFrom && postDate < parseISO(dateFrom)) return false;
      if (dateTo) {
        const endOfDay = new Date(parseISO(dateTo));
        endOfDay.setHours(23, 59, 59, 999);
        if (postDate > endOfDay) return false;
      }
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = filteredMedia
      .filter((m) => !existingPermalinks.has(m.permalink))
      .map((m) => m.igMediaId);
    setSelected(new Set(ids));
  };

  const deselectAll = () => setSelected(new Set());

  // Import selected posts
  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);

    try {
      // Step 1: Fetch insights from API
      const res = await fetch("/api/ig/media/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "指標の取得に失敗しました");
        return;
      }

      const successResults: InsightResult[] = data.results ?? [];
      const errorResults = data.errors ?? [];

      if (successResults.length === 0) {
        toast.error("インポートできる投稿がありませんでした");
        setResults({ success: [], errors: errorResults });
        return;
      }

      // Step 2: Build Post objects
      const config = getPlatformConfig(accountPlatform);
      const now = Timestamp.now();

      const posts: Omit<Post, "id">[] = successResults.map((r) => ({
        postKey: r.igMediaId,
        title: r.caption.slice(0, 60) || undefined,
        publishedAt: Timestamp.fromDate(parseISO(r.timestamp)),
        capturedAt: now,
        permalink: r.permalink,
        tags: {},
        metrics: r.metrics,
        calculatedKpis: calculatePostKpis(config.kpis, r.metrics),
        source: "api" as const,
      }));

      // Step 3: Save to Firestore
      if (saveMode === "existing" && targetSnapshotId) {
        await addPostsToSnapshot(accountId, targetSnapshotId, posts);
      } else {
        // Determine period from post dates
        const dates = successResults.map((r) => parseISO(r.timestamp));
        const periodStart = new Date(Math.min(...dates.map((d) => d.getTime())));
        const periodEnd = new Date(Math.max(...dates.map((d) => d.getTime())));

        await createSnapshotWithPosts(
          accountId,
          {
            periodStart: Timestamp.fromDate(periodStart),
            periodEnd: Timestamp.fromDate(periodEnd),
            importedAt: now,
            label: `${format(periodStart, "M/d")}〜${format(periodEnd, "M/d")}`,
            postCount: posts.length,
            totals: posts.reduce(
              (acc, p) => {
                for (const [k, v] of Object.entries(p.metrics)) {
                  acc[k] = (acc[k] ?? 0) + v;
                }
                return acc;
              },
              {} as Record<string, number>
            ),
          },
          posts
        );
      }

      setResults({ success: successResults, errors: errorResults });
      toast.success(`${successResults.length}件の投稿をインポートしました`);

      if (errorResults.length === 0) {
        onComplete();
      }
    } catch {
      toast.error("インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Instagram投稿をインポート</DialogTitle>
        </DialogHeader>

        {/* Results view */}
        {results ? (
          <div className="space-y-4">
            {results.success.length > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {results.success.length}件インポート完了
                </span>
              </div>
            )}
            {results.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {results.errors.length}件エラー
                  </span>
                </div>
                {results.errors.map((e) => (
                  <p key={e.igMediaId} className="text-xs text-muted-foreground">
                    {e.igMediaId}: {e.error}
                  </p>
                ))}
              </div>
            )}
            <Button onClick={() => onOpenChange(false)} size="sm">
              閉じる
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Date filter */}
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">開始日</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-sm w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">終了日</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-sm w-36"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchMedia}
                disabled={fetching}
              >
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "投稿を取得"}
              </Button>
            </div>

            {/* Media list */}
            {fetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMedia.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                対象の投稿が見つかりません
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selected.size}件選択中 / {filteredMedia.length}件
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={selectAll} className="text-xs h-7">
                      すべて選択
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deselectAll} className="text-xs h-7">
                      選択解除
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {filteredMedia.map((m) => {
                    const isDuplicate = existingPermalinks.has(m.permalink);
                    const isSelected = selected.has(m.igMediaId);

                    return (
                      <label
                        key={m.igMediaId}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                          isDuplicate ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDuplicate}
                          onChange={() => toggleSelect(m.igMediaId)}
                          className="rounded"
                        />
                        <span className="text-lg">
                          {m.mediaProductType === "REELS" ? "🎬" : "📷"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {m.caption.slice(0, 40) || "(キャプションなし)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(m.timestamp), "M/d HH:mm")}
                          </p>
                        </div>
                        {isDuplicate && (
                          <Badge variant="secondary" className="text-xs">
                            インポート済み
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {/* Save target */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">保存先</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="saveMode"
                    checked={saveMode === "new"}
                    onChange={() => setSaveMode("new")}
                  />
                  新規スナップショットを作成
                </label>
                {snapshots.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="saveMode"
                      checked={saveMode === "existing"}
                      onChange={() => setSaveMode("existing")}
                    />
                    既存スナップショットに追加:
                    <select
                      value={targetSnapshotId}
                      onChange={(e) => setTargetSnapshotId(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                      disabled={saveMode !== "existing"}
                    >
                      <option value="">選択...</option>
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {/* Import button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={
                  importing ||
                  selected.size === 0 ||
                  (saveMode === "existing" && !targetSnapshotId)
                }
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    取得中...
                  </>
                ) : (
                  <>
                    <Download className="mr-1 h-4 w-4" />
                    指標を取得してインポート ({selected.size}件)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ig/IgImportDialog.tsx
git commit -m "feat(ig-api): add IgImportDialog for selecting and importing IG posts"
```

---

### Task 14: Integrate "APIから取得" button into account detail page

**Files:**
- Modify: `src/app/(dashboard)/accounts/[accountId]/page.tsx`

- [ ] **Step 1: Add imports**

Add at top of the file:

```typescript
import { Link2 } from "lucide-react";
import { IgImportDialog } from "@/components/ig/IgImportDialog";
```

- [ ] **Step 2: Add IG platform detection constant**

After the existing `CSV_PRIMARY_PLATFORMS` constant:

```typescript
/** Instagram platforms support API import */
const IG_API_PLATFORMS = new Set(["ig_feed", "ig_reel"]);
```

- [ ] **Step 3: Add state for IgImportDialog**

Inside `AccountDetailPage`, after the existing state declarations:

```typescript
const [igImportOpen, setIgImportOpen] = useState(false);
const [igConnected, setIgConnected] = useState(false);
```

Add an effect to check IG connection status:

```typescript
useEffect(() => {
  if (account && IG_API_PLATFORMS.has(account.platform)) {
    fetch("/api/ig/token/status")
      .then((r) => r.json())
      .then((data) => setIgConnected(data.connected ?? false))
      .catch(() => setIgConnected(false));
  }
}, [account]);
```

- [ ] **Step 4: Add the API import button**

In the header button section, add the API button for IG platforms. In the `else` branch (non-CSV-primary platforms), add after the existing CSV button:

```tsx
{IG_API_PLATFORMS.has(account.platform) && (
  igConnected ? (
    <Button size="sm" variant="outline" onClick={() => setIgImportOpen(true)}>
      <Link2 className="mr-1 h-4 w-4" />
      APIから取得
    </Button>
  ) : (
    <Link href="/settings">
      <Button size="sm" variant="outline">
        <Link2 className="mr-1 h-4 w-4" />
        API連携を設定
      </Button>
    </Link>
  )
)}
```

- [ ] **Step 5: Add the IgImportDialog at the bottom of the component**

Before the closing `</div>` of the return, after the ChannelSummaryDialog:

```tsx
{/* IG API Import Dialog */}
{account && IG_API_PLATFORMS.has(account.platform) && (
  <IgImportDialog
    open={igImportOpen}
    onOpenChange={setIgImportOpen}
    accountId={accountId}
    accountPlatform={account.platform as "ig_feed" | "ig_reel"}
    existingPermalinks={new Set(currentPosts.map((p) => p.permalink).filter(Boolean) as string[])}
    snapshots={snapshots}
    onComplete={() => {
      fetchData();
      setIgImportOpen(false);
    }}
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\\(dashboard\\)/accounts/\\[accountId\\]/page.tsx
git commit -m "feat(ig-api): add API import button and dialog to account detail page"
```

---

## Chunk 6: Token expiry warning & final polish

### Task 15: Token expiry warning in Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add token expiry warning banner**

Replace the contents of `Header.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { MobileSidebar } from "./Sidebar";

type Props = {
  children?: React.ReactNode;
};

export function Header({ children }: Props) {
  const [tokenWarning, setTokenWarning] = useState<{
    show: boolean;
    daysRemaining: number;
    expired: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/ig/token/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && (data.expired || (data.daysRemaining ?? 99) <= 7)) {
          setTokenWarning({
            show: true,
            daysRemaining: data.daysRemaining ?? 0,
            expired: data.expired ?? false,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {tokenWarning?.show && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">
            {tokenWarning.expired
              ? "Instagram APIトークンが期限切れです。"
              : `Instagram APIトークンの期限が残り${tokenWarning.daysRemaining}日です。`}
          </span>
          <Link href="/settings" className="text-destructive underline font-medium">
            設定で更新
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background px-4 py-3 md:px-6">
        <MobileSidebar />
        <div className="flex-1 flex items-center gap-4">
          {children}
        </div>
      </header>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(ig-api): add token expiry warning banner to header"
```

---

### Task 16: Add DELETE handler to token exchange route (for disconnect)

**Files:**
- Modify: `src/app/api/ig/token/exchange/route.ts`

- [ ] **Step 1: Add DELETE handler**

Append to the existing `exchange/route.ts`:

```typescript
export async function DELETE() {
  try {
    await deleteToken();
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
```

Update the import at the top to include `deleteToken`:

```typescript
import {
  exchangeToken,
  getIgBusinessAccountId,
  saveToken,
  deleteToken,
  errorResponse,
} from "../../lib";
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/token/exchange/route.ts
git commit -m "feat(ig-api): add DELETE handler for token disconnect"
```

---

### Task 17: Verify build passes

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: Run Next.js build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 3: Fix any type errors**

If there are errors, fix them and commit:

```bash
git add -A
git commit -m "fix(ig-api): resolve build errors"
```

---

### Task 18: Update project-status.md

- [ ] **Step 1: Update Phase 1.5 status in `project-status.md`**

Update the Phase 1.5 section to reflect implementation complete:

```markdown
### Phase 1.5: Instagram Graph API連携（実装完了 — 要Metaアプリセットアップ）

- [x] API Route層（token exchange/refresh/status, media list, media insights）
- [x] IgImportDialog（投稿選択 + 指標一括取得 + スナップショット保存）
- [x] 設定画面にAPI連携セクション追加
- [x] トークン期限警告バナー
- [ ] Metaアプリ作成 + 本番テスト（手動セットアップ必要）
```

- [ ] **Step 2: Commit**

```bash
git add project-status.md
git commit -m "docs: update project-status with Phase 1.5 implementation status"
```
