# Web/SNS Report Support - Project Status

> 最終更新: 2026-02-18（3回目）

## 概要

自社SNSコンサルティング業務におけるクライアント向けレポート作成を効率化するWebツール。
6プラットフォーム（IG Feed, IG Reels, YT長尺, YT Shorts, TikTok, X）の投稿パフォーマンスデータを集約し、KPIダッシュボードとして可視化する。最終成果物はGoogle Slidesレポート（Phase 4）。

## 現在のPhase: Phase 1 本番稼働中 / Phase 1.5 実装完了（Metaアプリセットアップ待ち）

### デプロイ状況

- **本番URL**: https://report-app-0218.vercel.app
- **ホスティング**: Vercel（GitHub連携、mainブランチ自動デプロイ）
- **Firebase**: report-e2fab（Firestore, Auth デプロイ済み）
- **ステータス**: 社員による手動入力フローの検証中

### Phase 1 進捗: 全ステップ完了

- [x] Step 1: プロジェクトスキャフォールド
- [x] Step 2: Firebase統合 + Google認証
- [x] Step 3: プラットフォーム設定システム（6プラットフォーム）
- [x] Step 4: アカウント管理UI
- [x] Step 5: 手動データ入力
- [x] Step 6: CSVアップロード
- [x] Step 7: ダッシュボード + KPI表示
- [x] Step 8: レイアウト・ナビゲーション・仕上げ

### Phase 1 追加改善（完了済み）

- [x] KpiCardGrid: channelSummary + 投稿別KPIの**二視点同時表示**
- [x] SnapshotComparisonCard: プラットフォーム別動的指標キー（YTハードコード脱却）
- [x] 既存スナップショットへの投稿追加UI（QuickEntryDialog `targetSnapshot` mode）
- [x] 「正式 vs 参考」階層の排除 → 対等な分析視点として全コード・テキスト統一
- [x] アルゴリズム重要指標の `required: true` 化（全6プラットフォーム）
- [x] Mosseri(2025)リサーチに基づく指標description更新（IG Feed, IG Reels, TikTok）

### デプロイ時の修正

- **Firebase lazy init**: Proxy → getter関数（`db()`, `auth()`）に変更。Vercelプリレンダリング時にFirebase未初期化エラーが発生するため
- **エラーバウンダリ**: `(dashboard)/error.tsx` 追加。クライアントエラー時にメッセージ表示

### ビルド状態

- `tsc --noEmit`: PASS
- `next build`: PASS（環境変数なしでもPASS）

---

## アーキテクチャ

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui |
| 認証 | Firebase Auth (Google Sign-in) |
| DB | Cloud Firestore |
| チャート | Recharts |
| テーブル | TanStack Table |
| CSV | Papa Parse |
| フォーム | React Hook Form + Zod |

### スナップショットベースのデータモデル

```
accounts/{accountId}
  ├── platform, name, handle, targets, tags
  │
  ├── snapshots/{snapshotId}           ← ある期間のデータ取り込み単位
  │   ├── periodStart, periodEnd
  │   ├── postCount, totals            ← 投稿合計（自動計算）
  │   ├── channelSummary?              ← 手動入力のチャンネル概要数値（チャンネルKPI）
  │   └── posts/{postId}               ← そのスナップショットに属する投稿
  │       ├── postKey, title, permalink
  │       ├── publishedAt, capturedAt  ← 投稿日時 + データ記録日時
  │       ├── metrics: {}              ← プラットフォーム固有の生指標
  │       ├── calculatedKpis: {}       ← 書き込み時に計算済みKPI
  │       ├── tags: {}
  │       └── source: "manual"|"csv"|"api"
  │
  └── posts/{postId}                   ← レガシー（スナップショット導入前）
```

### 二層データ構造（重要な設計判断）

全プラットフォームで「チャンネルサマリー」と「投稿別データ」の二層構造を採用。

**背景**: 各SNSの投稿パフォーマンス指標は累積値（lifetime cumulative）であり、キャプチャ時点によって値が変わる。投稿A（48h経過）と投稿B（4h経過）のリーチを単純に合算しても正確なチャンネル全体KPIにはならない。

**解決策（二層構造、両方とも一級データ）**:
- **チャンネルサマリー**（`channelSummary`）: 各プラットフォームのアナリティクス概要画面から期間指定で取得した数値。チャンネル全体の健全性を俯瞰するKPIとして使用。
- **投稿別データ**（`posts`）: 個別投稿のpoint-in-timeスナップショット（24h目安）。初動パフォーマンスの公平な比較、TOP投稿分析・タグ別分析に使用。

> どちらも独立した分析視点であり、「正式」vs「参考」の関係ではない。

| プラットフォーム | チャンネルサマリーの取得元 | 期間指定 |
|--------------|---------------------|---------|
| IG Feed/Reels | Instagram Insights → 概要 | 可（最大90日前まで） |
| TikTok | TikTok Studio → アナリティクス → 概要 | 可（最大60日前まで） |
| X | Xアナリティクス → サマリー | 可 |
| YT Long/Short | YouTube Studio CSV（チャンネルレベルもCSVから取得可能） | CSVに含まれる |

### capturedAt（データ記録日時）

各投稿に`capturedAt`フィールドを保持し、投稿日時（`publishedAt`）からの経過時間を表示。

- **目的**: 累積バイアスの可視化（24h後の記録と72h後の記録を区別）
- **運用ルール**: 担当者は投稿から24h後を目安にデータを記録（努力義務）
- **UI表示**: PostsTable, TopPostsPanelで `(Xh後)` や `Xh後に記録` と表示

---

## プラットフォーム別アナリティクス仕様

### YouTube（yt_long, yt_short）

- **データソース**: YouTube Studio → アナリティクス → 詳細モード → エクスポート（CSV）
- **入力フロー**: CSVアップロードが主、手動入力が副
- **CSV品質**: 非常に高い。期間指定・動画単位の正確なデータが出力される
- **日本語CSV列名対応済み**（csvAliases）
- **2025-03-01以前の動画はCSVインポート時に自動スキップ**
- **サムネイル**: YouTube公式URL（`https://img.youtube.com/vi/{videoId}/mqdefault.jpg`）

### Instagram Feed（ig_feed）

- **データソース**: Meta Business Suite → コンテンツ → CSV or 手動転記
- **入力フロー**: 手動入力（QuickEntryDialog）が主、CSV副
- **指標**: リーチ、インプレッション、保存数、いいね！、コメント、シェア、フォロー
- **KPI**: 保存率、エンゲージメント率、フォロー率
- **重要な仕様**:
  - Meta Business Suiteの日付フィルターは「その期間に投稿されたものを表示」であり、指標の期間を制限するものではない
  - 投稿別指標は常に現在の累積値（lifetime cumulative）を表示
  - アカウントレベルのInsightsは期間指定が可能（最大90日前まで）
  - 投稿別データの保持期間: 194日

### Instagram Reels（ig_reel）

- **データソース**: Meta Business Suite → Reelsタブ or 手動転記
- **入力フロー**: 手動入力が主
- **指標**: 再生数、リーチ、合計再生時間、動画の長さ、いいね！、コメント、保存数、シェア、フォロー
- **KPI**: 平均視聴時間、エンゲージメント率、保存率
- **注意**: Feedと同様に累積値バイアスあり。チャンネルサマリーをチャンネルKPIとして使用

### TikTok（tiktok）

- **データソース**: TikTok Studio → アナリティクス
- **入力フロー**: 手動入力が主（QuickEntryDialog）
- **指標**: 視聴回数、いいね、コメント、シェア、保存数、合計再生時間、平均視聴時間、動画の長さ、フォロー
- **KPI**: エンゲージメント率、維持率、フォロー率
- **重要な制約**:
  - 投稿別パフォーマンスは**直近7日間**のみ表示（過去に遡れない）
  - チャンネル概要は期間指定可能（最大60日前まで）
  - → 投稿データは24h後の記録を努力義務、チャンネルサマリーを週次でチャンネルKPIとして記録

### X（x）

- **データソース**: Xアナリティクス
- **入力フロー**: 手動入力が主
- **指標**: インプレッション、エンゲージメント、いいね、リポスト、返信、ブックマーク、リンククリック、プロフィールクリック、フォロー、動画再生数
- **KPI**: エンゲージメント率、リポスト率、ブックマーク率、CTR、フォロー転換率
- **制約**: CSVエクスポートはX Premium契約が必要

---

## ルート構成

| ルート | 説明 |
|--------|------|
| `/` | ダッシュボードホーム（アカウント一覧） |
| `/login` | Google Sign-inログイン画面 |
| `/accounts/[id]` | アカウント詳細（スナップショット選択・KPI・投稿一覧・比較） |
| `/accounts/[id]/posts/new` | 手動投稿入力（フルフォーム版、レガシー） |
| `/settings` | 目標KPI・タグ設定 |

---

## 主要コンポーネント

### データ入力

| コンポーネント | ファイル | 説明 |
|-------------|---------|------|
| CsvUploadDialog | `components/posts/CsvUploadDialog.tsx` | CSVアップロード（YT主力）。2025-03-01以前フィルタ、自動マッピング |
| QuickEntryDialog | `components/posts/QuickEntryDialog.tsx` | 手動入力（IG/TT/X主力）。期間選択→投稿入力→スナップショット作成 |
| ChannelSummaryDialog | `components/kpi/ChannelSummaryDialog.tsx` | チャンネルサマリー手動入力（非YTプラットフォーム用） |
| PostForm | `components/posts/PostForm.tsx` | フルフォーム版手動入力（レガシー） |

### ダッシュボード

| コンポーネント | ファイル | 説明 |
|-------------|---------|------|
| SnapshotSelector | `components/kpi/SnapshotSelector.tsx` | スナップショット切り替え + 比較対象選択 |
| KpiCardGrid | `components/kpi/KpiCardGrid.tsx` | KPIカード一覧（加重平均計算）。channelSummaryと投稿別を二視点同時表示 |
| SnapshotComparisonCard | `components/kpi/SnapshotComparisonCard.tsx` | 前回スナップショットとのKPI・指標比較。PlatformConfigから動的生成、ソース種別ラベル付き |
| TopPostsPanel | `components/kpi/TopPostsPanel.tsx` | TOP投稿ランキング（KPI/指標切替可） |
| PostsTable | `components/posts/PostsTable.tsx` | 全投稿テーブル（ソート可） |
| SnapshotTrendChart | `components/kpi/SnapshotTrendChart.tsx` | スナップショット間の推移グラフ |
| PlatformGuide | `components/accounts/PlatformGuide.tsx` | プラットフォーム別使い方ガイド |

### レイアウト

| コンポーネント | ファイル | 説明 |
|-------------|---------|------|
| Sidebar | `components/layout/Sidebar.tsx` | 左サイドバー（モバイル折りたたみ） |
| Header | `components/layout/Header.tsx` | ヘッダー |

---

## lib構成

| モジュール | ファイル | 説明 |
|----------|---------|------|
| Firebase設定 | `lib/firebase/config.ts` | SSR-safe lazy init（Proxy pattern） |
| Firebase認証 | `lib/firebase/auth.ts` | Google Sign-in/Sign-out |
| Firestore CRUD | `lib/firebase/firestore.ts` | Account, Post, Snapshot の全CRUD操作 |
| プラットフォーム定義 | `lib/platforms/*.ts` | 6プラットフォームの指標・KPI定義 |
| プラットフォームユーティリティ | `lib/platforms/utils.ts` | サムネイルURL生成、カラー、絵文字 |
| KPI計算 | `lib/kpi/calculator.ts` | 加重平均KPI計算（sum/sum） |
| KPI集約 | `lib/kpi/aggregator.ts` | 週次・月次集計 |
| KPI比較 | `lib/kpi/comparator.ts` | 期間間比較 |
| 期間ユーティリティ | `lib/kpi/periods.ts` | 今週/先週/今月等のプリセット |
| CSVパーサー | `lib/csv/parser.ts` | Papa Parseラッパー |
| CSVマッパー | `lib/csv/mapper.ts` | csvAliasesによる自動カラムマッピング |

---

## プラットフォーム別設定

| プラットフォーム | 指標数 | KPI数 | 主要KPI | アルゴリズム最重要シグナル |
|--------------|--------|-------|---------|-------------------|
| IG Feed | 7 | 3 | 保存率, ER, フォロー率 | saves(heavy), sends(3-5x likes), likes per reach |
| IG Reels | 9 | 3 | 平均視聴時間, ER, 保存率 | watch time(#1), sends(3-5x likes), likes per reach |
| YT Long | 25 | 3 | 平均再生率, CTR, RPM | watch time, CTR |
| YT Short | 26 | 3 | 維持率, 登録者/1000再生, ER | retention rate(#1), shares |
| TikTok | 9 | 3 | ER, 維持率, フォロー率 | retention rate(#1), shares, saves |
| X | 10 | 5 | ER, RP率, BM率, CTR, フォロー転換率 | reposts, bookmarks, replies |

### アルゴリズムリサーチ（Mosseri 2025年1月公認）

Instagram（Feed/Reels共通）:
- **Mosseri公認3大ランキング要素**: watch time, sends per reach, likes per reach
- **Heavy interactions**: saves, shares(DM sends), comments — 軽い"likes"より強いシグナル
- **DM sends(シェア)**: いいねの**3〜5倍**の重み。新規リーチ拡大の最強シグナル
- **Saves**: 「後で見返す価値がある」= コンテンツ品質の最強シグナル。カルーセル・教育系で特に重要
- Feed固有: saves > shares（保存率がフィードのアルゴリズム最重要KPI）
- Reels固有: watch time > sends（視聴完了・ループ再生が推薦の#1シグナル）

各プラットフォームの`description`フィールドにこれらの知見を反映済み。

---

## 設計上の重要判断

1. **プラットフォーム設定はコード管理** — `lib/platforms/*.ts`。型安全、テスト容易、バージョン管理可能
2. **KPIは書き込み時計算** — Firestoreに非正規化保存。ダッシュボード読み取り高速化
3. **加重平均が第一級概念** — `sum(numerator)/sum(denominator)`。平均の平均は禁止
4. **スナップショットベース** — 投稿データは`accounts/{id}/snapshots/{sid}/posts/`配下。比較・推移表示に対応
5. **二層データ構造** — チャンネルサマリー（期間俯瞰）+ 投稿別データ（初動パフォーマンス）、対等な分析視点
6. **capturedAtで記録鮮度を追跡** — 累積バイアスの可視化
7. **プラットフォーム別入力フロー** — YTはCSV主、IG/TT/XはQuickEntry主
8. **全UI日本語** — i18nフレームワーク不使用。指標名は各プラットフォーム公式日本語名に準拠
9. **CSV auto-mapping** — `csvAliases`で日本語・英語両対応
10. **Firebase Proxy pattern** — SSR環境でのlazy initialization
11. **アルゴリズム重要指標は必須入力** — 各PFで「アルゴリズムが特に重視する」指標を `required: true` に設定。description にも根拠を明記

---

## 運用ワークフロー（プラットフォーム別）

### YouTube（週次レポート）

1. YouTube Studio → アナリティクス → 詳細モード → 期間設定 → CSVエクスポート
2. WebツールでCSVアップロード → スナップショット自動作成
3. ダッシュボードでKPI確認・前回比較

### Instagram（週次レポート）

1. 各投稿のInsightsを開き、QuickEntryDialogで指標を入力（24h後目安）
2. Instagram Insights概要画面から期間指定でチャンネルサマリー数値を取得
3. ChannelSummaryDialogでサマリーを入力 → チャンネルKPIとして使用
4. ダッシュボードで確認

### TikTok（週次レポート）

1. TikTok Studioで各投稿のパフォーマンスを確認（7日以内に記録必須）
2. QuickEntryDialogで投稿ごとに入力（24h後を推奨、スクショ先行可）
3. TikTok Studio → アナリティクス → 概要 → 期間指定でサマリー取得
4. ChannelSummaryDialogで入力 → チャンネルKPI
5. ダッシュボードで確認

### X（週次レポート）

1. Xアナリティクスで各投稿のパフォーマンスを確認
2. QuickEntryDialogで入力
3. アカウント概要のサマリー数値をChannelSummaryDialogで入力
4. ダッシュボードで確認

---

## 未実装・TODO

### Phase 1の残作業 → 全て完了 + 本番デプロイ済み

- [x] ~~KpiCardGridへのchannelSummary反映~~ → 二視点同時表示として実装
- [x] ~~既存スナップショットへの投稿追加UI~~ → QuickEntryDialog `targetSnapshot` mode として実装
- [x] Vercelデプロイ + Firebase Auth/Firestore連携確認
- [x] Firebase lazy init修正（Vercelプリレンダリング対応）
- [x] エラーバウンダリ追加

### Phase 1.5: Instagram Graph API連携（実装完了 — `feature/ig-api-integration` ブランチ）

- [x] API Route層（token exchange/refresh/status, media list, media insights）
- [x] Firebase Admin によるサーバーサイドトークン管理
- [x] IG APIレスポンス → PlatformConfig metricsマッパー（Feed/Reel自動振り分け）
- [x] IgImportDialog（投稿選択 + 指標一括取得 + スナップショット保存）
- [x] 設定画面にAPI連携セクション追加（IgConnectForm, IgTokenStatus）
- [x] トークン期限警告バナー（Header）
- [x] TypeScript / Next.js ビルド PASS
- [ ] Metaアプリ作成 + 本番テスト（手動セットアップ必要）
- [ ] アカウントInsights自動取得（チャンネルサマリー）— Phase 2へ

### Phase 2: API自動取得全般

- IG API（上記Phase 1.5の延長）
- YouTube Data API / YouTube Analytics API
- TikTok API（制限大きい可能性）

### Phase 3: 高度な分析

- ドリルダウン（タグ×KPIクロス分析）
- 目標追跡（ターゲットKPI達成率）
- 期間カスタム比較

### Phase 4: Google Slides自動生成

- テンプレートベースの8-12枚構成
- KPI・TOP投稿・推移グラフの自動差し込み
- コメント・考察は手動入力（コンサルの付加価値）

---

## Firestoreセキュリティ

- 認証済みユーザーのみread/write可能
- `firestore.rules`で設定済み

---

## ファイルツリー（src/）

```
src/
├── app/
│   ├── layout.tsx
│   ├── providers.tsx
│   ├── (auth)/login/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx
│       ├── page.tsx                         # ダッシュボードホーム
│       ├── settings/page.tsx                # 設定
│       └── accounts/[accountId]/
│           ├── page.tsx                     # アカウント詳細
│           └── posts/new/page.tsx           # 手動入力（レガシー）
├── components/
│   ├── ui/          # shadcn/ui (badge, button, card, dialog, etc.)
│   ├── layout/      # Sidebar, Header
│   ├── accounts/    # AccountCard, AccountFormDialog, PlatformGuide
│   ├── posts/       # PostsTable, CsvUploadDialog, QuickEntryDialog, PostForm, TagSelector
│   └── kpi/         # KpiCardGrid, SnapshotSelector, SnapshotComparisonCard,
│                    # SnapshotTrendChart, TopPostsPanel, ChannelSummaryDialog,
│                    # PeriodSelector, KpiComparisonCard, KpiTrendChart
├── contexts/
│   └── AuthContext.tsx
└── lib/
    ├── utils.ts
    ├── firebase/    # config.ts, auth.ts, firestore.ts
    ├── platforms/   # types.ts, index.ts, utils.ts, ig-feed.ts, ig-reel.ts,
    │               # yt-long.ts, yt-short.ts, tiktok.ts, x.ts
    ├── kpi/         # calculator.ts, aggregator.ts, comparator.ts, periods.ts
    └── csv/         # parser.ts, mapper.ts
```
