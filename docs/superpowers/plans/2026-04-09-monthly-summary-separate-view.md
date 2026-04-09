# 月次サマリー独立ビュー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate monthly summaries from snapshots into an independent Firestore collection with a dedicated "月次サマリー" tab in the account detail page.

**Architecture:** New `monthlySummaries` subcollection under each account with CRUD functions. New `MonthlySummaryPanel` component displayed in a tab. Simplify `KpiCardGrid` and `SnapshotComparisonCard` by removing dual-perspective logic. Redirect "月サマリー取得" button to save to the new collection.

**Tech Stack:** Firebase Firestore, Next.js, React, Recharts (existing stack)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/firebase/firestore.ts` | Modify | Add `MonthlySummary` type + CRUD functions |
| `src/components/kpi/MonthlySummaryPanel.tsx` | Create | Tab content: summary table, trend chart, month comparison |
| `src/app/(dashboard)/accounts/[accountId]/page.tsx` | Modify | Add tab, change button handler, remove channelSummary logic |
| `src/components/kpi/KpiCardGrid.tsx` | Modify | Remove dual-perspective display |
| `src/components/kpi/SnapshotComparisonCard.tsx` | Modify | Remove mixed-source fallback |

---

### Task 1: Add MonthlySummary type and CRUD to Firestore

**Files:**
- Modify: `src/lib/firebase/firestore.ts`

- [ ] **Step 1: Add MonthlySummary type and collection ref**

After the Snapshot section (~line 163), add:

```typescript
// ---- Monthly Summaries ----

export type MonthlySummary = {
  id?: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  label: string;
  metrics: Record<string, number>;
  importedAt: Timestamp;
};

function monthlySummariesRef(accountId: string) {
  return collection(db(), "accounts", accountId, "monthlySummaries");
}
```

- [ ] **Step 2: Add CRUD functions**

After the ref function, add:

```typescript
export async function getMonthlySummaries(accountId: string): Promise<MonthlySummary[]> {
  const snap = await getDocs(monthlySummariesRef(accountId));
  const summaries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MonthlySummary);
  return summaries.sort((a, b) => {
    const aTime = b.periodEnd?.toDate?.()?.getTime() ?? 0;
    const bTime = a.periodEnd?.toDate?.()?.getTime() ?? 0;
    return aTime - bTime;
  });
}

export async function createMonthlySummary(
  accountId: string,
  data: Omit<MonthlySummary, "id">
): Promise<string> {
  const ref = await addDoc(monthlySummariesRef(accountId), data);
  return ref.id;
}

export async function updateMonthlySummary(
  accountId: string,
  summaryId: string,
  data: Partial<Omit<MonthlySummary, "id">>
): Promise<void> {
  await updateDoc(
    doc(db(), "accounts", accountId, "monthlySummaries", summaryId),
    data as DocumentData
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/firestore.ts
git commit -m "feat: add MonthlySummary type and CRUD functions"
```

---

### Task 2: Create MonthlySummaryPanel component

**Files:**
- Create: `src/components/kpi/MonthlySummaryPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/kpi/MonthlySummaryPanel.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MonthlySummary } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";

type Props = {
  summaries: MonthlySummary[];
  config: PlatformConfig;
};

export function MonthlySummaryPanel({ summaries, config }: Props) {
  const [selectedMetric, setSelectedMetric] = useState("reach");

  // Metrics available for this platform (filter to those with data)
  const availableMetrics = useMemo(() => {
    const metricsWithData = new Set<string>();
    for (const s of summaries) {
      for (const [key, val] of Object.entries(s.metrics)) {
        if (val != null && val !== 0) metricsWithData.add(key);
      }
    }
    return config.metrics.filter((m) => metricsWithData.has(m.key));
  }, [summaries, config.metrics]);

  // Sort chronologically (oldest first) for chart
  const sortedSummaries = useMemo(
    () =>
      [...summaries].sort((a, b) => {
        const aTime = a.periodEnd?.toDate?.()?.getTime() ?? 0;
        const bTime = b.periodEnd?.toDate?.()?.getTime() ?? 0;
        return aTime - bTime;
      }),
    [summaries]
  );

  // Chart data
  const chartData = useMemo(
    () =>
      sortedSummaries.map((s) => ({
        label: s.label,
        value: s.metrics[selectedMetric] ?? 0,
      })),
    [sortedSummaries, selectedMetric]
  );

  // Latest two for comparison
  const current = summaries[0] ?? null;
  const previous = summaries[1] ?? null;

  if (summaries.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
        <p className="text-lg mb-2">月次サマリーがありません</p>
        <p className="text-sm">「月サマリー取得」ボタンでInstagram APIから取得してください</p>
      </div>
    );
  }

  const selectedLabel =
    availableMetrics.find((m) => m.key === selectedMetric)?.label ?? selectedMetric;
  const selectedColor = "#2563eb";

  return (
    <div className="space-y-6">
      {/* Month comparison (latest 2) */}
      {current && previous && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">月次比較</CardTitle>
            <p className="text-xs text-muted-foreground">
              {previous.label} → {current.label}
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">指標</th>
                    <th className="text-right px-3 py-2 font-medium">{previous.label}</th>
                    <th className="text-right px-3 py-2 font-medium">{current.label}</th>
                    <th className="text-right px-3 py-2 font-medium">差分</th>
                    <th className="text-right px-3 py-2 font-medium">変化率</th>
                  </tr>
                </thead>
                <tbody>
                  {availableMetrics.map((m) => {
                    const curVal = current.metrics[m.key] ?? 0;
                    const prevVal = previous.metrics[m.key] ?? 0;
                    const diff = curVal - prevVal;
                    const pctChange =
                      prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : null;
                    const isPositive = diff > 0;

                    return (
                      <tr key={m.key} className="border-t">
                        <td className="px-3 py-1.5">{m.label}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {prevVal.toLocaleString("ja-JP")}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium">
                          {curVal.toLocaleString("ja-JP")}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right ${isPositive ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}
                        >
                          {isPositive ? "+" : ""}
                          {diff.toLocaleString("ja-JP")}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right ${isPositive ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}
                        >
                          {pctChange != null
                            ? `${isPositive ? "+" : ""}${pctChange.toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend chart */}
      {sortedSummaries.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">月次推移</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 mb-4">
              {availableMetrics.map((m) => (
                <Button
                  key={m.key}
                  size="sm"
                  variant={selectedMetric === m.key ? "default" : "outline"}
                  onClick={() => setSelectedMetric(m.key)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [
                    value.toLocaleString("ja-JP"),
                    selectedLabel,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={selectedColor}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary table (all months) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">全サマリー</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">期間</th>
                  {availableMetrics.map((m) => (
                    <th key={m.key} className="text-right px-3 py-2 font-medium">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{s.label}</td>
                    {availableMetrics.map((m) => (
                      <td key={m.key} className="px-3 py-1.5 text-right">
                        {(s.metrics[m.key] ?? 0).toLocaleString("ja-JP")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/kpi/MonthlySummaryPanel.tsx
git commit -m "feat: add MonthlySummaryPanel component for monthly summary tab"
```

---

### Task 3: Simplify KpiCardGrid — remove dual-perspective

**Files:**
- Modify: `src/components/kpi/KpiCardGrid.tsx`

- [ ] **Step 1: Remove channelSummary logic**

Replace the entire `KpiCardGrid` component body (lines 16-133) with:

```tsx
export function KpiCardGrid({ posts, kpiDefs, targets }: Omit<Props, "snapshot">) {
  if (posts.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {kpiDefs.map((kpi) => (
          <Card key={kpi.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-1">データなし</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const postKpis = calculateWeightedKpis(kpiDefs, posts.map((p) => p.metrics));

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {kpiDefs.map((kpi) => {
        const postValue = postKpis[kpi.key];
        const target = targets[kpi.key];
        const higherIsBetter = kpi.higherIsBetter ?? true;

        let status: "good" | "bad" | "neutral" = "neutral";
        if (postValue != null && target != null) {
          status = (higherIsBetter ? postValue >= target : postValue <= target)
            ? "good"
            : "bad";
        }

        return (
          <Card key={kpi.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">
                  {formatKpiValue(postValue, kpi.format)}
                </p>
                {status === "good" && <TrendingUp className="h-4 w-4 text-green-600" />}
                {status === "bad" && <TrendingDown className="h-4 w-4 text-red-600" />}
                {status === "neutral" && <Minus className="h-4 w-4 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {target != null && <>目標: {formatKpiValue(target, kpi.format)} ・ </>}
                初動集計({posts.length}件)
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

Also update the Props type and imports — remove `Snapshot` import and `snapshot` prop:

```tsx
import type { Post } from "@/lib/firebase/firestore";
// Remove: import type { Post, Snapshot } from "@/lib/firebase/firestore";

type Props = {
  posts: Post[];
  kpiDefs: KpiDefinition[];
  targets: Record<string, number>;
};
// Remove snapshot from Props
```

Remove unused import `calculatePostKpis` — only `calculateWeightedKpis` and `formatKpiValue` are needed.

- [ ] **Step 2: Commit**

```bash
git add src/components/kpi/KpiCardGrid.tsx
git commit -m "refactor: simplify KpiCardGrid to show only initial performance"
```

---

### Task 4: Simplify SnapshotComparisonCard — remove channelSummary fallback

**Files:**
- Modify: `src/components/kpi/SnapshotComparisonCard.tsx`

- [ ] **Step 1: Simplify getMetricTotals and resolveKpis**

Replace `getMetricTotals` function (lines 25-29) with:

```typescript
function getMetricTotals(snapshot: Snapshot): Record<string, number> {
  return snapshot.totals;
}
```

Replace `resolveKpis` function (lines 32-42) with:

```typescript
function resolveKpis(
  kpiDefs: KpiDefinition[],
  posts: Post[]
): Record<string, number> {
  return calculateWeightedKpis(kpiDefs, posts.map((p) => p.metrics));
}
```

- [ ] **Step 2: Update usages in the component**

In the component body, update:

```typescript
const currentKpis = resolveKpis(kpiDefs, currentPosts);
const compareKpis = resolveKpis(kpiDefs, comparePosts);

const curTotals = getMetricTotals(currentSnapshot);
const prevTotals = getMetricTotals(compareSnapshot);
```

Remove the `sourcesMixed` warning, `curSourceLabel`/`prevSourceLabel` badges, and the `isChannelLevel` logic. Remove column header badges. Remove the `calculatePostKpis` import.

Remove the KPI section subtitle that says `（チャンネル全体）` or `（初動集計）` — just show `KPI`.

- [ ] **Step 3: Commit**

```bash
git add src/components/kpi/SnapshotComparisonCard.tsx
git commit -m "refactor: simplify SnapshotComparisonCard to use only post totals"
```

---

### Task 5: Wire up account page — tab, button handler, cleanup

**Files:**
- Modify: `src/app/(dashboard)/accounts/[accountId]/page.tsx`

- [ ] **Step 1: Add imports**

Add to the firestore imports:

```typescript
import {
  // ... existing imports ...
  getMonthlySummaries,
  createMonthlySummary,
  type MonthlySummary,
} from "@/lib/firebase/firestore";
```

Add component import:

```typescript
import { MonthlySummaryPanel } from "@/components/kpi/MonthlySummaryPanel";
```

- [ ] **Step 2: Add monthlySummaries state**

After the `allPermalinks` state:

```typescript
const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
```

- [ ] **Step 3: Fetch monthly summaries in fetchData**

Inside `fetchData`, after snapshots are loaded (after `setAllPermalinks`), add:

```typescript
// Load monthly summaries
if (acc && IG_API_PLATFORMS.has(acc.platform)) {
  try {
    const ms = await getMonthlySummaries(accountId);
    setMonthlySummaries(ms);
  } catch {
    console.warn("月次サマリー取得スキップ");
  }
}
```

- [ ] **Step 4: Change handleFetchMonthlySummary to save to monthlySummaries**

Replace the entire `handleFetchMonthlySummary` function with:

```typescript
const handleFetchMonthlySummary = async () => {
  if (!account) return;
  setFetchingSummary(true);
  try {
    // Default period: previous month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month

    const res = await fetch("/api/ig/account/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "サマリー取得に失敗しました");
      return;
    }

    const label = `${periodStart.getFullYear()}年 ${periodStart.getMonth() + 1}月`;

    // Check for existing summary with same label — update if exists
    const existing = monthlySummaries.find((s) => s.label === label);
    if (existing?.id) {
      await updateMonthlySummary(accountId, existing.id, {
        metrics: data.summary,
        importedAt: Timestamp.now(),
      });
    } else {
      await createMonthlySummary(accountId, {
        periodStart: Timestamp.fromDate(periodStart),
        periodEnd: Timestamp.fromDate(periodEnd),
        label,
        metrics: data.summary,
        importedAt: Timestamp.now(),
      });
    }

    // Reload summaries
    const ms = await getMonthlySummaries(accountId);
    setMonthlySummaries(ms);
    toast.success(`${label} のサマリーを取得しました`);
  } catch {
    toast.error("サマリー取得に失敗しました");
  } finally {
    setFetchingSummary(false);
  }
};
```

Also add `updateMonthlySummary` to the firestore import.

- [ ] **Step 5: Remove selectedSnapshot dependency from 月サマリー取得 button**

In the button section, change:

```tsx
{selectedSnapshot && (
  <Button
    size="sm"
    variant="outline"
    onClick={handleFetchMonthlySummary}
    disabled={fetchingSummary}
  >
```

To:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={handleFetchMonthlySummary}
  disabled={fetchingSummary}
>
```

(Remove the `{selectedSnapshot &&` wrapper)

- [ ] **Step 6: Remove channelSummaryOpen state and ChannelSummaryDialog**

Remove:
- `const [channelSummaryOpen, setChannelSummaryOpen] = useState(false);`
- The `ChannelSummaryDialog` import
- The `ChannelSummaryDialog` JSX block
- The "サマリー手動入力" item from the "追加" dropdown menu
- The `BarChart3` import (if unused after removal)

- [ ] **Step 7: Update KpiCardGrid usage — remove snapshot prop**

Change:

```tsx
<KpiCardGrid
  posts={currentPosts}
  kpiDefs={config.kpis}
  targets={account.targets}
  snapshot={selectedSnapshot}
/>
```

To:

```tsx
<KpiCardGrid
  posts={currentPosts}
  kpiDefs={config.kpis}
  targets={account.targets}
/>
```

- [ ] **Step 8: Add 月次サマリー tab**

In the `<Tabs>` section, add the tab trigger:

```tsx
{IG_API_PLATFORMS.has(account.platform) && igConnected && (
  <TabsTrigger value="monthly">月次サマリー</TabsTrigger>
)}
```

Add the tab content (before the `guide` tab content):

```tsx
{IG_API_PLATFORMS.has(account.platform) && igConnected && (
  <TabsContent value="monthly" className="mt-4">
    <MonthlySummaryPanel summaries={monthlySummaries} config={config} />
  </TabsContent>
)}
```

- [ ] **Step 9: Commit**

```bash
git add "src/app/(dashboard)/accounts/[accountId]/page.tsx"
git commit -m "feat: wire up monthly summary tab and redirect button to new collection"
```

---

### Task 6: Verify build and push

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Successful build.

- [ ] **Step 3: Push**

```bash
git push
```
