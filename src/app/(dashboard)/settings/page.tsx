"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save } from "lucide-react";
import {
  getAccounts,
  updateAccount,
  type Account,
} from "@/lib/firebase/firestore";
import { getPlatformConfig } from "@/lib/platforms";
import { platformEmoji } from "@/lib/platforms/utils";
import { IgConnectForm } from "@/components/ig/IgConnectForm";
import { IgTokenStatus, type TokenStatus } from "@/components/ig/IgTokenStatus";
import { toast } from "sonner";

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [igStatus, setIgStatus] = useState<TokenStatus | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setAccounts(await getAccounts());
    } catch {
      toast.error("アカウントの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIgStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ig/token/status");
      const data = await res.json();
      setIgStatus(data);
    } catch {
      setIgStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchIgStatus();
  }, [fetchAccounts, fetchIgStatus]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="h-8 w-32 bg-muted animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      {/* Instagram API Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span>📸</span>
            Instagram API連携
          </CardTitle>
          <CardDescription>
            Instagram Graph APIで投稿の指標を自動取得します
          </CardDescription>
        </CardHeader>
        <CardContent>
          {igStatus === null ? (
            <div className="h-12 bg-muted animate-pulse rounded" />
          ) : igStatus.connected ? (
            <IgTokenStatus
              status={igStatus}
              onRefreshed={fetchIgStatus}
              onDisconnected={fetchIgStatus}
            />
          ) : (
            <IgConnectForm onConnected={fetchIgStatus} />
          )}
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <p className="text-muted-foreground">
          アカウントがありません。ダッシュボームから追加してください。
        </p>
      ) : (
        accounts.map((account) => (
          <AccountSettings
            key={account.id}
            account={account}
            onSaved={fetchAccounts}
          />
        ))
      )}
    </div>
  );
}

function AccountSettings({
  account,
  onSaved,
}: {
  account: Account;
  onSaved: () => void;
}) {
  const config = getPlatformConfig(account.platform);
  const emoji = platformEmoji[account.platform];

  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const t: Record<string, string> = {};
    for (const kpi of config.kpis) {
      t[kpi.key] = account.targets[kpi.key] != null
        ? String(account.targets[kpi.key])
        : "";
    }
    return t;
  });

  const [tags, setTags] = useState(account.tags);
  const [newTag, setNewTag] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!account.id) return;
    setSaving(true);
    try {
      const parsedTargets: Record<string, number> = {};
      for (const [key, val] of Object.entries(targets)) {
        if (val !== "") parsedTargets[key] = parseFloat(val);
      }
      await updateAccount(account.id, { targets: parsedTargets, tags });
      toast.success("設定を保存しました");
      onSaved();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const addTag = (dimension: string) => {
    const val = newTag[dimension]?.trim();
    if (!val) return;
    const key = dimension as keyof typeof tags;
    if (tags[key]?.includes(val)) return;
    setTags((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), val],
    }));
    setNewTag((prev) => ({ ...prev, [dimension]: "" }));
  };

  const removeTag = (dimension: string, value: string) => {
    const key = dimension as keyof typeof tags;
    setTags((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((t) => t !== value),
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span>{emoji}</span>
          {account.name}
        </CardTitle>
        <CardDescription>{config.label} - @{account.handle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target KPIs */}
        <div>
          <h3 className="text-sm font-medium mb-3">目標KPI</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.kpis.map((kpi) => (
              <div key={kpi.key} className="space-y-1">
                <Label className="text-xs">{kpi.label}</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={targets[kpi.key] ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTargets((prev) => ({ ...prev, [kpi.key]: e.target.value }))
                  }
                  placeholder={
                    kpi.format === "percent" ? "例: 0.03 (3%)" : "目標値"
                  }
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-sm font-medium mb-3">カスタムタグ</h3>
          {config.tagDimensions.map((dim) => {
            const key = dim.key as keyof typeof tags;
            const currentTags = tags[key] ?? [];
            return (
              <div key={dim.key} className="mb-4">
                <Label className="text-xs">{dim.label}</Label>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {currentTags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs gap-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(dim.key, t)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {currentTags.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      未設定（デフォルト例が使用されます）
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag[dim.key] ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewTag((prev) => ({ ...prev, [dim.key]: e.target.value }))
                    }
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(dim.key);
                      }
                    }}
                    placeholder={`例: ${dim.examples[0]}`}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addTag(dim.key)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="mr-1 h-4 w-4" />
          {saving ? "保存中..." : "設定を保存"}
        </Button>
      </CardContent>
    </Card>
  );
}
