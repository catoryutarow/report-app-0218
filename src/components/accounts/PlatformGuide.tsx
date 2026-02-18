"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PlatformConfig } from "@/lib/platforms/types";
import { formatKpiValue } from "@/lib/kpi/calculator";

type Props = {
  config: PlatformConfig;
  targets: Record<string, number>;
};

export function PlatformGuide({ config, targets }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between py-3"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="text-sm font-medium">
          {config.label} の使い方ガイド
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>

      {open && (
        <CardContent className="pt-0 space-y-5 text-sm">
          {/* Step 1: Data Input */}
          <section>
            <h3 className="font-medium mb-2">1. データの入力方法</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong>CSVアップロード（推奨）:</strong>
                「CSV」ボタンからファイルをドラッグ&ドロップ。カラム名は自動マッチされます。
                以下の日本語/英語カラム名に対応:
              </p>
              <div className="grid gap-1 ml-4">
                {config.metrics.filter((m) => m.required).map((m) => (
                  <span key={m.key}>
                    ・<strong>{m.label}</strong>（{m.csvAliases.slice(0, 3).join(" / ")}）
                  </span>
                ))}
              </div>
              <p>
                <strong>手動入力:</strong>
                「投稿追加」ボタンから1件ずつ入力。必須項目（*付き）を埋めればKPIが自動計算されます。
              </p>
            </div>
          </section>

          {/* Step 2: Metrics */}
          <section>
            <h3 className="font-medium mb-2">2. 入力する指標</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">指標名</th>
                    <th className="text-left px-3 py-2 font-medium">種別</th>
                    <th className="text-center px-3 py-2 font-medium">必須</th>
                  </tr>
                </thead>
                <tbody>
                  {config.metrics.map((m) => (
                    <tr key={m.key} className="border-t">
                      <td className="px-3 py-1.5">{m.label}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {{ integer: "整数", float: "小数", duration_sec: "秒数", currency: "金額" }[m.type]}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {m.required ? "◎" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Step 3: KPIs */}
          <section>
            <h3 className="font-medium mb-2">3. 自動計算されるKPI</h3>
            <p className="text-muted-foreground mb-2">
              投稿保存時に自動で算出されます。集計時は<strong>加重平均</strong>（合計÷合計）で計算され、
              投稿ごとの率の単純平均は使いません。
            </p>
            <div className="space-y-2">
              {config.kpis.map((kpi) => (
                <div key={kpi.key} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{kpi.label}</span>
                    {targets[kpi.key] != null && (
                      <span className="text-xs text-muted-foreground">
                        目標: {formatKpiValue(targets[kpi.key], kpi.format)}
                      </span>
                    )}
                  </div>
                  {kpi.description && (
                    <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {(kpi.higherIsBetter ?? true) ? "↑ 高いほど良い" : "↓ 低いほど良い"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Step 4: Tags */}
          <section>
            <h3 className="font-medium mb-2">4. 分類タグ</h3>
            <p className="text-muted-foreground mb-2">
              投稿にタグを付けると「どの企画が伸びたか」を分析できます。
              設定ページでカスタムタグを追加できます。
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {config.tagDimensions.map((dim) => (
                <div key={dim.key} className="border rounded-lg p-2">
                  <span className="font-medium text-xs">{dim.label}</span>
                  <p className="text-xs text-muted-foreground">
                    例: {dim.examples.join("、")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Step 5: Dashboard */}
          <section>
            <h3 className="font-medium mb-2">5. ダッシュボードの見方</h3>
            <div className="space-y-1 text-muted-foreground">
              <p>・<strong>KPIカード:</strong> 全投稿の加重平均値。目標との比較で↑↓が表示されます</p>
              <p>・<strong>推移グラフ:</strong> 週単位のKPI変化を折れ線で表示</p>
              <p>・<strong>前期比:</strong> 選択期間と前の同期間を比較。改善率を%で表示</p>
              <p>・<strong>TOP投稿:</strong> KPIが高い順にTOP5を自動ピックアップ</p>
              <p>・<strong>期間セレクター:</strong> 今週/先週/今月/先月/カスタム期間で絞り込み</p>
            </div>
          </section>
        </CardContent>
      )}
    </Card>
  );
}
