import type { PlatformConfig } from "./types";

export const xConfig: PlatformConfig = {
  id: "x",
  label: "X (Twitter)",
  icon: "at-sign",
  metrics: [
    {
      key: "impressions",
      label: "インプレッション",
      type: "integer",
      required: true,
      csvAliases: ["インプレッション", "表示回数", "impressions", "Impressions"],
    },
    {
      key: "engagements",
      label: "エンゲージメント",
      type: "integer",
      required: true,
      csvAliases: ["エンゲージメント", "反応合計", "engagements", "Engagements"],
    },
    {
      key: "likes",
      label: "いいね",
      type: "integer",
      required: true,
      csvAliases: ["いいね", "likes", "Likes"],
    },
    {
      key: "reposts",
      label: "リポスト",
      type: "integer",
      required: true,
      csvAliases: ["リポスト", "リツイート", "reposts", "Retweets", "Reposts"],
      description: "X最大のリーチ拡散シグナル。タイムライン外への到達を決定。",
    },
    {
      key: "replies",
      label: "返信",
      type: "integer",
      required: true,
      csvAliases: ["返信", "リプライ", "replies", "Replies"],
      description: "会話シグナル。Xアルゴリズムがスレッド形成を重視。",
    },
    {
      key: "bookmarks",
      label: "ブックマーク",
      type: "integer",
      required: true,
      csvAliases: ["ブックマーク", "bookmarks", "Bookmarks"],
      description: "保存=高品質コンテンツのシグナル。ER以上にアルゴリズム重視。",
    },
    {
      key: "profile_clicks",
      label: "プロフクリック",
      type: "integer",
      required: false,
      csvAliases: ["プロフクリック", "プロフィールクリック", "profile_clicks", "Profile clicks"],
    },
    {
      key: "link_clicks",
      label: "リンククリック",
      type: "integer",
      required: false,
      csvAliases: ["リンククリック", "link_clicks", "Link clicks", "URL clicks"],
    },
    {
      key: "media_views",
      label: "メディア再生",
      type: "integer",
      required: false,
      csvAliases: ["メディア再生", "media_views", "Media views"],
    },
    {
      key: "follows",
      label: "フォロー",
      type: "integer",
      required: false,
      csvAliases: ["フォロー", "フォロー増", "follows", "Follows"],
    },
  ],
  kpis: [
    {
      key: "er",
      label: "ER(エンゲージメント率)",
      format: "percent",
      calculate: (m) => (m.impressions > 0 ? (m.engagements ?? 0) / m.impressions : null),
      weightedParts: (m) => ({
        numerator: m.engagements ?? 0,
        denominator: m.impressions ?? 0,
      }),
      description: "エンゲージメント ÷ インプレッション。2〜5%以上が優秀。",
    },
    {
      key: "repost_rate",
      label: "RP率",
      format: "percent",
      calculate: (m) => (m.impressions > 0 ? (m.reposts ?? 0) / m.impressions : null),
      weightedParts: (m) => ({ numerator: m.reposts ?? 0, denominator: m.impressions ?? 0 }),
    },
    {
      key: "bookmark_rate",
      label: "BM率",
      format: "percent",
      calculate: (m) => (m.impressions > 0 ? (m.bookmarks ?? 0) / m.impressions : null),
      weightedParts: (m) => ({ numerator: m.bookmarks ?? 0, denominator: m.impressions ?? 0 }),
    },
    {
      key: "ctr",
      label: "CTR",
      format: "percent",
      calculate: (m) => (m.impressions > 0 ? (m.link_clicks ?? 0) / m.impressions : null),
      weightedParts: (m) => ({ numerator: m.link_clicks ?? 0, denominator: m.impressions ?? 0 }),
      description: "リンククリック ÷ インプレッション。1%超えで非常に優秀。",
    },
    {
      key: "follow_conversion",
      label: "フォロー転換率",
      format: "percent",
      calculate: (m) =>
        m.profile_clicks != null && m.profile_clicks > 0
          ? (m.follows ?? 0) / m.profile_clicks
          : null,
      weightedParts: (m) => ({
        numerator: m.follows ?? 0,
        denominator: m.profile_clicks ?? 0,
      }),
    },
  ],
  tagDimensions: [
    { key: "format", label: "投稿タイプ", examples: ["normal", "thread", "reply", "quote"] },
    { key: "theme", label: "テーマ", examples: ["ノウハウ", "実績", "日常", "告知"] },
    { key: "hook", label: "フック", examples: ["問いかけ", "衝撃の事実", "結論先出し", "数字訴求"] },
    { key: "cta", label: "CTA", examples: ["リプ欄見て", "プロフ見て", "リンク踏んで"] },
  ],
  defaultTargets: {
    er: 0.03,
    ctr: 0.01,
  },
};
