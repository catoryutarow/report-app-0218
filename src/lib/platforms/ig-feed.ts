import type { PlatformConfig } from "./types";

export const igFeedConfig: PlatformConfig = {
  id: "ig_feed",
  label: "Instagram フィード",
  icon: "instagram",
  metrics: [
    {
      key: "reach",
      label: "リーチ",
      type: "integer",
      required: true,
      csvAliases: ["リーチ", "reach", "Reach", "リーチしたアカウント数"],
    },
    {
      key: "impressions",
      label: "インプレッション",
      type: "integer",
      required: false,
      csvAliases: ["インプレッション", "impressions", "Impressions", "インプレッション数"],
    },
    {
      key: "saves",
      label: "保存数",
      type: "integer",
      required: true,
      csvAliases: ["保存数", "保存", "saves", "Saves"],
      description: "IGアルゴリズムの最重要heavy interactionの一つ。「後で見返す価値がある」=コンテンツ品質の最強シグナル。カルーセルで特に重要。",
    },
    {
      key: "likes",
      label: "いいね！",
      type: "integer",
      required: true,
      csvAliases: ["いいね！", "いいね", "likes", "Likes", "いいね！の数"],
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
      key: "shares",
      label: "シェア",
      type: "integer",
      required: true,
      csvAliases: ["シェア", "シェア数", "shares", "Shares"],
      description: "DM送信(sends)はいいねの3〜5倍の重み。新規リーチ拡大の最強シグナル。",
    },
    {
      key: "follows",
      label: "フォロー",
      type: "integer",
      required: false,
      csvAliases: ["フォロー", "follows", "Follows", "フォロー数"],
    },
  ],
  kpis: [
    {
      key: "save_rate",
      label: "保存率",
      format: "percent",
      calculate: (m) => (m.reach > 0 ? m.saves / m.reach : null),
      weightedParts: (m) => ({ numerator: m.saves ?? 0, denominator: m.reach ?? 0 }),
      description: "保存数 ÷ リーチ。2〜3%以上で良質コンテンツ。フィードではアルゴリズム最重要KPIの一つ。",
    },
    {
      key: "er",
      label: "エンゲージメント率",
      format: "percent",
      calculate: (m) => {
        const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
        return m.reach > 0 ? eng / m.reach : null;
      },
      weightedParts: (m) => ({
        numerator: (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0),
        denominator: m.reach ?? 0,
      }),
    },
    {
      key: "follow_rate",
      label: "フォロー率",
      format: "percent",
      calculate: (m) => (m.reach > 0 ? (m.follows ?? 0) / m.reach : null),
      weightedParts: (m) => ({ numerator: m.follows ?? 0, denominator: m.reach ?? 0 }),
    },
  ],
  tagDimensions: [
    { key: "format", label: "フォーマット", examples: ["静止画", "カルーセル"] },
    { key: "theme", label: "テーマ", examples: ["商品紹介", "ハウツー", "ユーザー事例"] },
    { key: "cta", label: "CTA", examples: ["保存してね", "プロフから購入", "コメント募集"] },
    { key: "hook", label: "フック", examples: ["問いかけ", "結論先出し", "ギャップ"] },
  ],
  defaultTargets: {
    save_rate: 0.03,
    er: 0.05,
    follow_rate: 0.005,
  },
};
