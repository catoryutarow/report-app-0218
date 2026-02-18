"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import type { PlatformConfig } from "@/lib/platforms/types";
import { updateSnapshot, type Snapshot } from "@/lib/firebase/firestore";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  snapshot: Snapshot;
  config: PlatformConfig;
  onComplete: () => void;
};

export function ChannelSummaryDialog({
  open,
  onOpenChange,
  accountId,
  snapshot,
  config,
  onComplete,
}: Props) {
  // Initialize from existing channelSummary if present
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (snapshot.channelSummary) {
      for (const [key, val] of Object.entries(snapshot.channelSummary)) {
        init[key] = String(val);
      }
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  // Show metrics that make sense at channel level (exclude per-post-only ones like duration)
  const channelMetrics = config.metrics.filter(
    (m) => !["duration_sec", "avg_watch_time_sec"].includes(m.key)
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const channelSummary: Record<string, number> = {};
      for (const m of channelMetrics) {
        const v = values[m.key];
        if (v && v.trim() !== "" && !isNaN(Number(v))) {
          channelSummary[m.key] = Number(v);
        }
      }

      await updateSnapshot(accountId, snapshot.id!, { channelSummary });
      toast.success("チャンネルサマリーを保存しました");
      onComplete();
    } catch (error) {
      toast.error("保存に失敗しました");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>チャンネルサマリー入力</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              {config.id === "tiktok"
                ? "TikTok Studio → アナリティクス → 概要から、対象期間の合計数値を入力してください。チャンネル全体の俯瞰指標として、投稿別の初動データとは別の視点でレポートに活用されます。"
                : "プラットフォームのアナリティクス概要画面から、対象期間の合計数値を入力してください。チャンネル全体の俯瞰指標として活用されます。"}
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm">
            スナップショット: <strong>{snapshot.label}</strong>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {channelMetrics.map((m) => (
              <div key={m.key} className="space-y-1">
                <Label className="text-xs">
                  {m.label}
                  {m.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step={m.type === "float" || m.type === "currency" ? "0.01" : "1"}
                  value={values[m.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [m.key]: e.target.value }))
                  }
                  placeholder={
                    snapshot.totals[m.key] != null
                      ? `投稿合計: ${snapshot.totals[m.key].toLocaleString("ja-JP")}`
                      : "0"
                  }
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>

          {Object.keys(snapshot.totals).length > 0 && (
            <p className="text-xs text-muted-foreground">
              ※ 入力欄のプレースホルダーは投稿データからの自動合計値です。
              投稿別データ＝初動パフォーマンス比較、チャンネルサマリー＝期間全体の俯瞰指標として、それぞれ独立に活用されます。
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
