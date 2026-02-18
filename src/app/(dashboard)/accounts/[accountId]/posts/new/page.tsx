"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostForm } from "@/components/posts/PostForm";
import { getAccount, createPost, type Account } from "@/lib/firebase/firestore";
import { getPlatformConfig } from "@/lib/platforms";
import { calculatePostKpis } from "@/lib/kpi/calculator";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

export default function NewPostPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    try {
      setAccount(await getAccount(accountId));
    } catch {
      toast.error("アカウント情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  if (loading || !account) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
      </div>
    );
  }

  const config = getPlatformConfig(account.platform);

  const handleSubmit = async (data: {
    postKey: string;
    publishedAt: string;
    permalink: string;
    tags: Record<string, string>;
    metrics: Record<string, number>;
    notes: string;
  }) => {
    const calculatedKpis = calculatePostKpis(config.kpis, data.metrics);

    await createPost(accountId, {
      postKey: data.postKey,
      publishedAt: Timestamp.fromDate(new Date(data.publishedAt)),
      permalink: data.permalink,
      tags: data.tags as { format?: string; theme?: string; cta?: string; hook?: string },
      metrics: data.metrics,
      calculatedKpis,
      source: "manual",
      notes: data.notes,
    });

    toast.success("投稿を保存しました");
    router.push(`/accounts/${accountId}`);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/accounts/${accountId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">投稿を追加</h1>
          <p className="text-sm text-muted-foreground">
            {config.label} - {account.name}
          </p>
        </div>
      </div>

      <PostForm config={config} account={account} onSubmit={handleSubmit} />
    </div>
  );
}
