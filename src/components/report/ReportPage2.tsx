"use client";

import type { Post } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";

type Props = {
  posts: Post[];
  config: PlatformConfig;
};

export function ReportPage2({ posts, config }: Props) {
  // Sort newest first
  const sorted = [...posts].sort(
    (a, b) => (b.publishedAt?.toDate?.()?.getTime() ?? 0) - (a.publishedAt?.toDate?.()?.getTime() ?? 0)
  );

  // Top 2 by ER
  const withER = sorted.map((p) => {
    const er = p.metrics.reach > 0
      ? ((p.metrics.likes ?? 0) + (p.metrics.comments ?? 0) + (p.metrics.saves ?? 0) + (p.metrics.shares ?? 0)) / p.metrics.reach
      : 0;
    return { ...p, er };
  });
  const topIds = new Set(
    [...withER].sort((a, b) => b.er - a.er).slice(0, 2).map((p) => p.id ?? p.postKey)
  );

  const displayMetrics = ["plays", "reach", "likes", "saves", "shares", "comments"]
    .map((key) => config.metrics.find((m) => m.key === key))
    .filter(Boolean) as typeof config.metrics;

  const formatDate = (p: Post) => {
    const d = p.publishedAt?.toDate?.();
    return d ? `${d.getMonth() + 1}/${d.getDate()}` : "—";
  };

  return (
    <div className="report-page">
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 14 }}>
        POSTS — 投稿一覧（新しい順）
      </div>

      {/* Top posts as detailed cards */}
      {sorted.filter((p) => topIds.has(p.id ?? p.postKey)).map((post, i) => {
        const er = post.metrics.reach > 0
          ? ((post.metrics.likes ?? 0) + (post.metrics.comments ?? 0) + (post.metrics.saves ?? 0) + (post.metrics.shares ?? 0)) / post.metrics.reach
          : 0;
        const saveRate = post.metrics.reach > 0 ? (post.metrics.saves ?? 0) / post.metrics.reach : 0;

        return (
          <div key={post.id ?? post.postKey} style={{
            padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 10, background: "#fafffe",
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              {post.thumbnailUrl ? (
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  style={{ width: 72, height: 72, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 72, height: 72, background: "#e5e7eb", borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                }}>
                  🎬
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                  {i === 0 ? "🥇" : "🥈"} {post.title ?? post.postKey}
                </div>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 6 }}>
                  {formatDate(post)} 投稿
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${displayMetrics.length}, 1fr)`, gap: 3 }}>
                  {displayMetrics.map((m) => (
                    <div key={m.key} style={{ textAlign: "center", padding: "4px 1px", background: "#f8f9fa", borderRadius: 3 }}>
                      <div style={{ fontSize: 8, color: "#888" }}>{m.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>
                        {(post.metrics[m.key] ?? 0).toLocaleString("ja-JP")}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 9 }}>
                  <span style={{ padding: "1px 6px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 8 }}>
                    ER {(er * 100).toFixed(2)}%
                  </span>
                  <span style={{
                    padding: "1px 6px", borderRadius: 8,
                    background: saveRate >= 0.02 ? "#dcfce7" : "#fef2f2",
                    color: saveRate >= 0.02 ? "#16a34a" : "#dc2626",
                  }}>
                    保存率 {(saveRate * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Remaining posts as compact table */}
      {sorted.filter((p) => !topIds.has(p.id ?? p.postKey)).length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#999", letterSpacing: 1, margin: "12px 0 8px" }}>
            その他の投稿
          </div>
          <table className="report-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>投稿</th>
                <th className="num">再生</th>
                <th className="num">リーチ</th>
                <th className="num">保存</th>
                <th className="num">ER</th>
              </tr>
            </thead>
            <tbody>
              {sorted.filter((p) => !topIds.has(p.id ?? p.postKey)).map((post) => {
                const er = post.metrics.reach > 0
                  ? ((post.metrics.likes ?? 0) + (post.metrics.comments ?? 0) + (post.metrics.saves ?? 0) + (post.metrics.shares ?? 0)) / post.metrics.reach
                  : 0;
                return (
                  <tr key={post.id ?? post.postKey}>
                    <td style={{ color: "#888", whiteSpace: "nowrap" }}>{formatDate(post)}</td>
                    <td style={{ maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {post.title ?? post.postKey}
                    </td>
                    <td className="num">{(post.metrics.plays ?? 0).toLocaleString("ja-JP")}</td>
                    <td className="num">{(post.metrics.reach ?? 0).toLocaleString("ja-JP")}</td>
                    <td className="num">{(post.metrics.saves ?? 0).toLocaleString("ja-JP")}</td>
                    <td className="num">{(er * 100).toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <div className="report-page-footer">
        <span />
        <span>2 / 3</span>
      </div>
    </div>
  );
}
