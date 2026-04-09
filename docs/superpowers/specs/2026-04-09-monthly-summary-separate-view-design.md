# 月次サマリー独立ビュー 設計書

## 概要

月次サマリー（チャンネル全体の指標）をスナップショット（投稿バッチの初動データ）から分離し、独立したデータモデルとUIビューにする。

## 背景

現状 `Snapshot.channelSummary` に月次サマリーが同居しており、投稿レベルの初動データと概念的に混在している。KpiCardGridの二重表示やSnapshotComparisonCardの混合ソース警告が必要になるなど、設計上の歪みが生じている。

---

## セクション 1: データモデル

### 新コレクション

```
accounts/{accountId}/monthlySummaries/{id}
  periodStart: Timestamp
  periodEnd: Timestamp
  label: string              // "2026年 3月"
  metrics: Record<string, number>  // reach, likes, comments, shares, saves, total_interactions, follows
  importedAt: Timestamp
```

### 既存からの削除・変更

- `Snapshot.channelSummary` フィールド: 型定義ではoptionalのまま残す（既存データ互換）が、新規書き込みはしない
- `KpiCardGrid` の二重表示ロジック（チャンネル全体 vs 初動）を削除。常に初動のみ表示
- `SnapshotComparisonCard` の混合ソース警告ロジックを削除（`getMetricTotals` は常に `totals` を使う）
- 「月サマリー取得」ボタンの保存先を `monthlySummaries` コレクションに変更

---

## セクション 2: UI — 「月次サマリー」タブ

### タブ追加

既存タブ列に追加: `前回比較 / TOP投稿 / 投稿一覧 / 全体推移 / 月次サマリー / 使い方`

IG連携済み（`IG_API_PLATFORMS` + `igConnected`）のアカウントでのみ表示。

### タブ内コンテンツ: `MonthlySummaryPanel`

新規コンポーネント `src/components/kpi/MonthlySummaryPanel.tsx`

**1. サマリー一覧テーブル**
- 月ごとの行。各行に reach, likes, comments, shares, saves, follows を表示
- 新しい月が上

**2. 月間推移チャート**
- 既存 `SnapshotTrendChart` と同パターン。サマリーの指標を折れ線グラフで表示
- 指標切り替えボタン付き

**3. 月同士の比較**
- 最新2つのサマリーを自動で並べて差分・変化率を表示
- 既存 `SnapshotComparisonCard` と同パターンだがサマリー専用

### サマリーが0件の場合

「月サマリー取得ボタンで取得してください」の案内テキストを表示。

---

## セクション 3: 「月サマリー取得」ボタンの変更

### 変更点

- **保存先**: `monthlySummaries` コレクション（スナップショットではなく）
- **スナップショット不要**: ボタンはスナップショット選択状態に関係なく常に表示
- **期間**: 前月1日〜末日をデフォルトで取得
- **重複制御**: 同じ `label` のサマリーが既にあれば上書き更新

### API Route変更

`POST /api/ig/account/insights` のレスポンスは変更なし。クライアント側の保存先を `updateSnapshot` → `createMonthlySummary` に変更。

---

## セクション 4: Firestore CRUD関数

`src/lib/firebase/firestore.ts` に追加:

- `getMonthlySummaries(accountId)` — periodEnd降順で取得
- `createMonthlySummary(accountId, data)` — 新規作成
- `updateMonthlySummary(accountId, id, data)` — 上書き更新
- `MonthlySummary` 型定義

---

## 変更ファイル一覧

| ファイル | 変更 |
|---------|------|
| `src/lib/firebase/firestore.ts` | `MonthlySummary` 型 + CRUD関数追加 |
| `src/components/kpi/MonthlySummaryPanel.tsx` | **新規**: タブ内コンテンツ |
| `src/app/(dashboard)/accounts/[accountId]/page.tsx` | タブ追加、月サマリー取得ボタンの保存先変更、channelSummary関連の削除 |
| `src/components/kpi/KpiCardGrid.tsx` | 二重表示ロジック削除（初動のみに簡素化） |
| `src/components/kpi/SnapshotComparisonCard.tsx` | 混合ソース警告・channelSummary fallback削除 |

## スコープ外

- 既存 `channelSummary` データのマイグレーション（型にoptionalで残すので既存データは壊れない）
- 月次サマリーの手動入力（「サマリー手動入力」メニューは削除）
- 他プラットフォーム（TikTok等）への展開
