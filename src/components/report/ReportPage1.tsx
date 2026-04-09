"use client";

import type { Account } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";
import { formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  account: Account;
  config: PlatformConfig;
  periodLabel: string;
  currentMetrics: Record<string, number>;
  previousMetrics: Record<string, number>;
  currentKpis: Record<string, number>;
  targets: Record<string, number>;
  postCount: number;
  prevPostCount: number;
  periodDays: number;
  followersCount: number | null;
  highlight: string;
  onHighlightChange: (value: string) => void;
};

export function ReportPage1({
  account,
  config,
  periodLabel,
  currentMetrics,
  previousMetrics,
  currentKpis,
  targets,
  postCount,
  prevPostCount,
  periodDays,
  followersCount,
  highlight,
  onHighlightChange,
}: Props) {
  const displayMetrics = config.metrics.filter(
    (m) => currentMetrics[m.key] != null || previousMetrics[m.key] != null
  );

  return (
    <div className="report-page">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: "#999", letterSpacing: 2, textTransform: "uppercase" as const }}>
          Weekly Report
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{account.name}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
          @{account.handle} ・ {config.label}
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>{periodLabel}</div>
        {followersCount != null && (
          <div style={{ marginTop: 10, display: "inline-block", padding: "6px 16px", background: "#f8f9fa", borderRadius: 20 }}>
            <span style={{ fontSize: 11, color: "#888" }}>フォロワー </span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{followersCount.toLocaleString("ja-JP")}</span>
          </div>
        )}
      </div>

      {/* Metrics comparison table */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 10 }}>
          OVERVIEW — 前月同期間比
        </div>
        <table className="report-table">
          <thead>
            <tr>
              <th>指標</th>
              <th className="num">前月同期間</th>
              <th className="num" style={{ color: "#1a1a1a", fontWeight: 700 }}>今期間</th>
              <th className="num">増減</th>
              <th className="num">変化率</th>
            </tr>
          </thead>
          <tbody>
            {displayMetrics.map((m) => {
              const cur = currentMetrics[m.key] ?? 0;
              const prev = previousMetrics[m.key] ?? 0;
              const diff = cur - prev;
              const pct = prev > 0 ? ((cur - prev) / prev) * 100 : null;
              const cls = diff > 0 ? "text-positive" : diff < 0 ? "text-negative" : "";
              return (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td className="num" style={{ color: "#888" }}>{prev.toLocaleString("ja-JP")}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{cur.toLocaleString("ja-JP")}</td>
                  <td className={`num ${cls}`}>{diff > 0 ? "+" : ""}{diff.toLocaleString("ja-JP")}</td>
                  <td className={`num ${cls}`}>{pct != null ? `${diff > 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* KPIs */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 10 }}>
          KPI — 目標との比較
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${config.kpis.length}, 1fr)`, gap: 8 }}>
          {config.kpis.map((kpi) => {
            const value = currentKpis[kpi.key];
            const target = targets[kpi.key];
            const achieveRate = value != null && target ? Math.min(Math.round((value / target) * 100), 100) : null;
            const metTarget = value != null && target ? value >= target : null;
            return (
              <div key={kpi.key} style={{ textAlign: "center", padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "#888" }}>{kpi.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: metTarget === false ? "#dc2626" : "#1a1a1a" }}>
                  {formatKpiValue(value, kpi.format)}
                </div>
                {target != null && achieveRate != null && (
                  <>
                    <div style={{ fontSize: 10, color: "#888" }}>
                      目標 {formatKpiValue(target, kpi.format)}（{achieveRate}%）
                    </div>
                    <div style={{ marginTop: 4, height: 4, background: "#f0f0f0", borderRadius: 2 }}>
                      <div style={{
                        height: 4,
                        width: `${achieveRate}%`,
                        background: metTarget ? "#16a34a" : "#fbbf24",
                        borderRadius: 2,
                      }} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Highlight */}
      <div style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", letterSpacing: 1, marginBottom: 6 }}>
          HIGHLIGHT
        </div>
        <textarea
          className="report-editable-textarea"
          value={highlight}
          onChange={(e) => onHighlightChange(e.target.value)}
          placeholder="今期間のハイライトを入力..."
          style={{
            width: "100%", minHeight: 48, border: "1px solid #bbf7d0", borderRadius: 4,
            padding: 8, fontSize: 12, lineHeight: 1.6, resize: "vertical", background: "transparent",
          }}
        />
        <div className="report-editable-display" style={{ fontSize: 12, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {highlight}
        </div>
      </div>

      {/* Post stats */}
      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#888" }}>
        <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6 }}>
          投稿数: <strong style={{ color: "#1a1a1a" }}>{postCount}件</strong>
        </div>
        <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6 }}>
          週あたり: <strong style={{ color: "#1a1a1a" }}>{(postCount / Math.max(periodDays / 7, 1)).toFixed(1)}回</strong>
        </div>
        <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6 }}>
          前期間: <strong style={{ color: "#1a1a1a" }}>{prevPostCount}件</strong>
          （{postCount - prevPostCount >= 0 ? "+" : ""}{postCount - prevPostCount}件）
        </div>
      </div>

      <div className="report-page-footer">
        <span />
        <span>1 / 3</span>
      </div>
    </div>
  );
}
