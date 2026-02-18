import type { PlatformConfig } from "./types";

export const tiktokConfig: PlatformConfig = {
  id: "tiktok",
  label: "TikTok",
  icon: "music",
  metrics: [
    {
      key: "views",
      label: "再生数",
      type: "integer",
      required: true,
      csvAliases: ["再生数", "動画再生数", "views", "Views", "Video views"],
    },
    {
      key: "likes",
      label: "いいね",
      type: "integer",
      required: true,
      csvAliases: ["いいね", "いいね数", "likes", "Likes"],
    },
    {
      key: "comments",
      label: "コメント",
      type: "integer",
      required: true,
      csvAliases: ["コメント", "コメント数", "comments", "Comments"],
    },
    {
      key: "shares",
      label: "シェア",
      type: "integer",
      required: true,
      csvAliases: ["シェア", "シェア数", "shares", "Shares"],
      description: "FYP推薦の重要シグナル。バイラル拡散に直結。",
    },
    {
      key: "saves",
      label: "保存数",
      type: "integer",
      required: true,
      csvAliases: ["保存数", "保存", "ブックマーク", "saves", "Saves", "Bookmarks"],
      description: "コンテンツ価値の強いシグナル。FYPランキングに影響。",
    },
    {
      key: "duration_sec",
      label: "動画の長さ(秒)",
      type: "float",
      required: true,
      csvAliases: ["動画の長さ", "duration", "Duration"],
      description: "維持率の算出に必須。",
    },
    {
      key: "avg_watch_time_sec",
      label: "平均視聴時間(秒)",
      type: "float",
      required: true,
      csvAliases: ["平均視聴時間", "avg_watch_time", "Average watch time"],
      description: "完走率=#1アルゴリズムシグナル。動画の長さと合わせて維持率を算出。",
    },
    {
      key: "profile_views",
      label: "プロフ閲覧数",
      type: "integer",
      required: false,
      csvAliases: ["プロフ閲覧", "profile_views", "Profile views"],
    },
    {
      key: "follows",
      label: "フォロワー増",
      type: "integer",
      required: false,
      csvAliases: ["フォロワー増", "follows", "New followers"],
    },
  ],
  kpis: [
    {
      key: "er",
      label: "エンゲージメント率",
      format: "percent",
      calculate: (m) => {
        const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
        return m.views > 0 ? eng / m.views : null;
      },
      weightedParts: (m) => ({
        numerator: (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0),
        denominator: m.views ?? 0,
      }),
    },
    {
      key: "retention_rate",
      label: "維持率",
      format: "percent",
      calculate: (m) =>
        m.duration_sec != null && m.duration_sec > 0 && m.avg_watch_time_sec != null
          ? m.avg_watch_time_sec / m.duration_sec
          : null,
      weightedParts: (m) => ({
        numerator: (m.avg_watch_time_sec ?? 0) * (m.views ?? 1),
        denominator: (m.duration_sec ?? 1) * (m.views ?? 1),
      }),
      description: "平均視聴時間 ÷ 動画の長さ。FYP推薦の#1シグナル。70%以上が目標。",
    },
    {
      key: "follow_rate",
      label: "フォロー率",
      format: "percent",
      calculate: (m) => (m.views > 0 ? (m.follows ?? 0) / m.views : null),
      weightedParts: (m) => ({ numerator: m.follows ?? 0, denominator: m.views ?? 0 }),
    },
  ],
  tagDimensions: [
    { key: "format", label: "ジャンル", examples: ["ルーティン", "検証", "踊ってみた", "ノウハウ"] },
    { key: "hook", label: "フック", examples: ["結論先出し", "問いかけ", "衝撃映像", "ギャップ"] },
    { key: "cta", label: "CTA", examples: ["リンククリック", "保存推奨", "コメント誘導"] },
    { key: "theme", label: "テーマ", examples: ["トレンド", "日常", "教育"] },
  ],
  defaultTargets: {
    er: 0.05,
    retention_rate: 0.7,
  },
};
