# IG週次レポートビュー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a print-ready A4 report page for IG accounts that generates a 3-page weekly report with period comparison, post listings, and trend analysis.

**Architecture:** New `/accounts/{id}/report` page with 3 report page components. Print CSS for A4 output. Report text (highlight, analysis, actions) saved to Firestore `reports` collection. Data fetched from existing IG API endpoints and `monthlySummaries`.

**Tech Stack:** Next.js App Router, Firebase Firestore, Recharts, CSS `@media print`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/firebase/firestore.ts` | Modify | Add `Report` type + CRUD |
| `src/components/report/report-print.css` | Create | A4 print CSS |
| `src/components/report/ReportPage1.tsx` | Create | Summary page |
| `src/components/report/ReportPage2.tsx` | Create | Posts page |
| `src/components/report/ReportPage3.tsx` | Create | Trends + analysis page |
| `src/app/(dashboard)/accounts/[accountId]/report/page.tsx` | Create | Report route — data fetching, period picker, print button |
| `src/app/(dashboard)/accounts/[accountId]/page.tsx` | Modify | Add "レポート作成" link |

---

### Task 1: Add Report type and CRUD to Firestore

**Files:**
- Modify: `src/lib/firebase/firestore.ts`

- [ ] **Step 1: Add Report type and functions**

After the MonthlySummary section, add:

```typescript
// ---- Reports ----

export type Report = {
  id?: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  highlight: string;
  analysis: string;
  nextActions: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

function reportsRef(accountId: string) {
  return collection(db(), "accounts", accountId, "reports");
}

export async function getReport(
  accountId: string,
  reportId: string
): Promise<Report | null> {
  const snap = await getDoc(doc(db(), "accounts", accountId, "reports", reportId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Report;
}

export async function getReports(accountId: string): Promise<Report[]> {
  const snap = await getDocs(reportsRef(accountId));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Report)
    .sort((a, b) => (b.updatedAt?.toDate?.()?.getTime() ?? 0) - (a.updatedAt?.toDate?.()?.getTime() ?? 0));
}

export async function saveReport(
  accountId: string,
  reportId: string | null,
  data: Omit<Report, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  if (reportId) {
    await updateDoc(
      doc(db(), "accounts", accountId, "reports", reportId),
      { ...data, updatedAt: Timestamp.now() } as DocumentData
    );
    return reportId;
  }
  const ref = await addDoc(reportsRef(accountId), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/firebase/firestore.ts
git commit -m "feat: add Report type and CRUD functions"
```

---

### Task 2: Create print CSS

**Files:**
- Create: `src/components/report/report-print.css`

- [ ] **Step 1: Create the CSS file**

```css
/* A4 Report Print Styles */

.report-container {
  font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", sans-serif;
  color: #1a1a1a;
}

.report-page {
  width: 210mm;
  min-height: 297mm;
  padding: 12mm 16mm;
  background: white;
  position: relative;
  box-sizing: border-box;
}

/* Screen: show as stacked cards */
@media screen {
  .report-page {
    margin: 0 auto 2rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .report-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
    border-bottom: 1px solid #eee;
  }
}

/* Print: A4 pages with page breaks */
@media print {
  @page {
    size: A4;
    margin: 0;
  }

  body {
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-controls {
    display: none !important;
  }

  .report-page {
    margin: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
    page-break-after: always;
  }

  .report-page:last-child {
    page-break-after: auto;
  }

  /* Hide textareas, show their content */
  .report-editable-textarea {
    display: none !important;
  }

  .report-editable-display {
    display: block !important;
  }
}

/* Screen: show textareas, hide display */
@media screen {
  .report-editable-display {
    display: none !important;
  }
}

/* Page footer */
.report-page-footer {
  position: absolute;
  bottom: 8mm;
  left: 16mm;
  right: 16mm;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: #ccc;
}

/* Shared table styles */
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

.report-table th {
  text-align: left;
  padding: 6px 4px;
  color: #888;
  font-weight: 600;
  border-bottom: 1px solid #ddd;
}

.report-table th.num {
  text-align: right;
}

.report-table td {
  padding: 6px 4px;
  border-bottom: 1px solid #f0f0f0;
}

.report-table td.num {
  text-align: right;
}

.report-table tfoot td {
  border-top: 2px solid #1a1a1a;
  font-weight: 700;
  border-bottom: none;
}

.text-positive { color: #16a34a; font-weight: 600; }
.text-negative { color: #dc2626; font-weight: 600; }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/report-print.css
git commit -m "feat: add A4 print CSS for report pages"
```

---

### Task 3: Create ReportPage1 (Summary)

**Files:**
- Create: `src/components/report/ReportPage1.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { Account } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";
import { formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  account: Account;
  config: PlatformConfig;
  periodLabel: string;
  currentMetrics: Record<string, number>;
  previousMetrics: Record<string, number>;
  currentKpis: Record<string, number>;
  targets: Record<string, number>;
  postCount: number;
  prevPostCount: number;
  periodDays: number;
  highlight: string;
  onHighlightChange: (value: string) => void;
};

export function ReportPage1({
  account,
  config,
  periodLabel,
  currentMetrics,
  previousMetrics,
  currentKpis,
  targets,
  postCount,
  prevPostCount,
  periodDays,
  highlight,
  onHighlightChange,
}: Props) {
  const displayMetrics = config.metrics.filter(
    (m) => currentMetrics[m.key] != null || previousMetrics[m.key] != null
  );

  return (
    <div className="report-page">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: "#999", letterSpacing: 2, textTransform: "uppercase" as const }}>
          Weekly Report
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{account.name}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
          @{account.handle} ・ {config.label}
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>{periodLabel}</div>
      </div>

      {/* Metrics comparison table */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 10 }}>
          OVERVIEW — 前月同期間比
        </div>
        <table className="report-table">
          <thead>
            <tr>
              <th>指標</th>
              <th className="num">前月同期間</th>
              <th className="num" style={{ color: "#1a1a1a", fontWeight: 700 }}>今期間</th>
              <th className="num">増減</th>
              <th className="num">変化率</th>
            </tr>
          </thead>
          <tbody>
            {displayMetrics.map((m) => {
              const cur = currentMetrics[m.key] ?? 0;
              const prev = previousMetrics[m.key] ?? 0;
              const diff = cur - prev;
              const pct = prev > 0 ? ((cur - prev) / prev) * 100 : null;
              const cls = diff > 0 ? "text-positive" : diff < 0 ? "text-negative" : "";
              return (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td className="num" style={{ color: "#888" }}>{prev.toLocaleString("ja-JP")}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{cur.toLocaleString("ja-JP")}</td>
                  <td className={`num ${cls}`}>{diff > 0 ? "+" : ""}{diff.toLocaleString("ja-JP")}</td>
                  <td className={`num ${cls}`}>{pct != null ? `${diff > 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* KPIs */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 10 }}>
          KPI — 目標との比較
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${config.kpis.length}, 1fr)`, gap: 8 }}>
          {config.kpis.map((kpi) => {
            const value = currentKpis[kpi.key];
            const target = targets[kpi.key];
            const achieveRate = value != null && target ? Math.min(Math.round((value / target) * 100), 100) : null;
            const metTarget = value != null && target ? value >= target : null;
            return (
              <div key={kpi.key} style={{ textAlign: "center", padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "#888" }}>{kpi.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: metTarget === false ? "#dc2626" : "#1a1a1a" }}>
                  {formatKpiValue(value, kpi.format)}
                </div>
                {target != null && achieveRate != null && (
                  <>
                    <div style={{ fontSize: 10, color: "#888" }}>
                      目標 {formatKpiValue(target, kpi.format)}（{achieveRate}%）
                    </div>
                    <div style={{ marginTop: 4, height: 4, background: "#f0f0f0", borderRadius: 2 }}>
                      <div style={{
                        height: 4,
                        width: `${achieveRate}%`,
                        background: metTarget ? "#16a34a" : "#fbbf24",
                        borderRadius: 2,
                      }} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Highlight */}
      <div style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", letterSpacing: 1, marginBottom: 6 }}>
          HIGHLIGHT
        </div>
        <textarea
          className="report-editable-textarea"
          value={highlight}
          onChange={(e) => onHighlightChange(e.target.value)}
          placeholder="今期間のハイライトを入力..."
          style={{
            width: "100%", minHeight: 48, border: "1px solid #bbf7d0", borderRadius: 4,
            padding: 8, fontSize: 12, lineHeight: 1.6, resize: "vertical", background: "transparent",
          }}
        />
        <div className="report-editable-display" style={{ fontSize: 12, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {highlight}
        </div>
      </div>

      {/* Post stats */}
      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#888" }}>
        <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6 }}>
          投稿数: <strong style={{ color: "#1a1a1a" }}>{postCount}件</strong>
        </div>
        <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6 }}>
          週あたり: <strong style={{ color: "#1a1a1a" }}>{(postCount / Math.max(periodDays / 7, 1)).toFixed(1)}回</strong>
        </div>
        <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6 }}>
          前期間: <strong style={{ color: "#1a1a1a" }}>{prevPostCount}件</strong>
          （{postCount - prevPostCount >= 0 ? "+" : ""}{postCount - prevPostCount}件）
        </div>
      </div>

      <div className="report-page-footer">
        <span />
        <span>1 / 3</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/ReportPage1.tsx
git commit -m "feat: add ReportPage1 summary component"
```

---

### Task 4: Create ReportPage2 (Posts)

**Files:**
- Create: `src/components/report/ReportPage2.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { Post } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";
import { calculateWeightedKpis, formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  posts: Post[];
  config: PlatformConfig;
};

export function ReportPage2({ posts, config }: Props) {
  // Sort newest first
  const sorted = [...posts].sort(
    (a, b) => (b.publishedAt?.toDate?.()?.getTime() ?? 0) - (a.publishedAt?.toDate?.()?.getTime() ?? 0)
  );

  // Top 2 by ER
  const withER = sorted.map((p) => {
    const er = p.metrics.reach > 0
      ? ((p.metrics.likes ?? 0) + (p.metrics.comments ?? 0) + (p.metrics.saves ?? 0) + (p.metrics.shares ?? 0)) / p.metrics.reach
      : 0;
    return { ...p, er };
  });
  const topIds = new Set(
    [...withER].sort((a, b) => b.er - a.er).slice(0, 2).map((p) => p.id ?? p.postKey)
  );

  const displayMetrics = ["plays", "reach", "likes", "saves", "shares", "comments"]
    .map((key) => config.metrics.find((m) => m.key === key))
    .filter(Boolean) as typeof config.metrics;

  const formatDate = (p: Post) => {
    const d = p.publishedAt?.toDate?.();
    return d ? `${d.getMonth() + 1}/${d.getDate()}` : "—";
  };

  return (
    <div className="report-page">
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 14 }}>
        POSTS — 投稿一覧（新しい順）
      </div>

      {/* Top posts as detailed cards */}
      {sorted.filter((p) => topIds.has(p.id ?? p.postKey)).map((post, i) => {
        const er = post.metrics.reach > 0
          ? ((post.metrics.likes ?? 0) + (post.metrics.comments ?? 0) + (post.metrics.saves ?? 0) + (post.metrics.shares ?? 0)) / post.metrics.reach
          : 0;
        const saveRate = post.metrics.reach > 0 ? (post.metrics.saves ?? 0) / post.metrics.reach : 0;

        return (
          <div key={post.id ?? post.postKey} style={{
            padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 10, background: "#fafffe",
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              {post.thumbnailUrl ? (
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  style={{ width: 72, height: 72, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 72, height: 72, background: "#e5e7eb", borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                }}>
                  🎬
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                  {i === 0 ? "🥇" : "🥈"} {post.title ?? post.postKey}
                </div>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 6 }}>
                  {formatDate(post)} 投稿
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${displayMetrics.length}, 1fr)`, gap: 3 }}>
                  {displayMetrics.map((m) => (
                    <div key={m.key} style={{ textAlign: "center", padding: "4px 1px", background: "#f8f9fa", borderRadius: 3 }}>
                      <div style={{ fontSize: 8, color: "#888" }}>{m.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>
                        {(post.metrics[m.key] ?? 0).toLocaleString("ja-JP")}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 9 }}>
                  <span style={{ padding: "1px 6px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 8 }}>
                    ER {(er * 100).toFixed(2)}%
                  </span>
                  <span style={{
                    padding: "1px 6px", borderRadius: 8,
                    background: saveRate >= 0.02 ? "#dcfce7" : "#fef2f2",
                    color: saveRate >= 0.02 ? "#16a34a" : "#dc2626",
                  }}>
                    保存率 {(saveRate * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Remaining posts as compact table */}
      {sorted.filter((p) => !topIds.has(p.id ?? p.postKey)).length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#999", letterSpacing: 1, margin: "12px 0 8px" }}>
            その他の投稿
          </div>
          <table className="report-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>投稿</th>
                <th className="num">再生</th>
                <th className="num">リーチ</th>
                <th className="num">保存</th>
                <th className="num">ER</th>
              </tr>
            </thead>
            <tbody>
              {sorted.filter((p) => !topIds.has(p.id ?? p.postKey)).map((post) => {
                const er = post.metrics.reach > 0
                  ? ((post.metrics.likes ?? 0) + (post.metrics.comments ?? 0) + (post.metrics.saves ?? 0) + (post.metrics.shares ?? 0)) / post.metrics.reach
                  : 0;
                return (
                  <tr key={post.id ?? post.postKey}>
                    <td style={{ color: "#888", whiteSpace: "nowrap" }}>{formatDate(post)}</td>
                    <td style={{ maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {post.title ?? post.postKey}
                    </td>
                    <td className="num">{(post.metrics.plays ?? 0).toLocaleString("ja-JP")}</td>
                    <td className="num">{(post.metrics.reach ?? 0).toLocaleString("ja-JP")}</td>
                    <td className="num">{(post.metrics.saves ?? 0).toLocaleString("ja-JP")}</td>
                    <td className="num">{(er * 100).toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <div className="report-page-footer">
        <span />
        <span>2 / 3</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/ReportPage2.tsx
git commit -m "feat: add ReportPage2 posts component"
```

---

### Task 5: Create ReportPage3 (Trends + Analysis)

**Files:**
- Create: `src/components/report/ReportPage3.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { MonthlySummary } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";

type Props = {
  summaries: MonthlySummary[];
  config: PlatformConfig;
  analysis: string;
  onAnalysisChange: (value: string) => void;
  nextActions: string;
  onNextActionsChange: (value: string) => void;
};

export function ReportPage3({
  summaries,
  config,
  analysis,
  onAnalysisChange,
  nextActions,
  onNextActionsChange,
}: Props) {
  const sorted = [...summaries].sort(
    (a, b) => (a.periodEnd?.toDate?.()?.getTime() ?? 0) - (b.periodEnd?.toDate?.()?.getTime() ?? 0)
  );

  const displayMetrics = config.metrics.filter(
    (m) => summaries.some((s) => s.metrics[m.key] != null && s.metrics[m.key] !== 0)
  );

  // Bar chart data (reach)
  const maxReach = Math.max(...sorted.map((s) => s.metrics.reach ?? 0), 1);

  // Average
  const avg = (key: string) => {
    const vals = sorted.map((s) => s.metrics[key] ?? 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  return (
    <div className="report-page">
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 14 }}>
        MONTHLY TREND — 月次推移
      </div>

      {/* Simple bar chart */}
      {sorted.length >= 2 && (
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10 }}>リーチ数</div>
          <div style={{ display: "flex", alignItems: "end", gap: 12, height: 100, padding: "0 8px" }}>
            {sorted.map((s, i) => {
              const val = s.metrics.reach ?? 0;
              const h = Math.max((val / maxReach) * 90, 4);
              const isLatest = i === sorted.length - 1;
              return (
                <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    background: isLatest ? "#2563eb" : "#93c5fd",
                    borderRadius: "3px 3px 0 0",
                    height: h,
                    marginBottom: 4,
                  }} />
                  <div style={{ fontSize: 9, color: "#888" }}>{s.label}</div>
                  <div style={{ fontSize: 10, fontWeight: isLatest ? 700 : 600 }}>
                    {val.toLocaleString("ja-JP")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trend table */}
      <div style={{ marginBottom: 14 }}>
        <table className="report-table">
          <thead>
            <tr>
              <th />
              {sorted.map((s, i) => (
                <th key={s.id} className="num" style={i === sorted.length - 1 ? { color: "#1a1a1a", fontWeight: 700 } : {}}>
                  {s.label}
                </th>
              ))}
              <th className="num">平均</th>
            </tr>
          </thead>
          <tbody>
            {displayMetrics.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                {sorted.map((s, i) => (
                  <td key={s.id} className="num" style={i === sorted.length - 1 ? { fontWeight: 700 } : { color: "#888" }}>
                    {(s.metrics[m.key] ?? 0).toLocaleString("ja-JP")}
                  </td>
                ))}
                <td className="num" style={{ color: "#888" }}>{Math.round(avg(m.key)).toLocaleString("ja-JP")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Analysis */}
      <div style={{ padding: 12, background: "#f8f9fa", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 6 }}>
          ANALYSIS — 考察
        </div>
        <textarea
          className="report-editable-textarea"
          value={analysis}
          onChange={(e) => onAnalysisChange(e.target.value)}
          placeholder="成長要因、課題、観察を入力..."
          style={{
            width: "100%", minHeight: 80, border: "1px solid #e5e7eb", borderRadius: 4,
            padding: 8, fontSize: 11, lineHeight: 1.7, resize: "vertical", background: "transparent",
          }}
        />
        <div className="report-editable-display" style={{ fontSize: 11, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {analysis}
        </div>
      </div>

      {/* Next actions */}
      <div style={{ padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#1d4ed8", letterSpacing: 1, marginBottom: 6 }}>
          NEXT ACTIONS — 次のアクション
        </div>
        <textarea
          className="report-editable-textarea"
          value={nextActions}
          onChange={(e) => onNextActionsChange(e.target.value)}
          placeholder="来期間のアクションプランを入力..."
          style={{
            width: "100%", minHeight: 80, border: "1px solid #bfdbfe", borderRadius: 4,
            padding: 8, fontSize: 11, lineHeight: 1.7, resize: "vertical", background: "transparent",
          }}
        />
        <div className="report-editable-display" style={{ fontSize: 11, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {nextActions}
        </div>
      </div>

      <div className="report-page-footer">
        <span>Generated by SNSレポート支援ツール</span>
        <span>3 / 3</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/ReportPage3.tsx
git commit -m "feat: add ReportPage3 trends and analysis component"
```

---

### Task 6: Create report page route

**Files:**
- Create: `src/app/(dashboard)/accounts/[accountId]/report/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Timestamp } from "firebase/firestore";
import {
  getAccount,
  getMonthlySummaries,
  saveReport,
  getReports,
  type Account,
  type Post,
  type MonthlySummary,
  type Report,
} from "@/lib/firebase/firestore";
import { getPlatformConfig } from "@/lib/platforms";
import { calculateWeightedKpis } from "@/lib/kpi/calculator";
import { ReportPage1 } from "@/components/report/ReportPage1";
import { ReportPage2 } from "@/components/report/ReportPage2";
import { ReportPage3 } from "@/components/report/ReportPage3";
import "@/components/report/report-print.css";
import { toast } from "sonner";

export default function ReportPageRoute() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Period
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);

  // Data
  const [currentMetrics, setCurrentMetrics] = useState<Record<string, number>>({});
  const [previousMetrics, setPreviousMetrics] = useState<Record<string, number>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [prevPostCount, setPrevPostCount] = useState(0);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);

  // Editable text
  const [highlight, setHighlight] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const acc = await getAccount(accountId);
        setAccount(acc);
        const ms = await getMonthlySummaries(accountId);
        setMonthlySummaries(ms);

        // Load latest report if exists
        const reports = await getReports(accountId);
        if (reports.length > 0) {
          const latest = reports[0];
          setReportId(latest.id ?? null);
          setHighlight(latest.highlight ?? "");
          setAnalysis(latest.analysis ?? "");
          setNextActions(latest.nextActions ?? "");
        }
      } catch {
        toast.error("データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const handleGenerate = async () => {
    if (!account) return;
    setGenerating(true);
    try {
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      // Calculate previous period (same number of days, one month earlier)
      const prevStart = new Date(startDate);
      prevStart.setMonth(prevStart.getMonth() - 1);
      const prevEnd = new Date(endDate);
      prevEnd.setMonth(prevEnd.getMonth() - 1);

      // Fetch current period channel metrics
      const [curRes, prevRes] = await Promise.all([
        fetch("/api/ig/account/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, periodStart: startDate.toISOString(), periodEnd: endDate.toISOString() }),
        }),
        fetch("/api/ig/account/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, periodStart: prevStart.toISOString(), periodEnd: prevEnd.toISOString() }),
        }),
      ]);

      const curData = await curRes.json();
      const prevData = await prevRes.json();
      if (!curRes.ok) { toast.error(curData.error ?? "今期間のデータ取得に失敗"); return; }

      setCurrentMetrics(curData.summary ?? {});
      setPreviousMetrics(prevRes.ok ? (prevData.summary ?? {}) : {});

      // Fetch posts for current period
      const sinceDate = new Date(startDate);
      sinceDate.setDate(sinceDate.getDate() - 1);
      const mediaRes = await fetch(`/api/ig/media?limit=50&accountId=${accountId}&since=${sinceDate.toISOString()}`);
      const mediaData = await mediaRes.json();

      if (mediaRes.ok) {
        const allMedia: Array<{
          igMediaId: string; caption: string; mediaType: string;
          mediaProductType: string; timestamp: string; permalink: string; thumbnailUrl: string | null;
        }> = mediaData.media ?? [];

        // Filter to current period
        const periodMedia = allMedia.filter((m) => {
          const d = new Date(m.timestamp);
          return d >= startDate && d <= new Date(endDate.getTime() + 86400000);
        });

        if (periodMedia.length > 0) {
          toast.info("投稿のinsightsを取得中...");
          const insightsRes = await fetch("/api/ig/media/insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaIds: periodMedia.map((m) => m.igMediaId), accountId }),
          });
          const insightsData = await insightsRes.json();

          if (insightsRes.ok) {
            const results = insightsData.results ?? [];
            const postList: Post[] = results.map((r: { igMediaId: string; metrics: Record<string, number>; caption: string; permalink: string; timestamp: string; thumbnailUrl: string | null }) => ({
              id: r.igMediaId,
              postKey: r.igMediaId,
              title: r.caption.slice(0, 60) || undefined,
              publishedAt: Timestamp.fromDate(new Date(r.timestamp)),
              permalink: r.permalink,
              thumbnailUrl: r.thumbnailUrl ?? undefined,
              tags: {},
              metrics: r.metrics,
              calculatedKpis: {},
              source: "api" as const,
            }));
            setPosts(postList);
          }
        } else {
          setPosts([]);
        }

        // Count previous period posts
        const prevMediaCount = allMedia.filter((m) => {
          const d = new Date(m.timestamp);
          return d >= prevStart && d <= new Date(prevEnd.getTime() + 86400000);
        }).length;
        setPrevPostCount(prevMediaCount);
      }

      toast.success("レポートデータを取得しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "レポート生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = await saveReport(accountId, reportId, {
        periodStart: Timestamp.fromDate(new Date(periodStart)),
        periodEnd: Timestamp.fromDate(new Date(periodEnd)),
        highlight,
        analysis,
        nextActions,
      });
      setReportId(id);
      toast.success("レポートを保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !account) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
      </div>
    );
  }

  const config = getPlatformConfig(account.platform);
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const periodLabel = `${startDate.getFullYear()}年 ${startDate.getMonth() + 1}/${startDate.getDate()}〜${endDate.getMonth() + 1}/${endDate.getDate()} レポート`;
  const currentKpis = calculateWeightedKpis(config.kpis, posts.map((p) => p.metrics));

  const hasData = Object.keys(currentMetrics).length > 0;

  return (
    <div className="report-container">
      {/* Controls (hidden on print) */}
      <div className="report-controls">
        <Link href={`/accounts/${accountId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> 戻る
          </Button>
        </Link>
        <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
        <span className="text-sm text-muted-foreground">〜</span>
        <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? "取得中..." : "データ取得"}
        </Button>
        {hasData && (
          <>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> 印刷 / PDF
            </Button>
          </>
        )}
      </div>

      {hasData ? (
        <>
          <ReportPage1
            account={account}
            config={config}
            periodLabel={periodLabel}
            currentMetrics={currentMetrics}
            previousMetrics={previousMetrics}
            currentKpis={currentKpis}
            targets={account.targets}
            postCount={posts.length}
            prevPostCount={prevPostCount}
            periodDays={periodDays}
            highlight={highlight}
            onHighlightChange={setHighlight}
          />
          <ReportPage2 posts={posts} config={config} />
          <ReportPage3
            summaries={monthlySummaries}
            config={config}
            analysis={analysis}
            onAnalysisChange={setAnalysis}
            nextActions={nextActions}
            onNextActionsChange={setNextActions}
          />
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#999" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>期間を選択して「データ取得」を押してください</p>
          <p style={{ fontSize: 14 }}>IG APIからデータを取得してレポートを生成します</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(dashboard)/accounts/[accountId]/report/page.tsx"
git commit -m "feat: add report page route with data fetching and print support"
```

---

### Task 7: Add report link to account detail page

**Files:**
- Modify: `src/app/(dashboard)/accounts/[accountId]/page.tsx`

- [ ] **Step 1: Add FileText import**

Add `FileText` to the lucide-react import line.

- [ ] **Step 2: Add report button**

In the IG buttons section, after the 週次比較 and 月サマリー取得 buttons, add:

```tsx
<Link href={`/accounts/${accountId}/report`}>
  <Button size="sm" variant="outline">
    <FileText className="mr-1 h-4 w-4" />
    レポート作成
  </Button>
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/accounts/[accountId]/page.tsx"
git commit -m "feat: add report link to account detail page"
```

---

### Task 8: Build check and push

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Push**

```bash
git push
```
