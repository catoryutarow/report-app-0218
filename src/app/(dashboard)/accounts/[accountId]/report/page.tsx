"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Timestamp } from "firebase/firestore";
import {
  getAccount,
  saveReport,
  getReports,
  type Account,
  type Post,
  type MonthlySummary,
} from "@/lib/firebase/firestore";
import { getPlatformConfig } from "@/lib/platforms";
import { calculateWeightedKpis } from "@/lib/kpi/calculator";
import { ReportPage1 } from "@/components/report/ReportPage1";
import { ReportPage2 } from "@/components/report/ReportPage2";
import { ReportPage3 } from "@/components/report/ReportPage3";
import "@/components/report/report-print.css";
import { toast } from "sonner";

export default function ReportPageRoute() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Period
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);

  // Data
  const [currentMetrics, setCurrentMetrics] = useState<Record<string, number>>({});
  const [previousMetrics, setPreviousMetrics] = useState<Record<string, number>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [prevPostCount, setPrevPostCount] = useState(0);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);

  // Editable text
  const [highlight, setHighlight] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const acc = await getAccount(accountId);
        setAccount(acc);

        // Load latest report if exists
        const reports = await getReports(accountId);
        if (reports.length > 0) {
          const latest = reports[0];
          setReportId(latest.id ?? null);
          setHighlight(latest.highlight ?? "");
          setAnalysis(latest.analysis ?? "");
          setNextActions(latest.nextActions ?? "");
        }
      } catch {
        toast.error("データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const handleGenerate = async () => {
    if (!account) return;
    setGenerating(true);
    try {
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      // Calculate previous period (same number of days, one month earlier)
      const prevStart = new Date(startDate);
      prevStart.setMonth(prevStart.getMonth() - 1);
      const prevEnd = new Date(endDate);
      prevEnd.setMonth(prevEnd.getMonth() - 1);

      // Fetch current and previous period channel metrics
      const [curRes, prevRes] = await Promise.all([
        fetch("/api/ig/account/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, periodStart: startDate.toISOString(), periodEnd: endDate.toISOString() }),
        }),
        fetch("/api/ig/account/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, periodStart: prevStart.toISOString(), periodEnd: prevEnd.toISOString() }),
        }),
      ]);

      const curData = await curRes.json();
      const prevData = await prevRes.json();
      if (!curRes.ok) { toast.error(curData.error ?? "今期間のデータ取得に失敗"); return; }

      setCurrentMetrics(curData.summary ?? {});
      setPreviousMetrics(prevRes.ok ? (prevData.summary ?? {}) : {});

      // Fetch posts for current period
      const sinceDate = new Date(startDate);
      sinceDate.setDate(sinceDate.getDate() - 1);
      const mediaRes = await fetch(`/api/ig/media?limit=50&accountId=${accountId}&since=${sinceDate.toISOString()}`);
      const mediaData = await mediaRes.json();

      if (mediaRes.ok) {
        const allMedia: Array<{
          igMediaId: string; caption: string; mediaType: string;
          mediaProductType: string; timestamp: string; permalink: string; thumbnailUrl: string | null;
        }> = mediaData.media ?? [];

        // Filter to current period
        const periodMedia = allMedia.filter((m) => {
          const d = new Date(m.timestamp);
          return d >= startDate && d <= new Date(endDate.getTime() + 86400000);
        });

        if (periodMedia.length > 0) {
          toast.info("投稿のinsightsを取得中...");
          const insightsRes = await fetch("/api/ig/media/insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaIds: periodMedia.map((m) => m.igMediaId), accountId }),
          });
          const insightsData = await insightsRes.json();

          if (insightsRes.ok) {
            const results = insightsData.results ?? [];
            const postList: Post[] = results.map((r: { igMediaId: string; metrics: Record<string, number>; caption: string; permalink: string; timestamp: string; thumbnailUrl: string | null }) => ({
              id: r.igMediaId,
              postKey: r.igMediaId,
              title: r.caption.slice(0, 60) || undefined,
              publishedAt: Timestamp.fromDate(new Date(r.timestamp)),
              permalink: r.permalink,
              thumbnailUrl: r.thumbnailUrl ?? undefined,
              tags: {},
              metrics: r.metrics,
              calculatedKpis: {},
              source: "api" as const,
            }));
            setPosts(postList);
          }
        } else {
          setPosts([]);
        }

        // Count previous period posts
        const prevMediaCount = allMedia.filter((m) => {
          const d = new Date(m.timestamp);
          return d >= prevStart && d <= new Date(prevEnd.getTime() + 86400000);
        }).length;
        setPrevPostCount(prevMediaCount);
      }

      // Fetch monthly trend data (past 3 months) live from API
      toast.info("月次推移を取得中...");
      const trendMonths: MonthlySummary[] = [];
      for (let i = 2; i >= 0; i--) {
        const mStart = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        const mEnd = new Date(endDate.getFullYear(), endDate.getMonth() - i + 1, 0);
        try {
          const mRes = await fetch("/api/ig/account/insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId, periodStart: mStart.toISOString(), periodEnd: mEnd.toISOString() }),
          });
          const mData = await mRes.json();
          if (mRes.ok && mData.summary) {
            trendMonths.push({
              periodStart: Timestamp.fromDate(mStart),
              periodEnd: Timestamp.fromDate(mEnd),
              label: `${mStart.getFullYear()}年 ${mStart.getMonth() + 1}月`,
              metrics: mData.summary,
              importedAt: Timestamp.now(),
            });
          }
        } catch {
          // skip failed month
        }
      }
      setMonthlySummaries(trendMonths);

      toast.success("レポートデータを取得しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "レポート生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = await saveReport(accountId, reportId, {
        periodStart: Timestamp.fromDate(new Date(periodStart)),
        periodEnd: Timestamp.fromDate(new Date(periodEnd)),
        highlight,
        analysis,
        nextActions,
      });
      setReportId(id);
      toast.success("レポートを保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !account) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
      </div>
    );
  }

  const config = getPlatformConfig(account.platform);
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const periodLabel = `${startDate.getFullYear()}年 ${startDate.getMonth() + 1}/${startDate.getDate()}〜${endDate.getMonth() + 1}/${endDate.getDate()} レポート`;
  const currentKpis = calculateWeightedKpis(config.kpis, posts.map((p) => p.metrics));

  const hasData = Object.keys(currentMetrics).length > 0;

  return (
    <div className="report-container">
      <div className="report-controls">
        <Link href={`/accounts/${accountId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> 戻る
          </Button>
        </Link>
        <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
        <span className="text-sm text-muted-foreground">〜</span>
        <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? "取得中..." : "データ取得"}
        </Button>
        {hasData && (
          <>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> 印刷 / PDF
            </Button>
          </>
        )}
      </div>

      {hasData ? (
        <>
          <ReportPage1
            account={account}
            config={config}
            periodLabel={periodLabel}
            currentMetrics={currentMetrics}
            previousMetrics={previousMetrics}
            currentKpis={currentKpis}
            targets={account.targets}
            postCount={posts.length}
            prevPostCount={prevPostCount}
            periodDays={periodDays}
            highlight={highlight}
            onHighlightChange={setHighlight}
          />
          <ReportPage2 posts={posts} config={config} />
          <ReportPage3
            summaries={monthlySummaries}
            config={config}
            analysis={analysis}
            onAnalysisChange={setAnalysis}
            nextActions={nextActions}
            onNextActionsChange={setNextActions}
          />
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#999" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>期間を選択して「データ取得」を押してください</p>
          <p style={{ fontSize: 14 }}>IG APIからデータを取得してレポートを生成します</p>
        </div>
      )}
    </div>
  );
}
