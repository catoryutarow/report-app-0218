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
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronDown, ChevronUp, Trash2, Save } from "lucide-react";
import type { PlatformConfig } from "@/lib/platforms/types";
import { TagSelector } from "./TagSelector";
import { calculatePostKpis } from "@/lib/kpi/calculator";
import {
  createSnapshotWithPosts,
  addPostsToSnapshot,
  type Post,
  type Account,
  type Snapshot,
} from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  account: Account;
  config: PlatformConfig;
  onComplete: () => void;
  /** When set, skip period selection and add posts to this existing snapshot */
  targetSnapshot?: Snapshot | null;
};

type Step = "period" | "entry" | "saving";

type DraftPost = {
  permalink: string;
  publishedAt: string;
  capturedAt: string;
  metrics: Record<string, number>;
  tags: Record<string, string>;
};

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(now) };
}

const dateInputClass =
  "flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

export function QuickEntryDialog({
  open,
  onOpenChange,
  accountId,
  account,
  config,
  onComplete,
  targetSnapshot,
}: Props) {
  // If adding to existing snapshot, skip directly to entry step
  const [step, setStep] = useState<Step>(targetSnapshot ? "entry" : "period");
  const [periodStart, setPeriodStart] = useState(defaultPeriod().start);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod().end);

  // Entries already saved
  const [entries, setEntries] = useState<DraftPost[]>([]);

  // Current form fields
  const [showOptional, setShowOptional] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [currentPermalink, setCurrentPermalink] = useState("");
  const [currentPublishedAt, setCurrentPublishedAt] = useState("");
  const [currentCapturedAt, setCurrentCapturedAt] = useState("");
  const [currentMetrics, setCurrentMetrics] = useState<Record<string, string>>({});
  const [currentTags, setCurrentTags] = useState<Record<string, string>>({});

  const requiredMetrics = config.metrics.filter((m) => m.required);
  const optionalMetrics = config.metrics.filter((m) => !m.required);

  const resetForm = () => {
    setCurrentPermalink("");
    setCurrentPublishedAt("");
    setCurrentCapturedAt("");
    setCurrentMetrics({});
    setCurrentTags({});
    setShowOptional(false);
    setShowTags(false);
  };

  const resetAll = () => {
    setStep(targetSnapshot ? "entry" : "period");
    setEntries([]);
    resetForm();
    const p = defaultPeriod();
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
  };

  const addEntry = () => {
    // Validate required metrics
    const metrics: Record<string, number> = {};
    for (const m of requiredMetrics) {
      const v = currentMetrics[m.key];
      if (!v || v.trim() === "" || isNaN(Number(v))) {
        toast.error(`${m.label}を入力してください`);
        return;
      }
      metrics[m.key] = Number(v);
    }
    // Optional metrics
    for (const m of optionalMetrics) {
      const v = currentMetrics[m.key];
      if (v && v.trim() !== "" && !isNaN(Number(v))) {
        metrics[m.key] = Number(v);
      }
    }

    setEntries((prev) => [
      ...prev,
      {
        permalink: currentPermalink,
        publishedAt: currentPublishedAt,
        capturedAt: currentCapturedAt || new Date().toISOString().slice(0, 16),
        metrics,
        tags: { ...currentTags },
      },
    ]);

    resetForm();
    toast.success(`${entries.length + 1}件目を追加しました`);
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (entries.length === 0) {
      toast.error("1件以上の投稿を入力してください");
      return;
    }
    if (!targetSnapshot && (!periodStart || !periodEnd)) {
      toast.error("対象期間を指定してください");
      return;
    }

    setStep("saving");

    try {
      const posts: Omit<Post, "id">[] = entries.map((entry, i) => {
        const metrics = entry.metrics;

        let publishedAt: Timestamp;
        if (entry.publishedAt) {
          const d = new Date(entry.publishedAt);
          publishedAt = isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
        } else {
          publishedAt = Timestamp.now();
        }

        let capturedAt: Timestamp;
        if (entry.capturedAt) {
          const d = new Date(entry.capturedAt);
          capturedAt = isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
        } else {
          capturedAt = Timestamp.now();
        }

        const calculatedKpis = calculatePostKpis(config.kpis, metrics);

        return {
          postKey: `manual_${Date.now()}_${i + 1}`,
          title: "",
          publishedAt,
          capturedAt,
          permalink: entry.permalink,
          tags: entry.tags as { format?: string; theme?: string; cta?: string; hook?: string },
          metrics,
          calculatedKpis,
          source: "manual" as const,
        };
      });

      if (targetSnapshot?.id) {
        // Add posts to existing snapshot
        await addPostsToSnapshot(accountId, targetSnapshot.id, posts);
        toast.success(
          `${posts.length}件を「${targetSnapshot.label}」に追加しました（計${targetSnapshot.postCount + posts.length}件）`
        );
      } else {
        // Create new snapshot
        const totals: Record<string, number> = {};
        for (const post of posts) {
          for (const [key, val] of Object.entries(post.metrics)) {
            totals[key] = (totals[key] ?? 0) + val;
          }
        }

        const startDate = new Date(periodStart);
        const endDate = new Date(periodEnd);
        const fmtJa = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
        const label = `${startDate.getFullYear()}年 ${fmtJa(startDate)}〜${fmtJa(endDate)}`;

        await createSnapshotWithPosts(
          accountId,
          {
            periodStart: Timestamp.fromDate(startDate),
            periodEnd: Timestamp.fromDate(endDate),
            importedAt: Timestamp.now(),
            label,
            postCount: posts.length,
            totals,
          },
          posts
        );

        toast.success(`${posts.length}件をスナップショット「${label}」として保存しました`);
      }

      resetAll();
      onComplete();
    } catch (error) {
      toast.error("保存に失敗しました");
      console.error(error);
      setStep("entry");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) resetAll();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {targetSnapshot
              ? `投稿を追加 - ${targetSnapshot.label}`
              : `投稿データ入力 - ${config.label}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step: Period */}
        {step === "period" && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">対象期間</p>
              <p className="text-xs text-muted-foreground">
                レポート対象期間を指定してください
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className={dateInputClass}
                />
                <span className="text-muted-foreground">〜</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className={dateInputClass}
                />
              </div>
            </div>

            {/* Platform-specific guidance */}
            <PlatformInputGuide config={config} />

            <div className="flex justify-end">
              <Button onClick={() => setStep("entry")}>
                投稿を入力する
              </Button>
            </div>
          </div>
        )}

        {/* Step: Entry */}
        {step === "entry" && (
          <div className="space-y-4">
            {/* Period / target snapshot summary */}
            <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm flex items-center justify-between">
              <span>
                {targetSnapshot
                  ? <>追加先: <strong>{targetSnapshot.label}</strong>（現在{targetSnapshot.postCount}件）</>
                  : <>対象期間: <strong>{periodStart}</strong> 〜 <strong>{periodEnd}</strong></>
                }
              </span>
              {entries.length > 0 && (
                <Badge variant="secondary">{entries.length}件入力済み</Badge>
              )}
            </div>

            {/* Current entry form */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">
                投稿 #{entries.length + 1}
              </p>

              {/* URL, dates */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">投稿URL（任意）</Label>
                  <Input
                    value={currentPermalink}
                    onChange={(e) => setCurrentPermalink(e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">投稿日時</Label>
                  <input
                    type="datetime-local"
                    value={currentPublishedAt}
                    onChange={(e) => setCurrentPublishedAt(e.target.value)}
                    className={dateInputClass}
                  />
                </div>
              </div>

              {/* Captured at (when data was recorded) */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">
                    データ記録日時
                    <span className="text-muted-foreground ml-1">
                      （スクショ撮影時刻。空欄=今）
                    </span>
                  </Label>
                  <input
                    type="datetime-local"
                    value={currentCapturedAt}
                    onChange={(e) => setCurrentCapturedAt(e.target.value)}
                    className={dateInputClass}
                  />
                </div>
                <div className="flex items-end pb-1">
                  {currentPublishedAt && (
                    <CaptureDelayBadge
                      publishedAt={currentPublishedAt}
                      capturedAt={currentCapturedAt || new Date().toISOString().slice(0, 16)}
                    />
                  )}
                </div>
              </div>

              {/* Required metrics - always visible */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  必須指標
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {requiredMetrics.map((m) => (
                    <div key={m.key} className="space-y-1">
                      <Label className="text-xs">
                        {m.label}
                        <span className="text-destructive ml-0.5">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step={m.type === "float" || m.type === "currency" ? "0.01" : "1"}
                        value={currentMetrics[m.key] ?? ""}
                        onChange={(e) =>
                          setCurrentMetrics((prev) => ({
                            ...prev,
                            [m.key]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional metrics - collapsible */}
              {optionalMetrics.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOptional(!showOptional)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showOptional ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    任意指標（{optionalMetrics.length}件）
                  </button>
                  {showOptional && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-2">
                      {optionalMetrics.map((m) => (
                        <div key={m.key} className="space-y-1">
                          <Label className="text-xs">{m.label}</Label>
                          <Input
                            type="number"
                            min="0"
                            step={m.type === "float" || m.type === "currency" ? "0.01" : "1"}
                            value={currentMetrics[m.key] ?? ""}
                            onChange={(e) =>
                              setCurrentMetrics((prev) => ({
                                ...prev,
                                [m.key]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tags - collapsible */}
              {config.tagDimensions.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTags(!showTags)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showTags ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    分類タグ（{config.tagDimensions.length}件）
                  </button>
                  {showTags && (
                    <div className="grid gap-3 sm:grid-cols-2 mt-2">
                      {config.tagDimensions.map((dim) => (
                        <TagSelector
                          key={dim.key}
                          dimension={dim}
                          customOptions={account.tags[dim.key as keyof typeof account.tags]}
                          value={currentTags[dim.key] ?? ""}
                          onChange={(v) =>
                            setCurrentTags((prev) => ({ ...prev, [dim.key]: v }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Add button */}
              <div className="flex justify-end pt-1">
                <Button onClick={addEntry} size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  追加して次へ
                </Button>
              </div>
            </div>

            {/* List of entered posts */}
            {entries.length > 0 && (
              <div className="border rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  入力済み（{entries.length}件）
                </p>
                {entries.map((entry, i) => {
                  const summary = requiredMetrics
                    .slice(0, 3)
                    .map((m) => `${m.label}: ${entry.metrics[m.key]?.toLocaleString("ja-JP") ?? 0}`)
                    .join("  ");
                  const delay = formatCaptureDelay(entry.publishedAt, entry.capturedAt);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs py-1.5 border-b last:border-0"
                    >
                      <span className="text-muted-foreground min-w-0 truncate">
                        <span className="font-medium text-foreground">#{i + 1}</span>{" "}
                        {summary}
                        {delay && (
                          <span className="ml-1.5 text-amber-600">({delay})</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEntry(i)}
                        className="shrink-0 ml-2 p-1 hover:bg-muted rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom actions */}
            <div className={`flex pt-2 ${targetSnapshot ? "justify-end" : "justify-between"}`}>
              {!targetSnapshot && (
                <Button variant="outline" size="sm" onClick={() => setStep("period")}>
                  戻る
                </Button>
              )}
              <Button onClick={handleSave} disabled={entries.length === 0}>
                <Save className="mr-1 h-4 w-4" />
                {targetSnapshot
                  ? `${entries.length}件を追加`
                  : `${entries.length}件を保存`}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Saving */}
        {step === "saving" && (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">保存中...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Platform-specific data input instructions */
function PlatformInputGuide({ config }: { config: PlatformConfig }) {
  const guides: Record<string, { steps: string[]; tip?: string }> = {
    ig_feed: {
      steps: [
        "Instagramアプリで対象の投稿を開く",
        "「インサイトを見る」をタップ",
        "リーチ、いいね、保存数、コメントなどを確認",
        "下記フォームに数値を入力",
      ],
      tip: "PCの場合はMeta Business Suite → コンテンツ → 投稿をクリックで同じ数値が見られます",
    },
    ig_reel: {
      steps: [
        "Instagramアプリでリール投稿を開く",
        "「インサイトを見る」をタップ",
        "再生数、リーチ、いいね、保存数などを確認",
        "下記フォームに数値を入力",
      ],
      tip: "合計再生時間と動画の長さを入力すると、平均視聴時間が自動計算されます",
    },
    tiktok: {
      steps: [
        "TikTokアプリで対象の動画を開く",
        "「...」→「アナリティクス」をタップ",
        "再生数、いいね、コメントなどを確認",
        "下記フォームに数値を入力",
      ],
      tip: "投稿から24h後を目安にデータを記録してください。スクショを先に撮り、後から入力してもOKです",
    },
    x: {
      steps: [
        "X (Twitter) で対象の投稿を開く",
        "投稿下部の棒グラフアイコンをタップ",
        "インプレッション、エンゲージメントなどを確認",
        "下記フォームに数値を入力",
      ],
      tip: "X Premiumの場合はanalytics.x.comからCSV一括出力も可能です",
    },
  };

  const guide = guides[config.id];
  if (!guide) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4 space-y-2">
      <p className="text-sm font-medium">データの取得方法</p>
      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
        {guide.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {guide.tip && (
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
          {guide.tip}
        </p>
      )}
    </div>
  );
}

/** Format the delay between publishing and data capture */
export function formatCaptureDelay(publishedAt: string, capturedAt: string): string | null {
  if (!publishedAt || !capturedAt) return null;
  const pub = new Date(publishedAt);
  const cap = new Date(capturedAt);
  if (isNaN(pub.getTime()) || isNaN(cap.getTime())) return null;
  const diffMs = cap.getTime() - pub.getTime();
  if (diffMs < 0) return null;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "1h未満";
  if (hours < 48) return `${hours}h後`;
  const days = Math.floor(hours / 24);
  return `${days}日後`;
}

/** Inline badge showing capture delay */
function CaptureDelayBadge({
  publishedAt,
  capturedAt,
}: {
  publishedAt: string;
  capturedAt: string;
}) {
  const delay = formatCaptureDelay(publishedAt, capturedAt);
  if (!delay) return null;
  return (
    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
      投稿から{delay}に記録
    </Badge>
  );
}
