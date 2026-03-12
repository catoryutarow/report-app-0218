"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";

export type TokenStatus = {
  connected: boolean;
  igUserId?: string;
  connectedAccountName?: string;
  tokenExpiresAt?: string;
  daysRemaining?: number;
  expired?: boolean;
};

type Props = {
  status: TokenStatus;
  onRefreshed: () => void;
  onDisconnected: () => void;
};

export function IgTokenStatus({ status, onRefreshed, onDisconnected }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ig/token/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "トークンの更新に失敗しました");
        return;
      }
      toast.success("トークンを更新しました");
      onRefreshed();
    } catch {
      toast.error("トークンの更新に失敗しました");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Instagram API連携を解除しますか？")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/ig/token/exchange", { method: "DELETE" });
      if (!res.ok) {
        toast.error("解除に失敗しました");
        return;
      }
      toast.success("接続を解除しました");
      onDisconnected();
    } catch {
      toast.error("解除に失敗しました");
    } finally {
      setDisconnecting(false);
    }
  };

  const expiryColor =
    status.expired
      ? "text-destructive"
      : (status.daysRemaining ?? 99) <= 7
        ? "text-destructive"
        : (status.daysRemaining ?? 99) <= 14
          ? "text-orange-500"
          : "text-green-600";

  const expiryDate = status.tokenExpiresAt
    ? new Date(status.tokenExpiresAt).toLocaleDateString("ja-JP")
    : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={status.expired ? "destructive" : "secondary"}>
          {status.expired ? "期限切れ" : "接続中"}
        </Badge>
        <span className="text-sm font-medium">{status.connectedAccountName}</span>
      </div>

      <p className={`text-sm ${expiryColor}`}>
        トークン有効期限: {expiryDate}
        {status.daysRemaining != null && (
          <span>（残り{status.daysRemaining}日）</span>
        )}
      </p>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "更新中..." : "トークンを更新"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-muted-foreground"
        >
          <Unlink className="mr-1 h-4 w-4" />
          接続を解除
        </Button>
      </div>
    </div>
  );
}
