import type { PlatformConfig } from "./types";

export const ytLongConfig: PlatformConfig = {
  id: "yt_long",
  label: "YouTube 長尺動画",
  icon: "youtube",
  metrics: [
    {
      key: "views",
      label: "視聴回数",
      type: "integer",
      required: true,
      csvAliases: ["視聴回数", "views", "Views"],
    },
    {
      key: "impressions",
      label: "インプレッション数",
      type: "integer",
      required: true,
      csvAliases: ["インプレッション数", "impressions", "Impressions"],
    },
    {
      key: "ctr_pct",
      label: "インプレッションのクリック率 (%)",
      type: "float",
      required: false,
      csvAliases: ["インプレッションのクリック率 (%)", "インプレッションのクリック率（%）", "Impressions click-through rate (%)"],
      description: "YouTube Studioから既に%値で出力される（例: 4.39 = 4.39%）",
    },
    {
      key: "engaged_views",
      label: "エンゲージ ビュー",
      type: "integer",
      required: false,
      csvAliases: ["エンゲージ ビュー", "Engaged views"],
    },
    {
      key: "watch_time_hours",
      label: "総再生時間（単位: 時間）",
      type: "float",
      required: true,
      csvAliases: ["総再生時間（単位: 時間）", "総再生時間", "Watch time (hours)"],
      description: "YouTubeアルゴリズムの最重要指標。推薦・検索ランキングに直結。",
    },
    {
      key: "avg_view_duration_sec",
      label: "平均視聴時間",
      type: "duration_sec",
      required: true,
      csvAliases: ["平均視聴時間", "Average view duration"],
      description: "CSVでは 0:04:11 形式。インポート時に自動で秒数に変換。視聴維持率の算出に必須。",
    },
    {
      key: "avg_view_pct",
      label: "平均視聴率 (%)",
      type: "float",
      required: false,
      csvAliases: ["平均視聴率 (%)", "平均視聴率（%）", "Average percentage viewed (%)"],
      description: "YouTube Studioから既に%値で出力される（例: 25.63 = 25.63%）",
    },
    {
      key: "duration_sec",
      label: "長さ",
      type: "integer",
      required: false,
      csvAliases: ["長さ", "duration", "Duration", "Video length"],
    },
    {
      key: "likes",
      label: "高評価数",
      type: "integer",
      required: true,
      csvAliases: ["高評価数", "高評価", "likes", "Likes"],
    },
    {
      key: "dislikes",
      label: "低評価数",
      type: "integer",
      required: false,
      csvAliases: ["低評価数", "低評価", "dislikes", "Dislikes"],
    },
    {
      key: "comments",
      label: "コメントの追加回数",
      type: "integer",
      required: true,
      csvAliases: ["コメントの追加回数", "コメント", "コメント数", "comments", "Comments"],
      description: "エンゲージメントシグナル。コミュニティ活性度の指標。",
    },
    {
      key: "shares",
      label: "共有数",
      type: "integer",
      required: false,
      csvAliases: ["共有数", "shares", "Shares"],
    },
    {
      key: "subs_gained",
      label: "登録者増加数",
      type: "integer",
      required: false,
      csvAliases: ["登録者増加数", "Subscribers gained"],
    },
    {
      key: "subs_lost",
      label: "登録者減少数",
      type: "integer",
      required: false,
      csvAliases: ["登録者減少数", "Subscribers lost"],
    },
    {
      key: "subs_net",
      label: "チャンネル登録者",
      type: "integer",
      required: false,
      csvAliases: ["チャンネル登録者", "Subscribers"],
      description: "純増減（増加-減少）",
    },
    {
      key: "unique_viewers",
      label: "ユニーク視聴者数",
      type: "integer",
      required: false,
      csvAliases: ["ユニーク視聴者数", "Unique viewers"],
    },
    {
      key: "new_viewers",
      label: "新しい視聴者数",
      type: "integer",
      required: false,
      csvAliases: ["新しい視聴者数", "New viewers"],
    },
    {
      key: "returning_viewers",
      label: "リピーター",
      type: "integer",
      required: false,
      csvAliases: ["リピーター", "Returning viewers"],
    },
    {
      key: "estimated_revenue",
      label: "推定収益 (JPY)",
      type: "currency",
      required: false,
      csvAliases: ["推定収益 (JPY)", "推定収益", "estimated_revenue", "Estimated revenue (JPY)"],
    },
    {
      key: "like_rate_pct",
      label: "高評価率（低評価比） (%)",
      type: "float",
      required: false,
      csvAliases: ["高評価率（低評価比） (%)", "高評価率（低評価比）（%）"],
    },
    {
      key: "avg_views_per_viewer",
      label: "視聴者あたりの平均視聴回数",
      type: "float",
      required: false,
      csvAliases: ["視聴者あたりの平均視聴回数", "Average views per viewer"],
    },
    {
      key: "light_viewers",
      label: "ライトな視聴者",
      type: "integer",
      required: false,
      csvAliases: ["ライトな視聴者", "Light viewers"],
    },
    {
      key: "core_viewers",
      label: "コアな視聴者",
      type: "integer",
      required: false,
      csvAliases: ["コアな視聴者", "Core viewers"],
    },
    {
      key: "hype",
      label: "ハイプ",
      type: "integer",
      required: false,
      csvAliases: ["ハイプ", "Hype"],
    },
    {
      key: "hype_point",
      label: "ハイプポイント",
      type: "float",
      required: false,
      csvAliases: ["ハイプポイント", "Hype point"],
    },
  ],
  kpis: [
    {
      key: "ctr",
      label: "クリック率(CTR)",
      format: "percent",
      calculate: (m) => {
        // CSVから既に%値で取得される場合はそれを使う
        if (m.ctr_pct != null && m.ctr_pct > 0) return m.ctr_pct / 100;
        // なければ計算
        return m.impressions > 0 ? m.views / m.impressions : null;
      },
      weightedParts: (m) => ({ numerator: m.views ?? 0, denominator: m.impressions ?? 0 }),
      description: "視聴回数 ÷ インプレッション数。5〜10%が目標。",
    },
    {
      key: "avg_view_percentage",
      label: "平均再生率",
      format: "percent",
      calculate: (m) => {
        // CSVから既に%値で取得される場合
        if (m.avg_view_pct != null && m.avg_view_pct > 0) return m.avg_view_pct / 100;
        // なければ秒数から計算
        if (m.duration_sec > 0 && m.avg_view_duration_sec != null)
          return m.avg_view_duration_sec / m.duration_sec;
        return null;
      },
      weightedParts: (m) => ({
        numerator: (m.avg_view_duration_sec ?? 0) * (m.views ?? 1),
        denominator: (m.duration_sec ?? 1) * (m.views ?? 1),
      }),
      description: "平均視聴時間 ÷ 動画の長さ。40%以上が成功の目安。",
    },
    {
      key: "rpm",
      label: "RPM",
      format: "currency",
      calculate: (m) =>
        m.views > 0 && m.estimated_revenue != null
          ? (m.estimated_revenue / m.views) * 1000
          : null,
      weightedParts: (m) => ({
        numerator: (m.estimated_revenue ?? 0) * 1000,
        denominator: m.views ?? 0,
      }),
      description: "推定収益 ÷ 視聴回数 × 1000",
    },
  ],
  tagDimensions: [
    { key: "format", label: "企画形式", examples: ["リアクション", "解説", "対談", "Vlog", "レビュー", "配信"] },
    { key: "theme", label: "テーマ", examples: ["商品紹介", "ハウツー", "ニュース解説"] },
    { key: "hook", label: "サムネイル手法", examples: ["衝撃ワード", "ビフォーアフター", "数字訴求"] },
    { key: "cta", label: "CTA", examples: ["チャンネル登録", "高評価", "コメント促進"] },
  ],
  defaultTargets: {
    avg_view_percentage: 0.4,
    ctr: 0.05,
  },
};
