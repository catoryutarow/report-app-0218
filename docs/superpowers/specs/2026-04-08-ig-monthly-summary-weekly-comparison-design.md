# IG月サマリー取得 & 週次比較 設計書

## 概要

Instagram連携にワンクリック機能を2つ追加する:
1. **月サマリー取得** — IG Account Insights APIからチャンネル全体の月間指標を取得し、既存スナップショットの `channelSummary` に自動セット
2. **週次比較** — 直近2週間の投稿を自動取得・スナップショット化し、比較表示を一括で行う

## アプローチ: 既存スナップショットに統合 (方針A)

既存の `Snapshot` モデル（`totals` + `channelSummary`）をそのまま活用。データモデル変更なし。

**選定理由:**
- `channelSummary` + `SnapshotComparisonCard` がそのまま活きる
- 「手動入力」が「API自動入力」に置き換わるだけで学習コストゼロ
- 最速で実装できる

---

## セクション 1: 月サマリー取得

### API設計

新規API Route: `POST /api/ig/account/insights`

```
Request:
  { accountId: string, periodStart: string, periodEnd: string }

Internal:
  GET /{igUserId}/insights
    ?metric=impressions,reach,follower_count,profile_views
    &period=day
    &since={periodStart UNIX}
    &until={periodEnd UNIX}

Response:
  { summary: Record<string, number> }
```

### 指標マッピング

| IG API metric | アプリ内key | 集計方法 |
|--------------|------------|---------|
| `impressions` | `impressions` | 日別値の合計 |
| `reach` | `reach` | 日別値の合計 |
| `follower_count` | `follows` | 期間最終日 - 期間初日（純増） |
| `profile_views` | — | 将来追加の余地あり（今回はスキップ） |

### フロー

1. ユーザーがスナップショット選択済みの状態で「月サマリー取得」ボタンを押す
2. `POST /api/ig/account/insights` にスナップショットの `periodStart`〜`periodEnd` を送信
3. レスポンスの `summary` を `channelSummary` にセット → `updateSnapshot()` でFirestore更新
4. KpiCardGridが自動的にチャンネル全体の行を表示

### パーミッション

`instagram_manage_insights` が必要だが、既に投稿insightsで使用中のため追加不要。

---

## セクション 2: 週次比較

### フロー

「週次比較」ボタンを押すと以下が一括で走る:

1. **投稿取得**: `/api/ig/media` でページネーション付きで投稿を取得（2週間分がカバーされるまで）
2. **2週間分に振り分け**: 今週（月〜日）と先週（月〜日）に自動分類
3. **各投稿のinsights取得**: 既存の `POST /api/ig/media/insights` を流用
4. **スナップショット2つを自動生成**: 先週・今週それぞれ `createSnapshotWithPosts()`
5. **比較タブを自動で開く**: 生成した2つのスナップショットをセットして `SnapshotComparisonCard` を表示

### 重複制御

- 同じ期間（label）のスナップショットが既に存在する場合はスキップして既存を使用
- `label` フォーマット: `"2026年 3/31〜4/6"`（既存と同じ）

### 50件制限の対処: ページネーション

現在の `/api/ig/media` は `limit=50` で1回だけフェッチしているが、IG Graph APIのカーソルベースページネーションに対応する。

```
GET /{igUserId}/media?fields=...&limit=50
  → paging.next があれば次ページを取得
  → 取得した投稿の timestamp が対象期間より古くなったら打ち切り
  → 安全上限: 200件 or 4ページ
```

**ポイント:**
- Media APIには `since`/`until` がないため、フェッチしながらクライアント側で日付チェック→打ち切り
- 最新→古い順で返るので、対象期間をカバーした時点で効率的に停止
- ページネーション対応は `/api/ig/media` に追加するため、通常のインポートダイアログでも恩恵を受ける

---

## セクション 3: UI

### ボタン配置（アカウント詳細ページ）

既存: `[QuickEntry] [CSVアップロード] [APIから取得]`
変更後: `[QuickEntry] [CSVアップロード] [APIから取得] [月サマリー取得] [週次比較]`

**表示条件:**
- 両ボタンとも IG連携済み (`igConnected`) かつ IGプラットフォーム (`IG_API_PLATFORMS`) の時のみ表示
- 「月サマリー取得」はスナップショットが選択されている時のみ有効

### ローディング

- **月サマリー**: ボタン内スピナー。1 APIコールで数秒。
- **週次比較**: ボタン内スピナー + 進捗toast（「投稿取得中...」→「先週分のinsights取得中...」→「今週分のinsights取得中...」）。投稿数次第で10-30秒。

### 見た目

最小限で実装。デザイン調整は別パスで行う。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/app/api/ig/account/insights/route.ts` | **新規**: Account Insights API Route |
| `src/app/api/ig/media/route.ts` | ページネーション対応（`since` パラメータで打ち切り） |
| `src/lib/ig/mapper.ts` | Account Insights用のマッピング関数追加 |
| `src/app/(dashboard)/accounts/[accountId]/page.tsx` | 「月サマリー取得」「週次比較」ボタン追加 |

---

## スコープ外

- 見た目・デザイン調整（別パス）
- 自動cron（手動ボタンのみ）
- profile_views等の新規指標追加
- TikTok/YouTube等他プラットフォームへの展開
