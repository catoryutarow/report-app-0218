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
import type { Post } from "@/lib/firebase/firestore";
import {
  updateSnapshotPost,
  recalcSnapshotTotals,
} from "@/lib/firebase/firestore";
import { calculatePostKpis } from "@/lib/kpi/calculator";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  snapshotId: string;
  post: Post;
  config: PlatformConfig;
  onComplete: () => void;
};

export function PostEditDialog({
  open,
  onOpenChange,
  accountId,
  snapshotId,
  post,
  config,
  onComplete,
}: Props) {
  const [metrics, setMetrics] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const def of config.metrics) {
      m[def.key] =
        post.metrics[def.key] != null ? String(post.metrics[def.key]) : "";
    }
    return m;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Parse metrics
      const parsed: Record<string, number> = {};
      for (const def of config.metrics) {
        const v = metrics[def.key];
        if (v != null && v.trim() !== "" && !isNaN(Number(v))) {
          parsed[def.key] = Number(v);
        } else if (def.required) {
          toast.error(`${def.label}を入力してください`);
          setSaving(false);
          return;
        }
      }

      // Recalculate KPIs
      const calculatedKpis = calculatePostKpis(config.kpis, parsed);

      await updateSnapshotPost(accountId, snapshotId, post.id!, {
        metrics: parsed,
        calculatedKpis,
      });

      // Recalc snapshot totals
      await recalcSnapshotTotals(accountId, snapshotId);

      toast.success("投稿データを更新しました");
      onComplete();
    } catch (error) {
      console.error(error);
      toast.error("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const requiredMetrics = config.metrics.filter((m) => m.required);
  const optionalMetrics = config.metrics.filter((m) => !m.required);

  const title = post.title || post.postKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">投稿を編集</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{title}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Required metrics */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">必須指標</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {requiredMetrics.map((m) => (
                <div key={m.key} className="space-y-1">
                  <Label className="text-xs">
                    {m.label}
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step={m.type === "float" ? "0.01" : "1"}
                    value={metrics[m.key] ?? ""}
                    onChange={(e) =>
                      setMetrics((prev) => ({
                        ...prev,
                        [m.key]: e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Optional metrics */}
          {optionalMetrics.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">任意指標</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {optionalMetrics.map((m) => (
                  <div key={m.key} className="space-y-1">
                    <Label className="text-xs">{m.label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step={m.type === "float" ? "0.01" : "1"}
                      value={metrics[m.key] ?? ""}
                      onChange={(e) =>
                        setMetrics((prev) => ({
                          ...prev,
                          [m.key]: e.target.value,
                        }))
                      }
                      placeholder="未入力"
                      className="h-8 text-sm"
                    />
                    {m.description && (
                      <p className="text-[10px] text-muted-foreground">
                        {m.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="w-full"
          >
            <Save className="mr-1 h-4 w-4" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
