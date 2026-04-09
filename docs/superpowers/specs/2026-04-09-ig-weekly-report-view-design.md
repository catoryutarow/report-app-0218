# IG週次レポートビュー 設計書

## 概要

IGアカウント向けの週次A4レポートをアプリから直接生成できるレポート専用ページを作成する。ブラウザ印刷→PDFで出力。パソコンに慣れていないクライアント向けに、見やすさと情報の取捨選択にこだわった構成。

## ターゲット

- **レポート作成者**: SNS運用担当者（アプリのユーザー）
- **レポート受取人**: クライアント（SNS運用を委託している企業担当者）
- **クライアントの関心**: 数字の成長（前月比）とコンテンツの質（どの投稿がよかったか）

## レポート構成（A4 3ページ）

### 1ページ目: サマリー

- **ヘッダー**: アカウント名、ハンドル、プラットフォーム、レポート期間（例: 3/1〜3/8）
- **前月同期間比テーブル**: 今期間 vs 先月同日数分（3/1-3/8 vs 2/1-2/8）
  - 指標: reach, likes, comments, saves, shares, total_interactions
  - 列: 先月同期間、今期間、増減、変化率
- **KPIカード**: ER, 保存率, 平均視聴時間
  - 目標値との比較、達成率プログレスバー
- **HIGHLIGHT**: 一言サマリー（手入力テキストエリア）
- **投稿統計**: 投稿数、投稿頻度（週あたり）、前期間との差

### 2ページ目: 投稿一覧

- 全投稿を新しい順に表示
- **ER上位2件**: 詳細カード形式
  - サムネイル画像、タイトル、投稿日時
  - 6指標グリッド（再生, リーチ, いいね, 保存, シェア, コメント）
  - KPIバッジ（ER, 保存率）
- **残りの投稿**: コンパクトテーブル
  - 列: 日付, タイトル, 再生, リーチ, 保存, ER

### 3ページ目: 推移 + 考察

- **月次推移チャート**: 棒グラフ（リーチ数）
- **月別サマリーテーブル**: 過去数ヶ月分 + 平均列
  - 行: reach, likes, saves, shares, 投稿数, ER
- **ANALYSIS（考察）**: 手入力テキストエリア
- **NEXT MONTH（来月のアクション）**: 手入力テキストエリア

---

## 技術設計

### ページ構成

- **URL**: `/accounts/{accountId}/report`
- **クライアントコンポーネント**: レポートデータの取得・表示・印刷
- 既存のアカウント詳細ページからリンクで遷移

### 期間選択

- レポートページ上部に開始日・終了日のdate picker
- デフォルト: 今月1日〜今日
- 前月同期間は自動計算（先月の同じ日数分）

### データソース

| データ | 取得元 | 用途 |
|--------|--------|------|
| 今期間の投稿+指標 | IG Media + Insights API（既存エンドポイント） | 投稿一覧、KPI |
| 今期間のチャンネルサマリー | IG Account Insights API（既存エンドポイント） | サマリーテーブル |
| 前月同期間のチャンネルサマリー | IG Account Insights API（同上、期間指定変更） | 前月比計算 |
| 月次推移データ | `monthlySummaries` コレクション | 推移チャート・テーブル |

### 印刷用CSS

- `@media print` でA4サイズ最適化
- `@page { size: A4; margin: 0; }` でブラウザデフォルトのヘッダー/フッター除去
- 各ページを `page-break-after: always` で区切り
- 画面上は印刷プレビュー風にA4カード表示、上部に「印刷」ボタン

### 手入力欄

- HIGHLIGHT, ANALYSIS, NEXT MONTH は `<textarea>` でレポートページ上で直接入力
- 入力内容はFirestoreに保存（`accounts/{accountId}/reports/{reportId}`）
- 印刷時はtextareaがプレーンテキストとして印刷される

### 新コレクション: reports

```
accounts/{accountId}/reports/{id}
  periodStart: Timestamp
  periodEnd: Timestamp
  highlight: string
  analysis: string
  nextActions: string
  createdAt: Timestamp
  updatedAt: Timestamp
```

---

## 変更ファイル一覧

| ファイル | 変更 |
|---------|------|
| `src/app/(dashboard)/accounts/[accountId]/report/page.tsx` | **新規**: レポートページ |
| `src/components/report/ReportPage1.tsx` | **新規**: サマリーページ |
| `src/components/report/ReportPage2.tsx` | **新規**: 投稿一覧ページ |
| `src/components/report/ReportPage3.tsx` | **新規**: 推移+考察ページ |
| `src/components/report/report-print.css` | **新規**: A4印刷用CSS |
| `src/lib/firebase/firestore.ts` | `Report` 型 + CRUD追加 |
| `firestore.rules` | `reports` コレクションのルール追加（既存） |
| `src/app/(dashboard)/accounts/[accountId]/page.tsx` | 「レポート作成」リンク追加 |

## スコープ外

- レポートの自動生成（手動で期間選択→印刷の流れ）
- レポートのテンプレート切り替え（IG固定）
- レポートの共有URL生成
- PDF自動ダウンロード（ブラウザ印刷で対応）
- ANALYSIS / NEXT MONTH の自動生成（将来的にはAIで提案可能）
