# IG月サマリー取得 & 週次比較 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two one-click buttons to IG account pages: "月サマリー取得" (fetch channel-level monthly summary from IG API) and "週次比較" (auto-generate two weekly snapshots and compare them).

**Architecture:** Extend the existing Snapshot model — monthly summary populates `channelSummary`, weekly comparison creates two Snapshots via existing `createSnapshotWithPosts()`. Add pagination to the media endpoint to handle >50 posts. All new logic lives in one new API route + modifications to existing files.

**Tech Stack:** Next.js API Routes, Instagram Graph API v22.0, Firebase Firestore, React (existing stack)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/api/ig/account/insights/route.ts` | Create | Account Insights API Route — fetches channel-level metrics for a date range |
| `src/app/api/ig/media/route.ts` | Modify | Add cursor-based pagination with date-boundary cutoff |
| `src/lib/ig/mapper.ts` | Modify | Add `mapAccountInsights()` for channel-level metric mapping |
| `src/app/(dashboard)/accounts/[accountId]/page.tsx` | Modify | Add "月サマリー取得" and "週次比較" buttons + handler logic |

---

### Task 1: Add `mapAccountInsights()` to mapper

**Files:**
- Modify: `src/lib/ig/mapper.ts`

- [ ] **Step 1: Add the mapping function**

Append to `src/lib/ig/mapper.ts`:

```typescript
/**
 * IG Account Insights API returns daily values for each metric.
 * Sum daily values for impressions/reach, compute follower delta from follower_count.
 */
type AccountInsightEntry = {
  name: string;
  values: Array<{ value: number; end_time: string }>;
};

export function mapAccountInsights(
  insights: AccountInsightEntry[]
): Record<string, number> {
  const summary: Record<string, number> = {};

  for (const metric of insights) {
    const values = metric.values.map((v) => v.value);
    if (values.length === 0) continue;

    switch (metric.name) {
      case "impressions":
        summary.impressions = values.reduce((a, b) => a + b, 0);
        break;
      case "reach":
        summary.reach = values.reduce((a, b) => a + b, 0);
        break;
      case "follower_count":
        // Daily snapshots — delta = last - first
        summary.follows = values[values.length - 1] - values[0];
        break;
    }
  }

  return summary;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ig/mapper.ts
git commit -m "feat(ig): add mapAccountInsights for channel-level metrics"
```

---

### Task 2: Create Account Insights API Route

**Files:**
- Create: `src/app/api/ig/account/insights/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/ig/account/insights/route.ts`:

```typescript
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
      `${GRAPH_API_BASE}/${stored.igUserId}/insights?metric=impressions,reach,follower_count&period=day&since=${since}&until=${until}`,
      stored.accessToken
    );

    const summary = mapAccountInsights(data.data ?? []);

    return Response.json({ summary });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/account/insights/route.ts
git commit -m "feat(ig): add Account Insights API route for channel-level metrics"
```

---

### Task 3: Add pagination to media endpoint

**Files:**
- Modify: `src/app/api/ig/media/route.ts`

- [ ] **Step 1: Replace the GET handler with paginated version**

Replace the entire content of `src/app/api/ig/media/route.ts`:

```typescript
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
      const data = await igFetch<MediaPage>(url, stored.accessToken);

      for (const m of data.data ?? []) {
        if (sinceDate && new Date(m.timestamp) < sinceDate) {
          reachedBoundary = true;
          break;
        }
        allMedia.push(m);
      }

      url = data.paging?.next ?? null;
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
```

**Key changes from original:**
- Follows `paging.next` cursor for up to 4 pages (200 posts max)
- New `since` query param: stops fetching when posts are older than this date
- Existing callers (IgImportDialog) continue to work without `since` param (fetches up to 200 instead of 50)

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ig/media/route.ts
git commit -m "feat(ig): add pagination with date boundary to media endpoint"
```

---

### Task 4: Add "月サマリー取得" button and handler

**Files:**
- Modify: `src/app/(dashboard)/accounts/[accountId]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add `CalendarSearch` and `GitCompareArrows` to the lucide-react import:

```typescript
import { Upload, ArrowLeft, PenLine, BarChart3, Link2, Download, Presentation, CalendarSearch, GitCompareArrows } from "lucide-react";
```

Add `updateSnapshot` to the firestore import:

```typescript
import {
  getAccount,
  getSnapshots,
  getSnapshotPosts,
  deleteSnapshot,
  updateSnapshot,
  updateSnapshotPost,
  type Account,
  type Post,
  type Snapshot,
} from "@/lib/firebase/firestore";
```

- [ ] **Step 2: Add state and handler for monthly summary**

After the `igConnected` state declaration (line ~67), add:

```typescript
const [fetchingSummary, setFetchingSummary] = useState(false);
```

After the `useEffect` for thumbnail backfill (~line 226), add:

```typescript
const handleFetchMonthlySummary = async () => {
  if (!selectedSnapshot || !selectedSnapshotId) return;
  setFetchingSummary(true);
  try {
    const res = await fetch("/api/ig/account/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        periodStart: selectedSnapshot.periodStart.toDate().toISOString(),
        periodEnd: selectedSnapshot.periodEnd.toDate().toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "サマリー取得に失敗しました");
      return;
    }
    await updateSnapshot(accountId, selectedSnapshotId, {
      channelSummary: data.summary,
    });
    // Update local state
    const updated = { ...selectedSnapshot, channelSummary: data.summary };
    setSnapshots((prev) =>
      prev.map((s) => (s.id === selectedSnapshotId ? updated : s))
    );
    toast.success("月サマリーを取得しました");
  } catch {
    toast.error("サマリー取得に失敗しました");
  } finally {
    setFetchingSummary(false);
  }
};
```

- [ ] **Step 3: Add the button to the UI**

In the button section (~line 301-316), after the existing IG `APIから取得` button block, add inside the same `igConnected` condition:

Find this block:
```tsx
igConnected ? (
  <Button size="sm" variant="outline" onClick={() => setIgImportOpen(true)}>
    <Link2 className="mr-1 h-4 w-4" />
    APIから取得
  </Button>
```

Replace with:
```tsx
igConnected ? (
  <>
    <Button size="sm" variant="outline" onClick={() => setIgImportOpen(true)}>
      <Link2 className="mr-1 h-4 w-4" />
      APIから取得
    </Button>
    {selectedSnapshot && (
      <Button
        size="sm"
        variant="outline"
        onClick={handleFetchMonthlySummary}
        disabled={fetchingSummary}
      >
        {fetchingSummary ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
        ) : (
          <CalendarSearch className="mr-1 h-4 w-4" />
        )}
        月サマリー取得
      </Button>
    )}
  </>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/accounts/[accountId]/page.tsx
git commit -m "feat(ig): add monthly summary fetch button"
```

---

### Task 5: Add "週次比較" button and handler

**Files:**
- Modify: `src/app/(dashboard)/accounts/[accountId]/page.tsx`

- [ ] **Step 1: Add state and helpers**

After `fetchingSummary` state, add:

```typescript
const [fetchingWeekly, setFetchingWeekly] = useState(false);
```

Add `Timestamp` import to firestore imports:

```typescript
import { Timestamp } from "firebase/firestore";
```

Add `createSnapshotWithPosts` to the firestore import:

```typescript
import {
  getAccount,
  getSnapshots,
  getSnapshotPosts,
  deleteSnapshot,
  updateSnapshot,
  createSnapshotWithPosts,
  updateSnapshotPost,
  type Account,
  type Post,
  type Snapshot,
} from "@/lib/firebase/firestore";
```

Add helper imports at top of file:

```typescript
import { toPlatformId } from "@/lib/ig/mapper";
import { calculatePostKpis } from "@/lib/kpi/calculator";
```

- [ ] **Step 2: Add week calculation helper**

After the `filterAggregate` function (~line 51), add:

```typescript
/** Get Monday 00:00 of the week containing the given date */
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7); // Monday = 0
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Format a snapshot label like "2026年 3/31〜4/6" */
function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const y = monday.getFullYear();
  return `${y}年 ${monday.getMonth() + 1}/${monday.getDate()}〜${sunday.getMonth() + 1}/${sunday.getDate()}`;
}
```

- [ ] **Step 3: Add the weekly comparison handler**

After `handleFetchMonthlySummary`, add:

```typescript
const handleWeeklyComparison = async () => {
  if (!account || !igConnected) return;
  setFetchingWeekly(true);

  try {
    const today = new Date();
    const thisMonday = getMonday(today);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    // Fetch media with pagination, going back at least 2 weeks
    const sinceDate = new Date(lastMonday);
    sinceDate.setDate(sinceDate.getDate() - 1); // 1 day buffer
    toast.info("投稿を取得中...");

    const mediaRes = await fetch(
      `/api/ig/media?limit=50&accountId=${accountId}&since=${sinceDate.toISOString()}`
    );
    const mediaData = await mediaRes.json();
    if (!mediaRes.ok) {
      toast.error(mediaData.error ?? "投稿取得に失敗しました");
      return;
    }

    const allMedia: Array<{
      igMediaId: string;
      caption: string;
      mediaType: string;
      mediaProductType: string;
      timestamp: string;
      permalink: string;
      thumbnailUrl: string | null;
    }> = mediaData.media ?? [];

    // Split into this week and last week, filtering by platform
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    thisSunday.setHours(23, 59, 59, 999);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const thisWeekMedia = allMedia.filter((m) => {
      const d = new Date(m.timestamp);
      return (
        toPlatformId(m.mediaType, m.mediaProductType) === account.platform &&
        d >= thisMonday && d <= thisSunday
      );
    });
    const lastWeekMedia = allMedia.filter((m) => {
      const d = new Date(m.timestamp);
      return (
        toPlatformId(m.mediaType, m.mediaProductType) === account.platform &&
        d >= lastMonday && d <= lastSunday
      );
    });

    // Check for existing snapshots with same label
    const thisLabel = weekLabel(thisMonday);
    const lastLabel = weekLabel(lastMonday);
    const existingThis = snapshots.find((s) => s.label === thisLabel);
    const existingLast = snapshots.find((s) => s.label === lastLabel);

    // Fetch insights for media that needs new snapshots
    const config = getPlatformConfig(account.platform);

    async function fetchInsightsAndCreateSnapshot(
      media: typeof allMedia,
      monday: Date,
      label: string
    ): Promise<string> {
      if (media.length === 0) {
        // Create empty snapshot
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return createSnapshotWithPosts(
          accountId,
          {
            periodStart: Timestamp.fromDate(monday),
            periodEnd: Timestamp.fromDate(sunday),
            importedAt: Timestamp.now(),
            label,
            postCount: 0,
            totals: {},
          },
          []
        );
      }

      toast.info(`${label} のinsightsを取得中...`);
      const ids = media.map((m) => m.igMediaId);
      const insightsRes = await fetch("/api/ig/media/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: ids, accountId }),
      });
      const insightsData = await insightsRes.json();
      if (!insightsRes.ok) {
        throw new Error(insightsData.error ?? "Insights取得に失敗");
      }

      const results: Array<{
        igMediaId: string;
        metrics: Record<string, number>;
        caption: string;
        permalink: string;
        timestamp: string;
        thumbnailUrl: string | null;
      }> = insightsData.results ?? [];

      const posts: Omit<Post, "id">[] = results.map((r) => ({
        postKey: r.igMediaId,
        title: r.caption.slice(0, 60) || undefined,
        publishedAt: Timestamp.fromDate(new Date(r.timestamp)),
        capturedAt: Timestamp.now(),
        permalink: r.permalink,
        thumbnailUrl: r.thumbnailUrl ?? undefined,
        tags: {},
        metrics: r.metrics,
        calculatedKpis: calculatePostKpis(config.kpis, r.metrics),
        source: "api" as const,
      }));

      const totals: Record<string, number> = {};
      for (const p of posts) {
        for (const [key, val] of Object.entries(p.metrics)) {
          totals[key] = (totals[key] ?? 0) + val;
        }
      }

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      return createSnapshotWithPosts(
        accountId,
        {
          periodStart: Timestamp.fromDate(monday),
          periodEnd: Timestamp.fromDate(sunday),
          importedAt: Timestamp.now(),
          label,
          postCount: posts.length,
          totals,
        },
        posts
      );
    }

    const lastId = existingLast?.id ??
      await fetchInsightsAndCreateSnapshot(lastWeekMedia, lastMonday, lastLabel);
    const thisId = existingThis?.id ??
      await fetchInsightsAndCreateSnapshot(thisWeekMedia, thisMonday, thisLabel);

    // Reload and select for comparison
    await fetchData();
    setSelectedSnapshotId(thisId);
    const thisPosts = await getSnapshotPosts(accountId, thisId);
    setCurrentPosts(filterAggregate(thisPosts));
    setCompareSnapshotId(lastId);
    const lastPosts = await getSnapshotPosts(accountId, lastId);
    setComparePosts(filterAggregate(lastPosts));

    toast.success("週次比較を生成しました");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "週次比較の生成に失敗しました");
  } finally {
    setFetchingWeekly(false);
  }
};
```

- [ ] **Step 4: Add the button to the UI**

After the `月サマリー取得` button (added in Task 4), add:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={handleWeeklyComparison}
  disabled={fetchingWeekly}
>
  {fetchingWeekly ? (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
  ) : (
    <GitCompareArrows className="mr-1 h-4 w-4" />
  )}
  週次比較
</Button>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/accounts/[accountId]/page.tsx
git commit -m "feat(ig): add weekly comparison one-click button"
```

---

### Task 6: Integration test — verify end-to-end

**Files:**
- No file changes — manual verification

- [ ] **Step 1: Test monthly summary**

1. Open an IG account page with an existing snapshot
2. Click "月サマリー取得"
3. Verify: toast success, KpiCardGrid shows "チャンネル全体" row
4. Verify: `channelSummary` is populated in Firestore

- [ ] **Step 2: Test weekly comparison**

1. Click "週次比較"
2. Verify: progress toasts appear ("投稿を取得中...", "先週分のinsights取得中...", etc.)
3. Verify: two snapshots are created with week labels
4. Verify: comparison tab opens showing the two weeks side by side
5. Click "週次比較" again — verify it reuses existing snapshots (no duplicates)

- [ ] **Step 3: Test pagination**

1. Use an account with >50 posts in the last 2 weeks (or modify `MAX_PAGES` temporarily)
2. Open IgImportDialog and verify more than 50 posts are listed
3. Verify the `since` parameter correctly stops pagination

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(ig): integration fixes for monthly summary and weekly comparison"
```
