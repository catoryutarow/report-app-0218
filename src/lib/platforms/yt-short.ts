import type { PlatformConfig } from "./types";

export const ytShortConfig: PlatformConfig = {
  id: "yt_short",
  label: "YouTube ショート",
  icon: "smartphone",
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
      required: false,
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
      required: false,
      csvAliases: ["総再生時間（単位: 時間）", "総再生時間", "Watch time (hours)"],
    },
    {
      key: "avg_view_duration_sec",
      label: "平均視聴時間",
      type: "duration_sec",
      required: true,
      csvAliases: ["平均視聴時間", "Average view duration"],
      description: "CSVでは 0:00:11 形式。インポート時に自動で秒数に変換。ショートの完走率=#1アルゴリズムシグナル。",
    },
    {
      key: "avg_view_pct",
      label: "平均視聴率 (%)",
      type: "float",
      required: false,
      csvAliases: ["平均視聴率 (%)", "平均視聴率（%）", "Average percentage viewed (%)"],
      description: "YouTube Studioから既に%値で出力される（例: 85.0 = 85.0%）",
    },
    {
      key: "continued_watching_pct",
      label: "視聴を継続 (%)",
      type: "float",
      required: false,
      csvAliases: ["視聴を継続 (%)", "視聴を継続（%）", "Continued watching (%)"],
      description: "ショート視聴後に次の動画も見た割合。%値で出力される。",
    },
    {
      key: "duration_sec",
      label: "長さ",
      type: "integer",
      required: true,
      csvAliases: ["長さ", "duration", "Duration", "Video length"],
      description: "完走率の算出に必須。",
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
      description: "エンゲージメントシグナル。",
    },
    {
      key: "shares",
      label: "共有数",
      type: "integer",
      required: true,
      csvAliases: ["共有数", "shares", "Shares"],
      description: "ショートのバイラル拡散に直結。",
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
      key: "retention_rate",
      label: "維持率",
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
      description: "平均視聴時間 ÷ 動画の長さ。ショートでは80%以上が目標。",
    },
    {
      key: "subs_per_1k",
      label: "登録者/1000再生",
      format: "number",
      calculate: (m) =>
        m.views > 0 && m.subs_net != null ? (m.subs_net / m.views) * 1000 : null,
      weightedParts: (m) => ({
        numerator: (m.subs_net ?? 0) * 1000,
        denominator: m.views ?? 0,
      }),
      description: "チャンネル登録者純増 ÷ 視聴回数 × 1000",
    },
    {
      key: "er",
      label: "エンゲージメント率",
      format: "percent",
      calculate: (m) => {
        if (m.views <= 0) return null;
        const engagements = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0);
        return engagements / m.views;
      },
      weightedParts: (m) => ({
        numerator: (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0),
        denominator: m.views ?? 0,
      }),
      description: "（高評価+コメント+共有）÷ 視聴回数",
    },
  ],
  tagDimensions: [
    { key: "format", label: "企画タグ", examples: ["あるある", "ノウハウ", "検証", "Vlog"] },
    { key: "hook", label: "フック種類", examples: ["問いかけ", "衝撃映像", "結論から", "ギャップ"] },
    { key: "theme", label: "編集テンプレ", examples: ["テンポ重視", "字幕多め", "ASMR"] },
    { key: "cta", label: "CTA", examples: ["チャンネル登録", "高評価", "コメント促進"] },
  ],
  defaultTargets: {
    retention_rate: 0.8,
    subs_per_1k: 1.0,
  },
};
