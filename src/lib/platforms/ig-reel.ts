import type { PlatformConfig } from "./types";

export const igReelConfig: PlatformConfig = {
  id: "ig_reel",
  label: "Instagram リール",
  icon: "clapperboard",
  metrics: [
    {
      key: "plays",
      label: "再生数",
      type: "integer",
      required: true,
      csvAliases: ["再生数", "再生回数", "plays", "Plays", "動画の再生数"],
    },
    {
      key: "reach",
      label: "リーチ",
      type: "integer",
      required: true,
      csvAliases: ["リーチ", "reach", "Reach", "リーチしたアカウント数"],
    },
    {
      key: "total_watch_time_ms",
      label: "合計再生時間(ms)",
      type: "integer",
      required: true,
      csvAliases: ["合計再生時間", "total_watch_time", "Total watch time"],
      description: "平均視聴時間の算出に必須。Mosseri公認: watch timeはリール推薦の最重要シグナル。",
    },
    {
      key: "duration_sec",
      label: "動画の長さ(秒)",
      type: "float",
      required: true,
      csvAliases: ["動画の長さ", "duration_sec", "duration", "Duration"],
      description: "維持率の算出に必須。",
    },
    {
      key: "likes",
      label: "いいね！",
      type: "integer",
      required: true,
      csvAliases: ["いいね！", "いいね", "likes", "Likes"],
      description: "saves/sharesより軽いシグナルだが、likes per reachはMosseri公認の3大要素の一つ。",
    },
    {
      key: "comments",
      label: "コメント",
      type: "integer",
      required: true,
      csvAliases: ["コメント", "コメント数", "comments", "Comments"],
      description: "heavy interaction。コミュニティ形成のシグナル。",
    },
    {
      key: "saves",
      label: "保存数",
      type: "integer",
      required: true,
      csvAliases: ["保存数", "保存", "saves", "Saves"],
      description: "heavy interaction。「後で見返す価値がある」=コンテンツ品質のシグナル。教育系・ハウツー系で特に重要。",
    },
    {
      key: "shares",
      label: "シェア",
      type: "integer",
      required: true,
      csvAliases: ["シェア", "シェア数", "shares", "Shares"],
      description: "DM送信(sends)はいいねの3〜5倍の重み。リール拡散の最強シグナル。",
    },
    {
      key: "follows",
      label: "フォロー",
      type: "integer",
      required: false,
      csvAliases: ["フォロー", "follows", "Follows"],
    },
  ],
  kpis: [
    {
      key: "avg_watch_time_sec",
      label: "平均視聴時間(秒)",
      format: "duration",
      calculate: (m) =>
        m.plays > 0 && m.total_watch_time_ms != null
          ? m.total_watch_time_ms / 1000 / m.plays
          : null,
      weightedParts: (m) => ({
        numerator: (m.total_watch_time_ms ?? 0) / 1000,
        denominator: m.plays ?? 0,
      }),
      higherIsBetter: true,
      description: "リール推薦アルゴリズムの最重要シグナル。視聴完了・ループ再生を促すコンテンツが有利。",
    },
    {
      key: "er",
      label: "エンゲージメント率",
      format: "percent",
      calculate: (m) => {
        const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0);
        return m.reach > 0 ? eng / m.reach : null;
      },
      weightedParts: (m) => ({
        numerator: (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0),
        denominator: m.reach ?? 0,
      }),
    },
    {
      key: "save_rate",
      label: "保存率",
      format: "percent",
      calculate: (m) => (m.reach > 0 ? (m.saves ?? 0) / m.reach : null),
      weightedParts: (m) => ({ numerator: m.saves ?? 0, denominator: m.reach ?? 0 }),
      description: "保存数 ÷ リーチ。コンテンツの価値を示すheavy interactionシグナル。",
    },
  ],
  tagDimensions: [
    { key: "format", label: "カテゴリ", examples: ["教育", "エンタメ", "商品紹介", "Vlog"] },
    { key: "hook", label: "フック種類", examples: ["結論先出し", "問いかけ", "衝撃映像", "ギャップ"] },
    { key: "theme", label: "テーマ", examples: ["ハウツー", "日常", "トレンド"] },
    { key: "cta", label: "CTA", examples: ["フォロー促進", "保存推奨", "コメント誘導"] },
  ],
  defaultTargets: {
    er: 0.04,
    save_rate: 0.02,
  },
};
