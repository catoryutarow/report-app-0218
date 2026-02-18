"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountFormDialog } from "@/components/accounts/AccountFormDialog";
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  type Account,
  type Platform,
} from "@/lib/firebase/firestore";
import { getPlatformConfig } from "@/lib/platforms";
import { toast } from "sonner";

export default function DashboardHome() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | undefined>();

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch {
      toast.error("アカウントの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async (data: { platform: Platform; name: string; handle: string }) => {
    const config = getPlatformConfig(data.platform);
    await createAccount({
      ...data,
      targets: config.defaultTargets,
      tags: { formats: [], themes: [], ctas: [], hooks: [] },
    });
    toast.success("アカウントを追加しました");
    fetchAccounts();
  };

  const handleEdit = async (data: { platform: Platform; name: string; handle: string }) => {
    if (!editTarget?.id) return;
    await updateAccount(editTarget.id, { name: data.name, handle: data.handle });
    toast.success("アカウントを更新しました");
    setEditTarget(undefined);
    fetchAccounts();
  };

  const handleDelete = async (account: Account) => {
    if (!account.id) return;
    if (!confirm(`「${account.name}」を削除しますか？この操作は取り消せません。`)) return;
    await deleteAccount(account.id);
    toast.success("アカウントを削除しました");
    fetchAccounts();
  };

  const openEdit = (account: Account) => {
    setEditTarget(account);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">アカウント一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理中のSNSアカウント
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          アカウント追加
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">まだアカウントがありません</p>
          <p className="text-sm mb-4">
            「アカウント追加」からSNSアカウントを登録してください
          </p>
          <Button onClick={openCreate} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            最初のアカウントを追加
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditTarget(undefined);
        }}
        onSubmit={editTarget ? handleEdit : handleCreate}
        defaultValues={editTarget}
      />
    </div>
  );
}
