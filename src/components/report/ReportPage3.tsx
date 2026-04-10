"use client";

import type { MonthlySummary } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";

type Props = {
  summaries: MonthlySummary[];
  config: PlatformConfig;
  analysis: string;
  onAnalysisChange: (value: string) => void;
  nextActions: string;
  onNextActionsChange: (value: string) => void;
};

export function ReportPage3({
  summaries,
  config,
  analysis,
  onAnalysisChange,
  nextActions,
  onNextActionsChange,
}: Props) {
  const sorted = [...summaries].sort(
    (a, b) => (a.periodEnd?.toDate?.()?.getTime() ?? 0) - (b.periodEnd?.toDate?.()?.getTime() ?? 0)
  );

  const displayMetrics = config.metrics.filter(
    (m) => summaries.some((s) => s.metrics[m.key] != null)
  );

  // Bar chart data (reach)
  const maxReach = Math.max(...sorted.map((s) => s.metrics.reach ?? 0), 1);

  // Average
  const avg = (key: string) => {
    const vals = sorted.map((s) => s.metrics[key]).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return (
    <div className="report-page">
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 14 }}>
        MONTHLY TREND — 月次推移
      </div>

      {/* Simple bar chart */}
      {sorted.length >= 2 && (
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10 }}>リーチ数</div>
          <div style={{ display: "flex", alignItems: "end", gap: 12, height: 100, padding: "0 8px" }}>
            {sorted.map((s, i) => {
              const val = s.metrics.reach ?? 0;
              const h = Math.max((val / maxReach) * 90, 4);
              const isLatest = i === sorted.length - 1;
              return (
                <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    background: isLatest ? "#2563eb" : "#93c5fd",
                    borderRadius: "3px 3px 0 0",
                    height: h,
                    marginBottom: 4,
                  }} />
                  <div style={{ fontSize: 9, color: "#888" }}>{s.label}</div>
                  <div style={{ fontSize: 10, fontWeight: isLatest ? 700 : 600 }}>
                    {val.toLocaleString("ja-JP")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trend table */}
      <div style={{ marginBottom: 14 }}>
        <table className="report-table">
          <thead>
            <tr>
              <th />
              {sorted.map((s, i) => (
                <th key={s.id} className="num" style={i === sorted.length - 1 ? { color: "#1a1a1a", fontWeight: 700 } : {}}>
                  {s.label}
                </th>
              ))}
              <th className="num">平均</th>
            </tr>
          </thead>
          <tbody>
            {displayMetrics.map((m) => {
              const a = avg(m.key);
              return (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  {sorted.map((s, i) => {
                    const val = s.metrics[m.key];
                    return (
                      <td key={s.id} className="num" style={i === sorted.length - 1 ? { fontWeight: 700 } : { color: "#888" }}>
                        {val != null ? val.toLocaleString("ja-JP") : "—"}
                      </td>
                    );
                  })}
                  <td className="num" style={{ color: "#888" }}>{a != null ? Math.round(a).toLocaleString("ja-JP") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Analysis */}
      <div style={{ padding: 12, background: "#f8f9fa", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#999", letterSpacing: 1, marginBottom: 6 }}>
          ANALYSIS — 考察
        </div>
        <textarea
          className="report-editable-textarea"
          value={analysis}
          onChange={(e) => onAnalysisChange(e.target.value)}
          placeholder="成長要因、課題、観察を入力..."
          style={{
            width: "100%", minHeight: 80, border: "1px solid #e5e7eb", borderRadius: 4,
            padding: 8, fontSize: 11, lineHeight: 1.7, resize: "vertical", background: "transparent",
          }}
        />
        <div className="report-editable-display" style={{ fontSize: 11, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {analysis}
        </div>
      </div>

      {/* Next actions */}
      <div style={{ padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#1d4ed8", letterSpacing: 1, marginBottom: 6 }}>
          NEXT ACTIONS — 次のアクション
        </div>
        <textarea
          className="report-editable-textarea"
          value={nextActions}
          onChange={(e) => onNextActionsChange(e.target.value)}
          placeholder="来期間のアクションプランを入力..."
          style={{
            width: "100%", minHeight: 80, border: "1px solid #bfdbfe", borderRadius: 4,
            padding: 8, fontSize: 11, lineHeight: 1.7, resize: "vertical", background: "transparent",
          }}
        />
        <div className="report-editable-display" style={{ fontSize: 11, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {nextActions}
        </div>
      </div>

      <div className="report-page-footer">
        <span>Generated by SNSレポート支援ツール</span>
        <span>3 / 3</span>
      </div>
    </div>
  );
}
