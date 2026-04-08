"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Check, AlertTriangle, Loader2 } from "lucide-react";
import {
  createSnapshotWithPosts,
  addPostsToSnapshot,
  type Snapshot,
  type Post,
} from "@/lib/firebase/firestore";
import { toPlatformId } from "@/lib/ig/mapper";
import { calculatePostKpis } from "@/lib/kpi/calculator";
import { getPlatformConfig } from "@/lib/platforms";
import { toast } from "sonner";

type IgMedia = {
  igMediaId: string;
  caption: string;
  mediaType: string;
  mediaProductType: string;
  timestamp: string;
  permalink: string;
  thumbnailUrl: string | null;
};

type InsightResult = {
  igMediaId: string;
  platformId: "ig_feed" | "ig_reel";
  metrics: Record<string, number>;
  caption: string;
  permalink: string;
  timestamp: string;
  thumbnailUrl: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountPlatform: "ig_feed" | "ig_reel";
  existingPermalinks: Set<string>;
  snapshots: Snapshot[];
  onComplete: () => void;
};

export function IgImportDialog({
  open,
  onOpenChange,
  accountId,
  accountPlatform,
  existingPermalinks,
  snapshots,
  onComplete,
}: Props) {
  const [media, setMedia] = useState<IgMedia[]>([]);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [saveMode, setSaveMode] = useState<"new" | "existing">("new");
  const [targetSnapshotId, setTargetSnapshotId] = useState("");

  const [results, setResults] = useState<{
    success: InsightResult[];
    errors: Array<{ igMediaId: string; error: string }>;
  } | null>(null);

  const fetchMedia = async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/ig/media?limit=50&accountId=${accountId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "投稿一覧の取得に失敗しました");
        return;
      }
      setMedia(data.media ?? []);
    } catch {
      toast.error("投稿一覧の取得に失敗しました");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMedia();
      setResults(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredMedia = media.filter((m) => {
    const pid = toPlatformId(m.mediaType, m.mediaProductType);
    if (pid !== accountPlatform) return false;

    if (dateFrom || dateTo) {
      const postDate = parseISO(m.timestamp);
      if (dateFrom && postDate < parseISO(dateFrom)) return false;
      if (dateTo) {
        const endOfDay = new Date(parseISO(dateTo));
        endOfDay.setHours(23, 59, 59, 999);
        if (postDate > endOfDay) return false;
      }
    }
    return true;
  });

  // Auto-select visible, non-duplicate items whenever the filtered list changes
  useEffect(() => {
    const next = new Set<string>();
    for (const m of filteredMedia) {
      if (!existingPermalinks.has(m.permalink)) {
        next.add(m.igMediaId);
      }
    }
    setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, media]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = filteredMedia
      .filter((m) => !existingPermalinks.has(m.permalink))
      .map((m) => m.igMediaId);
    setSelected(new Set(ids));
  };

  const deselectAll = () => setSelected(new Set());

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);

    try {
      const res = await fetch("/api/ig/media/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: Array.from(selected), accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "指標の取得に失敗しました");
        return;
      }

      const successResults: InsightResult[] = data.results ?? [];
      const errorResults = data.errors ?? [];

      if (successResults.length === 0) {
        toast.error("インポートできる投稿がありませんでした");
        setResults({ success: [], errors: errorResults });
        return;
      }

      const config = getPlatformConfig(accountPlatform);
      const now = Timestamp.now();

      const posts: Omit<Post, "id">[] = successResults.map((r) => ({
        postKey: r.igMediaId,
        title: r.caption.slice(0, 60) || undefined,
        publishedAt: Timestamp.fromDate(parseISO(r.timestamp)),
        capturedAt: now,
        permalink: r.permalink,
        thumbnailUrl: r.thumbnailUrl ?? undefined,
        tags: {},
        metrics: r.metrics,
        calculatedKpis: calculatePostKpis(config.kpis, r.metrics),
        source: "api" as const,
      }));

      if (saveMode === "existing" && targetSnapshotId) {
        await addPostsToSnapshot(accountId, targetSnapshotId, posts);
      } else {
        const dates = successResults.map((r) => parseISO(r.timestamp));
        const periodStart = new Date(Math.min(...dates.map((d) => d.getTime())));
        const periodEnd = new Date(Math.max(...dates.map((d) => d.getTime())));

        await createSnapshotWithPosts(
          accountId,
          {
            periodStart: Timestamp.fromDate(periodStart),
            periodEnd: Timestamp.fromDate(periodEnd),
            importedAt: now,
            label: `${format(periodStart, "M/d")}〜${format(periodEnd, "M/d")}`,
            postCount: posts.length,
            totals: posts.reduce(
              (acc, p) => {
                for (const [k, v] of Object.entries(p.metrics)) {
                  acc[k] = (acc[k] ?? 0) + v;
                }
                return acc;
              },
              {} as Record<string, number>
            ),
          },
          posts
        );
      }

      setResults({ success: successResults, errors: errorResults });
      toast.success(`${successResults.length}件の投稿をインポートしました`);

      if (errorResults.length === 0) {
        onComplete();
      }
    } catch {
      toast.error("インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Instagram投稿をインポート</DialogTitle>
        </DialogHeader>

        {results ? (
          <div className="space-y-4">
            {results.success.length > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {results.success.length}件インポート完了
                </span>
              </div>
            )}
            {results.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {results.errors.length}件エラー
                  </span>
                </div>
                {results.errors.map((e) => (
                  <p key={e.igMediaId} className="text-xs text-muted-foreground">
                    {e.igMediaId}: {e.error}
                  </p>
                ))}
              </div>
            )}
            <Button onClick={() => onOpenChange(false)} size="sm">
              閉じる
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Date filter */}
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">開始日</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-sm w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">終了日</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-sm w-36"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchMedia}
                disabled={fetching}
              >
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "投稿を取得"}
              </Button>
            </div>

            {/* Media list */}
            {fetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMedia.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                対象の投稿が見つかりません
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selected.size}件選択中 / {filteredMedia.length}件
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={selectAll} className="text-xs h-7">
                      すべて選択
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deselectAll} className="text-xs h-7">
                      選択解除
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {filteredMedia.map((m) => {
                    const isDuplicate = existingPermalinks.has(m.permalink);
                    const isSelected = selected.has(m.igMediaId);

                    return (
                      <label
                        key={m.igMediaId}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                          isDuplicate ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDuplicate}
                          onChange={() => toggleSelect(m.igMediaId)}
                          className="rounded"
                        />
                        <span className="text-lg">
                          {m.mediaProductType === "REELS" ? "🎬" : "📷"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {m.caption.slice(0, 40) || "(キャプションなし)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(m.timestamp), "M/d HH:mm")}
                          </p>
                        </div>
                        {isDuplicate && (
                          <Badge variant="secondary" className="text-xs">
                            インポート済み
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {/* Save target */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">保存先</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="saveMode"
                    checked={saveMode === "new"}
                    onChange={() => setSaveMode("new")}
                  />
                  新規スナップショットを作成
                </label>
                {snapshots.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="saveMode"
                      checked={saveMode === "existing"}
                      onChange={() => setSaveMode("existing")}
                    />
                    既存スナップショットに追加:
                    <select
                      value={targetSnapshotId}
                      onChange={(e) => setTargetSnapshotId(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                      disabled={saveMode !== "existing"}
                    >
                      <option value="">選択...</option>
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {/* Import button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={
                  importing ||
                  selected.size === 0 ||
                  (saveMode === "existing" && !targetSnapshotId)
                }
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    取得中...
                  </>
                ) : (
                  <>
                    <Download className="mr-1 h-4 w-4" />
                    指標を取得してインポート ({selected.size}件)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
