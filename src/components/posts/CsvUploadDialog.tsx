"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Check, AlertTriangle, FileUp } from "lucide-react";
import type { PlatformConfig } from "@/lib/platforms/types";
import { parseCsvFile, parseCsvValue, type ParsedCsv } from "@/lib/csv/parser";
import {
  autoMapColumns,
  findSpecialColumn,
  type ColumnMapping,
} from "@/lib/csv/mapper";
import { calculatePostKpis } from "@/lib/kpi/calculator";
import { createSnapshotWithPosts, type Post } from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  config: PlatformConfig;
  onComplete: () => void;
};

type Step = "upload" | "mapping" | "importing";

/** Default period: 1st of current month to today */
function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(now) };
}

export function CsvUploadDialog({
  open,
  onOpenChange,
  accountId,
  config,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [specialMappings, setSpecialMappings] = useState<Record<string, string | null>>({});
  const [dragOver, setDragOver] = useState(false);

  // Period inputs for snapshot
  const [periodStart, setPeriodStart] = useState(defaultPeriod().start);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod().end);

  const resetState = () => {
    setStep("upload");
    setParsed(null);
    setMappings([]);
    setSpecialMappings({});
    const p = defaultPeriod();
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv") && !file.name.endsWith(".tsv")) {
        toast.error("CSVまたはTSVファイルを選択してください");
        return;
      }

      const result = await parseCsvFile(file);
      if (result.errors.length > 0 && result.rows.length === 0) {
        toast.error("CSVの読み込みに失敗しました: " + result.errors[0]);
        return;
      }

      setParsed(result);

      // Auto-map columns
      const autoMappings = autoMapColumns(result.headers, config.metrics);
      setMappings(autoMappings);

      // Auto-detect special columns
      setSpecialMappings({
        postKey: findSpecialColumn(result.headers, "postKey"),
        title: findSpecialColumn(result.headers, "title"),
        publishedAt: findSpecialColumn(result.headers, "publishedAt"),
        permalink: findSpecialColumn(result.headers, "permalink"),
      });

      setStep("mapping");
    },
    [config.metrics]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const updateMapping = (csvColumn: string, metricKey: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.csvColumn === csvColumn
          ? { ...m, metricKey, confidence: "manual" as const }
          : m
      )
    );
  };

  const handleImport = async () => {
    if (!parsed) return;

    if (!periodStart || !periodEnd) {
      toast.error("対象期間を指定してください");
      return;
    }

    setStep("importing");

    try {
      const posts: Omit<Post, "id">[] = [];
      const metricMappings = mappings.filter((m) => m.metricKey);
      const totals: Record<string, number> = {};
      let skippedCount = 0;

      // Build a lookup from metric key → metric type
      const metricTypeMap = new Map(
        config.metrics.map((m) => [m.key, m.type])
      );

      const skipColNames = [specialMappings.title, specialMappings.postKey].filter(Boolean) as string[];

      for (let i = 0; i < parsed.rows.length && i < 500; i++) {
        const row = parsed.rows[i];

        // Skip aggregate rows (YouTube Studio's "合計" row, etc.)
        const isAggregate = skipColNames.some((col) => {
          const v = (row[col] ?? "").trim();
          return v === "合計" || v === "Total";
        });
        if (isAggregate) continue;

        // Extract metrics using type-aware parsing
        const metrics: Record<string, number> = {};
        for (const mapping of metricMappings) {
          if (!mapping.metricKey) continue;
          const rawValue = row[mapping.csvColumn];
          if (rawValue != null && rawValue !== "") {
            const metricType = metricTypeMap.get(mapping.metricKey) ?? "float";
            const num = parseCsvValue(rawValue, metricType);
            if (num != null) {
              metrics[mapping.metricKey] = num;
              // Accumulate totals
              totals[mapping.metricKey] = (totals[mapping.metricKey] ?? 0) + num;
            }
          }
        }

        // Extract special columns
        const postKeyCol = specialMappings.postKey;
        const titleCol = specialMappings.title;
        const publishedAtCol = specialMappings.publishedAt;
        const permalinkCol = specialMappings.permalink;

        const postKey = postKeyCol ? row[postKeyCol] ?? `csv_${i + 1}` : `csv_${i + 1}`;
        const title = titleCol ? row[titleCol] ?? "" : "";
        const publishedAtRaw = publishedAtCol ? row[publishedAtCol] : null;
        let permalink = permalinkCol ? row[permalinkCol] ?? "" : "";

        // YouTube: filter long vs short content
        if (config.id === "yt_long" || config.id === "yt_short") {
          const isShort =
            /[#＃][Ss]horts?\b/.test(title) ||
            (metrics.duration_sec != null && metrics.duration_sec <= 60);
          if (config.id === "yt_long" && isShort) { skippedCount++; continue; }
          if (config.id === "yt_short" && !isShort) { skippedCount++; continue; }
        }

        // YouTube: auto-generate URL from video ID
        if (!permalink && postKey && !postKey.startsWith("csv_")) {
          if (config.id === "yt_short") {
            permalink = `https://www.youtube.com/shorts/${postKey}`;
          } else if (config.id === "yt_long") {
            permalink = `https://www.youtube.com/watch?v=${postKey}`;
          }
        }

        let publishedAt: Timestamp;
        if (publishedAtRaw) {
          const d = new Date(publishedAtRaw);
          publishedAt = isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);

          // Skip videos published before 2025-03-01
          if (!isNaN(d.getTime()) && d < new Date("2025-03-01")) {
            skippedCount++;
            continue;
          }
        } else {
          publishedAt = Timestamp.now();
        }

        const calculatedKpis = calculatePostKpis(config.kpis, metrics);

        posts.push({
          postKey,
          title,
          publishedAt,
          permalink,
          tags: {} as { format?: string; theme?: string; cta?: string; hook?: string },
          metrics,
          calculatedKpis,
          source: "csv" as const,
        });
      }

      // Build snapshot label
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const fmtJa = (d: Date) =>
        `${d.getMonth() + 1}/${d.getDate()}`;
      const label = `${startDate.getFullYear()}年 ${fmtJa(startDate)}〜${fmtJa(endDate)}`;

      // Create snapshot with posts
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

      const skipMsg = skippedCount > 0 ? `（${skippedCount}件スキップ）` : "";
      toast.success(`${posts.length}件をスナップショット「${label}」として保存しました${skipMsg}`);
      resetState();
      onComplete();
    } catch (error) {
      toast.error("インポートに失敗しました");
      console.error(error);
      setStep("mapping");
    }
  };

  const mappedCount = mappings.filter((m) => m.metricKey).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CSVアップロード - {config.label}</DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Period selection */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">対象期間</p>
              <p className="text-xs text-muted-foreground">
                YouTube Studioで選択したデータ期間を指定してください
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                />
                <span className="text-muted-foreground">〜</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <FileUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                CSVファイルをドラッグ&ドロップ
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                またはクリックしてファイルを選択
              </p>
              <label>
                <Button variant="outline" asChild>
                  <span>ファイルを選択</span>
                </Button>
                <input
                  type="file"
                  accept=".csv,.tsv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          </div>
        )}

        {/* Step: Mapping */}
        {step === "mapping" && parsed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {parsed.rows.length}行を検出 ・ {mappedCount}/{config.metrics.length}
                指標をマッチ
              </p>
              {parsed.errors.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {parsed.errors.length}件の警告
                </Badge>
              )}
            </div>

            {/* Period display */}
            <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm">
              対象期間: <strong>{periodStart}</strong> 〜 <strong>{periodEnd}</strong>
            </div>

            {/* Special column mappings */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">基本情報のマッピング</p>
              {(["postKey", "title", "publishedAt", "permalink"] as const).map((key) => {
                const labels = { postKey: "投稿ID", title: "タイトル", publishedAt: "投稿日時", permalink: "URL" };
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm w-20 shrink-0">{labels[key]}</span>
                    <Select
                      value={specialMappings[key] ?? "__none__"}
                      onValueChange={(v: string) =>
                        setSpecialMappings((prev) => ({
                          ...prev,
                          [key]: v === "__none__" ? null : v,
                        }))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="未選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">（なし）</SelectItem>
                        {parsed.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {specialMappings[key] && (
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Metric column mappings (exclude columns already used as special) */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">指標のマッピング</p>
              {mappings.filter((mapping) => {
                const usedSpecials = new Set(
                  Object.values(specialMappings).filter(Boolean)
                );
                return !usedSpecials.has(mapping.csvColumn);
              }).map((mapping) => (
                <div key={mapping.csvColumn} className="flex items-center gap-3">
                  <span className="text-sm w-40 shrink-0 truncate" title={mapping.csvColumn}>
                    {mapping.csvColumn}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <Select
                    value={mapping.metricKey ?? "__none__"}
                    onValueChange={(v: string) =>
                      updateMapping(mapping.csvColumn, v === "__none__" ? null : v)
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="未選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">（スキップ）</SelectItem>
                      {config.metrics.map((m) => (
                        <SelectItem key={m.key} value={m.key}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping.metricKey && (
                    <Badge
                      variant={mapping.confidence === "exact" ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {mapping.confidence === "exact"
                        ? "自動"
                        : mapping.confidence === "fuzzy"
                          ? "推定"
                          : "手動"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetState}>
                戻る
              </Button>
              <Button onClick={handleImport} disabled={mappedCount === 0}>
                <Upload className="mr-2 h-4 w-4" />
                {Math.min(parsed.rows.length, 500)}件をインポート
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">インポート中...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
