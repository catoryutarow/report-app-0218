"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Upload, ArrowLeft, PenLine, BarChart3, Link2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAccount,
  getSnapshots,
  getSnapshotPosts,
  deleteSnapshot,
  type Account,
  type Post,
  type Snapshot,
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
import { ChannelSummaryDialog } from "@/components/kpi/ChannelSummaryDialog";
import { IgImportDialog } from "@/components/ig/IgImportDialog";
import {
  buildCsvExport,
  buildJsonExport,
  downloadCsv,
  downloadJson,
} from "@/lib/export/snapshot-export";
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

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [addToSnapshotOpen, setAddToSnapshotOpen] = useState(false);
  const [channelSummaryOpen, setChannelSummaryOpen] = useState(false);
  const [igImportOpen, setIgImportOpen] = useState(false);
  const [igConnected, setIgConnected] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Snapshot state
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const [currentPosts, setCurrentPosts] = useState<Post[]>([]);
  const [comparePosts, setComparePosts] = useState<Post[]>([]);
  const [allPermalinks, setAllPermalinks] = useState<Set<string>>(new Set());

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
          {CSV_PRIMARY_PLATFORMS.has(account.platform) ? (
            <>
              <Button size="sm" onClick={() => setCsvDialogOpen(true)}>
                <Upload className="mr-1 h-4 w-4" />
                CSVアップロード
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickEntryOpen(true)}>
                <PenLine className="mr-1 h-4 w-4" />
                手動入力
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => setQuickEntryOpen(true)}>
                <PenLine className="mr-1 h-4 w-4" />
                投稿を入力
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCsvDialogOpen(true)}>
                <Upload className="mr-1 h-4 w-4" />
                CSV
              </Button>
              {IG_API_PLATFORMS.has(account.platform) && (
                igConnected ? (
                  <Button size="sm" variant="outline" onClick={() => setIgImportOpen(true)}>
                    <Link2 className="mr-1 h-4 w-4" />
                    APIから取得
                  </Button>
                ) : (
                  <Link href="/settings">
                    <Button size="sm" variant="outline">
                      <Link2 className="mr-1 h-4 w-4" />
                      API連携を設定
                    </Button>
                  </Link>
                )
              )}
            </>
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
          {selectedSnapshot && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddToSnapshotOpen(true)}
              >
                <PenLine className="mr-1 h-4 w-4" />
                投稿を追加
              </Button>
              <ExportButtons
                snapshot={selectedSnapshot}
                posts={currentPosts}
                config={config}
                targets={account.targets}
              />
            </>
          )}
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

      {/* Channel Summary prompt for non-YouTube platforms */}
      {selectedSnapshot && !CSV_PRIMARY_PLATFORMS.has(account.platform) && (
        <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex-1 min-w-0">
            {selectedSnapshot.channelSummary ? (
              <p className="text-sm text-muted-foreground">
                チャンネルサマリー入力済み
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                アナリティクスの概要画面から<strong>チャンネル全体の数値</strong>を入力すると、期間俯瞰のKPIとして活用できます
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={selectedSnapshot.channelSummary ? "outline" : "default"}
            onClick={() => setChannelSummaryOpen(true)}
          >
            <BarChart3 className="mr-1 h-4 w-4" />
            {selectedSnapshot.channelSummary ? "サマリー編集" : "サマリー入力"}
          </Button>
        </div>
      )}

      {/* Dashboard content (only when snapshot selected) */}
      {selectedSnapshot && currentPosts.length > 0 && (
        <>
          {/* KPI Cards */}
          <KpiCardGrid
            posts={currentPosts}
            kpiDefs={config.kpis}
            targets={account.targets}
            snapshot={selectedSnapshot}
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

      {/* Channel Summary Dialog */}
      {selectedSnapshot && (
        <ChannelSummaryDialog
          open={channelSummaryOpen}
          onOpenChange={setChannelSummaryOpen}
          accountId={accountId}
          snapshot={selectedSnapshot}
          config={config}
          onComplete={() => {
            fetchData();
            setChannelSummaryOpen(false);
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

/** Export CSV / JSON buttons */
function ExportButtons({
  snapshot,
  posts,
  config,
  targets,
}: {
  snapshot: Snapshot;
  posts: Post[];
  config: PlatformConfig;
  targets: Record<string, number>;
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

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" onClick={handleCsv}>
        <Download className="mr-1 h-4 w-4" />
        CSV
      </Button>
      <Button size="sm" variant="outline" onClick={handleJson}>
        <Download className="mr-1 h-4 w-4" />
        JSON
      </Button>
    </div>
  );
}
