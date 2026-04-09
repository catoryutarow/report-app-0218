"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Upload, ArrowLeft, PenLine, Link2, Download, Presentation, CalendarSearch, GitCompareArrows, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Timestamp } from "firebase/firestore";
import {
  getAccount,
  getSnapshots,
  getSnapshotPosts,
  deleteSnapshot,
  createSnapshotWithPosts,
  updateSnapshotPost,
  getMonthlySummaries,
  createMonthlySummary,
  updateMonthlySummary,
  type Account,
  type Post,
  type Snapshot,
  type MonthlySummary,
} from "@/lib/firebase/firestore";
import { getPlatformConfig } from "@/lib/platforms";
import type { PlatformConfig } from "@/lib/platforms/types";
import { platformColors, platformEmoji } from "@/lib/platforms/utils";
import { KpiCardGrid } from "@/components/kpi/KpiCardGrid";
import { SnapshotSelector } from "@/components/kpi/SnapshotSelector";
import { SnapshotTrendChart } from "@/components/kpi/SnapshotTrendChart";
import { SnapshotComparisonCard } from "@/components/kpi/SnapshotComparisonCard";
import { TopPostsPanel } from "@/components/kpi/TopPostsPanel";
import { PostsTable } from "@/components/posts/PostsTable";
import { CsvUploadDialog } from "@/components/posts/CsvUploadDialog";
import { QuickEntryDialog } from "@/components/posts/QuickEntryDialog";
import { PostEditDialog } from "@/components/posts/PostEditDialog";
import { PlatformGuide } from "@/components/accounts/PlatformGuide";
import { MonthlySummaryPanel } from "@/components/kpi/MonthlySummaryPanel";
import { IgImportDialog } from "@/components/ig/IgImportDialog";
import { toPlatformId } from "@/lib/ig/mapper";
import { calculatePostKpis } from "@/lib/kpi/calculator";
import {
  buildCsvExport,
  buildJsonExport,
  downloadCsv,
  downloadJson,
} from "@/lib/export/snapshot-export";
import { buildSlideJson } from "@/lib/export/slide-json";
import { toast } from "sonner";

/** YouTube platforms use CSV as primary input */
const CSV_PRIMARY_PLATFORMS = new Set(["yt_long", "yt_short"]);

/** Instagram platforms support API import */
const IG_API_PLATFORMS = new Set(["ig_feed", "ig_reel"]);

/** Filter out aggregate rows like YouTube Studio's "合計" */
function filterAggregate(posts: Post[]): Post[] {
  const SKIP = new Set(["合計", "Total"]);
  return posts.filter((p) => !SKIP.has(p.title ?? "") && !SKIP.has(p.postKey));
}

/** Get Monday 00:00 of the week containing the given date */
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Format a snapshot label like "2026年 3/31〜4/6" */
function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const y = monday.getFullYear();
  return `${y}年 ${monday.getMonth() + 1}/${monday.getDate()}〜${sunday.getMonth() + 1}/${sunday.getDate()}`;
}

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [addToSnapshotOpen, setAddToSnapshotOpen] = useState(false);
  const [igImportOpen, setIgImportOpen] = useState(false);
  const [igConnected, setIgConnected] = useState(false);
  const [fetchingSummary, setFetchingSummary] = useState(false);
  const [fetchingWeekly, setFetchingWeekly] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Snapshot state
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const [currentPosts, setCurrentPosts] = useState<Post[]>([]);
  const [comparePosts, setComparePosts] = useState<Post[]>([]);
  const [allPermalinks, setAllPermalinks] = useState<Set<string>>(new Set());
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const acc = await getAccount(accountId);
      setAccount(acc);

      // Snapshots may fail (e.g. no index yet) - handle separately
      let snaps: Snapshot[] = [];
      try {
        snaps = await getSnapshots(accountId);
      } catch (e) {
        console.warn("スナップショット取得スキップ:", e);
      }
      setSnapshots(snaps);

      // Collect all permalinks across all snapshots for duplicate detection
      if (snaps.length > 0) {
        const allPostsArrays = await Promise.all(
          snaps.map((s) => getSnapshotPosts(accountId, s.id!))
        );
        const links = new Set<string>();
        for (const posts of allPostsArrays) {
          for (const p of posts) {
            if (p.permalink) links.add(p.permalink);
          }
        }
        setAllPermalinks(links);
      } else {
        setAllPermalinks(new Set());
      }

      // Load monthly summaries for IG accounts
      if (acc && IG_API_PLATFORMS.has(acc.platform)) {
        try {
          const ms = await getMonthlySummaries(accountId);
          setMonthlySummaries(ms);
        } catch {
          console.warn("月次サマリー取得スキップ");
        }
      }

      // Auto-select latest snapshot
      if (snaps.length > 0) {
        const latestId = snaps[0].id!;
        setSelectedSnapshotId(latestId);
        const posts = await getSnapshotPosts(accountId, latestId);
        setCurrentPosts(filterAggregate(posts));

        // Auto-select comparison: second most recent
        if (snaps.length > 1) {
          const prevId = snaps[1].id!;
          setCompareSnapshotId(prevId);
          const cPosts = await getSnapshotPosts(accountId, prevId);
          setComparePosts(filterAggregate(cPosts));
        } else {
          setCompareSnapshotId(null);
          setComparePosts([]);
        }
      } else {
        setSelectedSnapshotId(null);
        setCompareSnapshotId(null);
        setCurrentPosts([]);
        setComparePosts([]);
      }
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (account && IG_API_PLATFORMS.has(account.platform)) {
      fetch(`/api/ig/token/status?accountId=${accountId}`)
        .then((r) => r.json())
        .then((data) => setIgConnected(data.connected ?? false))
        .catch(() => setIgConnected(false));
    }
  }, [account, accountId]);

  // Load posts when snapshot selection changes
  const handleSelectSnapshot = async (id: string) => {
    setSelectedSnapshotId(id);
    try {
      const posts = await getSnapshotPosts(accountId, id);
      setCurrentPosts(filterAggregate(posts));
    } catch {
      toast.error("投稿データの取得に失敗しました");
    }
  };

  const handleSelectCompare = async (id: string | null) => {
    setCompareSnapshotId(id);
    if (id) {
      try {
        const posts = await getSnapshotPosts(accountId, id);
        setComparePosts(filterAggregate(posts));
      } catch {
        toast.error("比較データの取得に失敗しました");
      }
    } else {
      setComparePosts([]);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm("このスナップショットを削除しますか？")) return;
    try {
      await deleteSnapshot(accountId, id);
      toast.success("スナップショットを削除しました");
      fetchData();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  // Auto-backfill thumbnails for IG API posts missing them
  useEffect(() => {
    if (!account || !IG_API_PLATFORMS.has(account.platform)) return;
    if (!selectedSnapshotId || !igConnected) return;

    const missing = currentPosts.filter(
      (p) => p.source === "api" && !p.thumbnailUrl && p.id
    );
    if (missing.length === 0) return;

    const mediaIds = missing.map((p) => p.postKey);
    fetch("/api/ig/media/thumbnails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, mediaIds }),
    })
      .then((r) => r.json())
      .then(async (data) => {
        const thumbnails: Record<string, string | null> = data.thumbnails ?? {};
        let updated = false;
        for (const post of missing) {
          const url = thumbnails[post.postKey];
          if (url) {
            await updateSnapshotPost(accountId, selectedSnapshotId, post.id!, {
              thumbnailUrl: url,
            });
            updated = true;
          }
        }
        if (updated) {
          // Reload posts to show thumbnails
          const posts = await getSnapshotPosts(accountId, selectedSnapshotId);
          setCurrentPosts(filterAggregate(posts));
        }
      })
      .catch(() => {
        // Silent fail - thumbnails are not critical
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosts.length, selectedSnapshotId, igConnected]);

  const handleFetchMonthlySummary = async () => {
    if (!account) return;
    setFetchingSummary(true);
    try {
      // Default period: previous month
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const res = await fetch("/api/ig/account/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "サマリー取得に失敗しました");
        return;
      }

      const label = `${periodStart.getFullYear()}年 ${periodStart.getMonth() + 1}月`;

      // Update if same label exists, otherwise create
      const existing = monthlySummaries.find((s) => s.label === label);
      if (existing?.id) {
        await updateMonthlySummary(accountId, existing.id, {
          metrics: data.summary,
          importedAt: Timestamp.now(),
        });
      } else {
        await createMonthlySummary(accountId, {
          periodStart: Timestamp.fromDate(periodStart),
          periodEnd: Timestamp.fromDate(periodEnd),
          label,
          metrics: data.summary,
          importedAt: Timestamp.now(),
        });
      }

      const ms = await getMonthlySummaries(accountId);
      setMonthlySummaries(ms);
      toast.success(`${label} のサマリーを取得しました`);
    } catch (e) {
      console.error("月サマリー取得エラー:", e);
      toast.error(e instanceof Error ? e.message : "サマリー取得に失敗しました");
    } finally {
      setFetchingSummary(false);
    }
  };

  const handleWeeklyComparison = async () => {
    if (!account || !igConnected) return;
    setFetchingWeekly(true);
    try {
      const today = new Date();
      const thisMonday = getMonday(today);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);

      const sinceDate = new Date(lastMonday);
      sinceDate.setDate(sinceDate.getDate() - 1);
      toast.info("投稿を取得中...");

      const mediaRes = await fetch(
        `/api/ig/media?limit=50&accountId=${accountId}&since=${sinceDate.toISOString()}`
      );
      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) {
        toast.error(mediaData.error ?? "投稿取得に失敗しました");
        return;
      }

      const allMedia: Array<{
        igMediaId: string;
        caption: string;
        mediaType: string;
        mediaProductType: string;
        timestamp: string;
        permalink: string;
        thumbnailUrl: string | null;
      }> = mediaData.media ?? [];

      const thisSunday = new Date(thisMonday);
      thisSunday.setDate(thisMonday.getDate() + 6);
      thisSunday.setHours(23, 59, 59, 999);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);

      const thisWeekMedia = allMedia.filter((m) => {
        const d = new Date(m.timestamp);
        return (
          toPlatformId(m.mediaType, m.mediaProductType) === account.platform &&
          d >= thisMonday && d <= thisSunday
        );
      });
      const lastWeekMedia = allMedia.filter((m) => {
        const d = new Date(m.timestamp);
        return (
          toPlatformId(m.mediaType, m.mediaProductType) === account.platform &&
          d >= lastMonday && d <= lastSunday
        );
      });

      const thisLabel = weekLabel(thisMonday);
      const lastLabel = weekLabel(lastMonday);
      const existingThis = snapshots.find((s) => s.label === thisLabel);
      const existingLast = snapshots.find((s) => s.label === lastLabel);

      const cfg = getPlatformConfig(account.platform);

      async function fetchInsightsAndCreateSnapshot(
        media: typeof allMedia,
        monday: Date,
        label: string
      ): Promise<string> {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        if (media.length === 0) {
          return createSnapshotWithPosts(
            accountId,
            {
              periodStart: Timestamp.fromDate(monday),
              periodEnd: Timestamp.fromDate(sunday),
              importedAt: Timestamp.now(),
              label,
              postCount: 0,
              totals: {},
            },
            []
          );
        }

        toast.info(`${label} のinsightsを取得中...`);
        const ids = media.map((m) => m.igMediaId);
        const insightsRes = await fetch("/api/ig/media/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaIds: ids, accountId }),
        });
        const insightsData = await insightsRes.json();
        if (!insightsRes.ok) {
          throw new Error(insightsData.error ?? "Insights取得に失敗");
        }

        const results: Array<{
          igMediaId: string;
          metrics: Record<string, number>;
          caption: string;
          permalink: string;
          timestamp: string;
          thumbnailUrl: string | null;
        }> = insightsData.results ?? [];

        const posts: Omit<Post, "id">[] = results.map((r) => ({
          postKey: r.igMediaId,
          title: r.caption.slice(0, 60) || undefined,
          publishedAt: Timestamp.fromDate(new Date(r.timestamp)),
          capturedAt: Timestamp.now(),
          permalink: r.permalink,
          thumbnailUrl: r.thumbnailUrl ?? undefined,
          tags: {},
          metrics: r.metrics,
          calculatedKpis: calculatePostKpis(cfg.kpis, r.metrics),
          source: "api" as const,
        }));

        const totals: Record<string, number> = {};
        for (const p of posts) {
          for (const [key, val] of Object.entries(p.metrics)) {
            totals[key] = (totals[key] ?? 0) + val;
          }
        }

        return createSnapshotWithPosts(
          accountId,
          {
            periodStart: Timestamp.fromDate(monday),
            periodEnd: Timestamp.fromDate(sunday),
            importedAt: Timestamp.now(),
            label,
            postCount: posts.length,
            totals,
          },
          posts
        );
      }

      const lastId = existingLast?.id ??
        await fetchInsightsAndCreateSnapshot(lastWeekMedia, lastMonday, lastLabel);
      const thisId = existingThis?.id ??
        await fetchInsightsAndCreateSnapshot(thisWeekMedia, thisMonday, thisLabel);

      await fetchData();
      setSelectedSnapshotId(thisId);
      const thisPosts = await getSnapshotPosts(accountId, thisId);
      setCurrentPosts(filterAggregate(thisPosts));
      setCompareSnapshotId(lastId);
      const lastPosts = await getSnapshotPosts(accountId, lastId);
      setComparePosts(filterAggregate(lastPosts));

      toast.success("週次比較を生成しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "週次比較の生成に失敗しました");
    } finally {
      setFetchingWeekly(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8 text-center">
        <p className="text-muted-foreground">アカウントが見つかりません</p>
        <Link href="/" className="text-primary hover:underline mt-2 inline-block">
          ← 一覧に戻る
        </Link>
      </div>
    );
  }

  const config = getPlatformConfig(account.platform);
  const colors = platformColors[account.platform];
  const emoji = platformEmoji[account.platform];

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) ?? null;
  const compareSnapshot = snapshots.find((s) => s.id === compareSnapshotId) ?? null;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-2xl">{emoji}</span>
          <div>
            <h1 className="text-xl font-bold">{account.name}</h1>
            <p className="text-sm text-muted-foreground">@{account.handle}</p>
          </div>
          <Badge variant="outline" className={`ml-2 ${colors}`}>
            {config.label}
          </Badge>
        </div>
        <div className="flex gap-2">
          {/* IG main actions */}
          {IG_API_PLATFORMS.has(account.platform) && igConnected && (
            <>
              <Button
                size="sm"
                onClick={handleWeeklyComparison}
                disabled={fetchingWeekly}
              >
                {fetchingWeekly ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
                ) : (
                  <GitCompareArrows className="mr-1 h-4 w-4" />
                )}
                週次比較
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFetchMonthlySummary}
                disabled={fetchingSummary}
              >
                {fetchingSummary ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
                ) : (
                  <CalendarSearch className="mr-1 h-4 w-4" />
                )}
                月サマリー取得
              </Button>
            </>
          )}

          {/* Data add dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" />
                追加
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setQuickEntryOpen(true)}>
                <PenLine className="mr-2 h-4 w-4" />
                {CSV_PRIMARY_PLATFORMS.has(account.platform) ? "手動入力" : "投稿を入力"}
              </DropdownMenuItem>
              {selectedSnapshot && (
                <DropdownMenuItem onClick={() => setAddToSnapshotOpen(true)}>
                  <PenLine className="mr-2 h-4 w-4" />
                  投稿を追加
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setCsvDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                CSVアップロード
              </DropdownMenuItem>
              {IG_API_PLATFORMS.has(account.platform) && igConnected && (
                <DropdownMenuItem onClick={() => setIgImportOpen(true)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  APIから取得
                </DropdownMenuItem>
              )}
              {IG_API_PLATFORMS.has(account.platform) && !igConnected && (
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Link2 className="mr-2 h-4 w-4" />
                    API連携を設定
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export dropdown */}
          {selectedSnapshot && (
            <ExportDropdown
              snapshot={selectedSnapshot}
              posts={currentPosts}
              config={config}
              targets={account.targets}
              account={account}
              compareSnapshot={compareSnapshot}
              comparePosts={comparePosts}
            />
          )}
        </div>
      </div>

      {/* Snapshot Selector */}
      {snapshots.length > 0 ? (
        <div className="flex flex-wrap items-end gap-4">
          <SnapshotSelector
            snapshots={snapshots}
            selectedId={selectedSnapshotId}
            onSelect={handleSelectSnapshot}
            onDelete={handleDeleteSnapshot}
            compareId={compareSnapshotId}
            onCompareSelect={handleSelectCompare}
          />
          {/* Export and add actions moved to header dropdowns */}
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-2">まだスナップショットがありません</p>
          {CSV_PRIMARY_PLATFORMS.has(account.platform) ? (
            <>
              <p className="text-sm mb-4">
                CSVをアップロードしてスナップショットを作成しましょう
              </p>
              <Button variant="outline" onClick={() => setCsvDialogOpen(true)}>
                <Upload className="mr-1 h-4 w-4" />
                CSVアップロード
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm mb-4">
                投稿データを入力してスナップショットを作成しましょう
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setQuickEntryOpen(true)}>
                  <PenLine className="mr-1 h-4 w-4" />
                  投稿を入力
                </Button>
                <Button variant="outline" onClick={() => setCsvDialogOpen(true)}>
                  <Upload className="mr-1 h-4 w-4" />
                  CSV
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Channel summary bar removed — use "月サマリー取得" button or manual entry via サマリー編集 in dropdown */}

      {/* Dashboard content (only when snapshot selected) */}
      {selectedSnapshot && currentPosts.length > 0 && (
        <>
          {/* KPI Cards */}
          <KpiCardGrid
            posts={currentPosts}
            kpiDefs={config.kpis}
            targets={account.targets}
          />

          {/* Tabs */}
          <Tabs defaultValue={compareSnapshot ? "comparison" : "posts"}>
            <TabsList>
              {compareSnapshot && (
                <TabsTrigger value="comparison">前回比較</TabsTrigger>
              )}
              <TabsTrigger value="top">TOP投稿</TabsTrigger>
              <TabsTrigger value="posts">投稿一覧</TabsTrigger>
              <TabsTrigger value="trend">全体推移</TabsTrigger>
              {IG_API_PLATFORMS.has(account.platform) && igConnected && (
                <TabsTrigger value="monthly">月次サマリー</TabsTrigger>
              )}
              <TabsTrigger value="guide">使い方</TabsTrigger>
            </TabsList>

            {compareSnapshot && (
              <TabsContent value="comparison" className="mt-4">
                <SnapshotComparisonCard
                  currentSnapshot={selectedSnapshot}
                  currentPosts={currentPosts}
                  compareSnapshot={compareSnapshot}
                  comparePosts={comparePosts}
                  kpiDefs={config.kpis}
                  config={config}
                />
              </TabsContent>
            )}

            <TabsContent value="top" className="mt-4">
              <TopPostsPanel posts={currentPosts} config={config} />
            </TabsContent>

            <TabsContent value="posts" className="mt-4">
              <PostsTable
                posts={currentPosts}
                config={config}
                onEditPost={(post) => setEditingPost(post)}
              />
            </TabsContent>

            <TabsContent value="trend" className="mt-4">
              <SnapshotTrendChart snapshots={snapshots} />
            </TabsContent>

            {IG_API_PLATFORMS.has(account.platform) && igConnected && (
              <TabsContent value="monthly" className="mt-4">
                <MonthlySummaryPanel summaries={monthlySummaries} config={config} />
              </TabsContent>
            )}

            <TabsContent value="guide" className="mt-4">
              <PlatformGuide config={config} targets={account.targets} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* CSV Upload Dialog */}
      <CsvUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        accountId={accountId}
        config={config}
        onComplete={() => {
          fetchData();
          setCsvDialogOpen(false);
        }}
      />

      {/* Quick Entry Dialog (new snapshot) */}
      <QuickEntryDialog
        open={quickEntryOpen}
        onOpenChange={setQuickEntryOpen}
        accountId={accountId}
        account={account}
        config={config}
        onComplete={() => {
          fetchData();
          setQuickEntryOpen(false);
        }}
      />

      {/* Quick Entry Dialog (add to existing snapshot) */}
      {selectedSnapshot && (
        <QuickEntryDialog
          open={addToSnapshotOpen}
          onOpenChange={setAddToSnapshotOpen}
          accountId={accountId}
          account={account}
          config={config}
          targetSnapshot={selectedSnapshot}
          onComplete={() => {
            fetchData();
            setAddToSnapshotOpen(false);
          }}
        />
      )}

      {/* IG API Import Dialog */}
      {account && IG_API_PLATFORMS.has(account.platform) && (
        <IgImportDialog
          open={igImportOpen}
          onOpenChange={setIgImportOpen}
          accountId={accountId}
          accountPlatform={account.platform as "ig_feed" | "ig_reel"}
          existingPermalinks={allPermalinks}
          snapshots={snapshots}
          onComplete={() => {
            fetchData();
            setIgImportOpen(false);
          }}
        />
      )}

      {/* Post Edit Dialog */}
      {editingPost && selectedSnapshotId && (
        <PostEditDialog
          open={!!editingPost}
          onOpenChange={(o) => { if (!o) setEditingPost(null); }}
          accountId={accountId}
          snapshotId={selectedSnapshotId}
          post={editingPost}
          config={config}
          onComplete={() => {
            setEditingPost(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

/** Export dropdown menu */
function ExportDropdown({
  snapshot,
  posts,
  config,
  targets,
  account,
  compareSnapshot,
  comparePosts,
}: {
  snapshot: Snapshot;
  posts: Post[];
  config: PlatformConfig;
  targets: Record<string, number>;
  account: Account;
  compareSnapshot?: Snapshot | null;
  comparePosts?: Post[];
}) {
  const base = `${config.id}_${snapshot.label.replace(/[\s/]/g, "_")}`;

  const handleCsv = () => {
    const csv = buildCsvExport({ snapshot, posts, config, targets });
    downloadCsv(csv, `${base}.csv`);
    toast.success("CSVをダウンロードしました");
  };

  const handleJson = () => {
    const data = buildJsonExport({ snapshot, posts, config, targets });
    downloadJson(data, `${base}.json`);
    toast.success("JSONをダウンロードしました");
  };

  const handleSlideJson = () => {
    const slides = buildSlideJson({
      account,
      config,
      targets,
      currentSnapshot: snapshot,
      currentPosts: posts,
      compareSnapshot,
      comparePosts,
    });
    downloadJson(slides, `${base}_slides.json`);
    toast.success("スライドJSONをダウンロードしました");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="mr-1 h-4 w-4" />
          出力
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCsv}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleJson}>
          <Download className="mr-2 h-4 w-4" />
          JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSlideJson}>
          <Presentation className="mr-2 h-4 w-4" />
          スライド
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
