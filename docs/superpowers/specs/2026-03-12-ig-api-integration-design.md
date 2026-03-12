# Phase 1.5: Instagram Graph API 連携設計

> 承認日: 2026-03-12

## 概要

Instagram Graph API を利用して、投稿別指標（Feed + Reels）を自動取得する機能を追加する。
手動入力（QuickEntryDialog）の手間を大幅に削減し、データ入力の正確性を向上させる。

## 前提条件

| 項目 | 内容 |
|------|------|
| 対象アカウント | @pico_pocco（ビジネスアカウント、FBページリンク済み） |
| API準備状況 | ゼロから（Metaアプリ作成から） |
| スコープ | 投稿別指標の自動取得を先行（チャンネルサマリーは後続） |
| ユーザー数 | 当面2〜3人、将来5人以上 |
| 取得トリガー | ダッシュボードで「APIから取得」ボタン押下 |
| 対象投稿 | Feed + Reels 両方（media_product_type で自動判別） |

## アーキテクチャ: Next.js API Routes + Firestoreにトークン保存

既存のVercel + Firebase構成にAPI Route層を追加。追加インフラ不要。

### 選定理由

- 既存構成に自然に統合
- 2〜3人の社内利用なら60日トークン + リフレッシュで十分
- 将来OAuth認証への段階的移行パスが明確
- Metaアプリ開発モードで即利用可能（審査不要）

### 不採用の選択肢

- **Firebase Cloud Functions**: Blazeプラン必須、デプロイ2系統化。過剰
- **Meta OAuthフルフロー**: 実装コスト大、アプリ審査に数週間。2〜3人には過剰

---

## セクション 1: トークンフロー

### 初回セットアップ（手動、1回だけ）

1. Meta for Developers でアプリ作成（ビジネスタイプ）
2. Instagram Graph API プロダクトを追加
3. アプリにFBページ管理者をテスターとして追加
4. Graph API Explorer で短期トークン取得
   - パーミッション: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`
5. アプリの設定画面（/settings）で短期トークンを入力
   → API Route が長期トークン(60日)に交換して Firestore に保存

### トークンライフサイクル

```
短期トークン(1h) → [API Route] → 長期トークン(60日) → Firestore保存
                                         ↓
                    期限14日前に管理画面でアラート表示
                                         ↓
                    「トークン更新」ボタン → リフレッシュAPI → 新60日トークン
```

### Firestoreデータ構造

```
settings/instagram
  ├── accessToken: string           ← 長期トークン（サーバーサイドのみ参照）
  ├── igUserId: string              ← IG Business Account ID
  ├── tokenExpiresAt: Timestamp
  ├── connectedAccountName: string  ← "@pico_pocco"
  └── updatedAt: Timestamp
```

セキュリティ: アクセストークンはAPI Route（サーバーサイド）からのみ読み取り。Firestoreルールでクライアント直接読み取りを禁止。

### トークン期限アラート

| 残り日数 | 表示 |
|---------|------|
| 14日以上 | 設定画面にのみ表示 |
| 7〜14日 | 設定画面 + ダッシュボードに小バッジ |
| 7日未満 | ヘッダーに警告バナー |
| 期限切れ | 「APIから取得」ボタン無効化 + バナー |

---

## セクション 2: API Route構成 & データフロー

### エンドポイント

| パス | メソッド | 機能 |
|------|---------|------|
| `/api/ig/token/exchange` | POST | 短期→長期トークン交換 & Firestore保存 |
| `/api/ig/token/refresh` | POST | 長期トークンリフレッシュ（60日延長） |
| `/api/ig/token/status` | GET | トークン状態確認（期限、接続アカウント名） |
| `/api/ig/media` | GET | 最近の投稿一覧を取得 |
| `/api/ig/media/insights` | POST | 選択した投稿の指標を一括取得 |

### メインデータフロー

```
Step 1: GET /api/ig/media?limit=25
  → IG API: GET /{ig-user-id}/media?fields=id,caption,media_type,
            media_product_type,timestamp,permalink,thumbnail_url&limit=25
  → UI: 投稿一覧を表示、チェックボックスで選択

Step 2: POST /api/ig/media/insights
  body: { mediaIds: ["123", "456", ...], accountId: "xxx", snapshotId?: "yyy" }
  → IG API: 投稿ごとに GET /{media-id}/insights + GET /{media-id}?fields=like_count,...
  → PlatformConfig metrics キーにマッピング
  → Firestore: スナップショット作成 or 既存スナップショットに追加
  → source: "api", capturedAt: now()
```

### IG API → PlatformConfig メトリクスマッピング

**Feed (ig_feed)**:

| IG API フィールド | 取得元 | PlatformConfig key |
|---|---|---|
| `impressions` | /insights | `impressions` |
| `reach` | /insights | `reach` |
| `saved` | /insights | `saves` |
| `like_count` | media field | `likes` |
| `comments_count` | media field | `comments` |
| `shares` | /insights | `shares` |

**Reels (ig_reel)**:

| IG API フィールド | 取得元 | PlatformConfig key |
|---|---|---|
| `plays` | /insights | `plays` |
| `reach` | /insights | `reach` |
| `saved` | /insights | `saves` |
| `like_count` | media field | `likes` |
| `comments_count` | media field | `comments` |
| `shares` | /insights | `shares` |

> `total_watch_time_ms` と `duration_sec` はIG APIから取得不可の可能性あり。その場合は手動入力で補完。

### media_type による自動振り分け

```typescript
function toPlatformId(mediaType: string, mediaProductType: string): "ig_feed" | "ig_reel" {
  if (mediaProductType === "REELS") return "ig_reel";
  return "ig_feed"; // IMAGE, CAROUSEL_ALBUM, non-REELS VIDEO
}
```

---

## セクション 3: UI設計

### ボタン配置（アカウント詳細ページ）

既存の [QuickEntry] [CSVアップロード] の横に [APIから取得] ボタンを追加。
IG系アカウント（ig_feed, ig_reel）のときだけ表示。
トークン未設定時は「API連携を設定」に変わり /settings に誘導。

### IgImportDialog（新規）

- 期間フィルタで表示投稿を絞り込み（クライアント側フィルタ）
- permalink の一致でインポート済み投稿はグレーアウト
- Feed / Reel のアイコン自動表示（media_product_type で判別）
- 保存先: 新規スナップショット作成 or 既存スナップショットに追加
- 1つのIGアカウントの投稿をFeed/Reelに自動振り分け

### 設定画面拡張

- 接続状態 & トークン期限表示
- 短期トークン入力フォーム（初回セットアップ）
- トークン更新 / 接続解除ボタン

---

## セクション 4: エラーハンドリング

| エラー | 原因 | UI対応 |
|--------|------|--------|
| OAuthException (190) | トークン無効 | /settings へ誘導 |
| OAuthException (10) | パーミッション不足 | 必要な権限リスト表示 |
| Rate limit (4) | 200リクエスト/時間超過 | 待機メッセージ |
| Insights不可 | 194日超の投稿 | 該当投稿のみ警告、他は正常処理 |
| 一部指標欠損 | watch_time等 | 取得できた指標のみ保存、手動補完可能 |

### 部分成功

成功した投稿は保存、失敗分は結果ダイアログで個別表示。再試行ボタンあり。

### 重複インポート防止

permalink をキーに既存スナップショット内の投稿と照合。同一投稿はグレーアウト。
異なるスナップショットへの同一投稿インポートは許可。

---

## セクション 5: ファイル構成

### 新規ファイル (10)

```
src/app/api/ig/
  ├── token/exchange/route.ts
  ├── token/refresh/route.ts
  ├── token/status/route.ts
  ├── media/route.ts
  ├── media/insights/route.ts
  └── lib.ts
src/components/ig/
  ├── IgImportDialog.tsx
  ├── IgConnectForm.tsx
  └── IgTokenStatus.tsx
src/lib/ig/
  └── mapper.ts
```

### 変更ファイル (7)

| ファイル | 変更内容 |
|---------|---------|
| `accounts/[accountId]/page.tsx` | 「APIから取得」ボタン追加 |
| `settings/page.tsx` | Instagram API連携セクション追加 |
| `components/layout/Header.tsx` | トークン期限警告バナー |
| `lib/firebase/firestore.ts` | `getIgSettings()`, `saveIgSettings()` 追加 |
| `firestore.rules` | settings/instagram のアクセス制限 |
| `.env.example` | `META_APP_ID`, `META_APP_SECRET` 追加 |
| `next.config.ts` | Instagram CDN を remotePatterns に追加 |

### 変更なし

- `lib/platforms/ig-feed.ts`, `ig-reel.ts` — 指標/KPI定義はそのまま
- `lib/kpi/calculator.ts` — KPI計算ロジック変更不要
- `components/posts/QuickEntryDialog.tsx` — 手動入力は引き続き利用可能

### 環境変数（新規、サーバーサイドのみ）

```
META_APP_ID=
META_APP_SECRET=
```
