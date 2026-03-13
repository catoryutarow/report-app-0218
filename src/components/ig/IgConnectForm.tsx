"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  accountId: string;
  onConnected: () => void;
};

export function IgConnectForm({ accountId, onConnected }: Props) {
  const [shortToken, setShortToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortToken.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ig/token/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortToken: shortToken.trim(), accountId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "トークンの交換に失敗しました");
        return;
      }

      toast.success(`${data.connectedAccountName} に接続しました`);
      setShortToken("");
      onConnected();
    } catch {
      toast.error("接続に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="ig-short-token" className="text-sm">
          短期アクセストークン
        </Label>
        <Input
          id="ig-short-token"
          value={shortToken}
          onChange={(e) => setShortToken(e.target.value)}
          placeholder="Graph API Explorerで取得したトークンを貼り付け"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Meta for Developers → Graph API Explorer → Generate Access Token
        </p>
      </div>
      <Button type="submit" size="sm" disabled={loading || !shortToken.trim()}>
        {loading ? "接続中..." : "接続"}
      </Button>
    </form>
  );
}
