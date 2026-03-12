"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { MobileSidebar } from "./Sidebar";

type Props = {
  children?: React.ReactNode;
};

export function Header({ children }: Props) {
  const [tokenWarning, setTokenWarning] = useState<{
    show: boolean;
    daysRemaining: number;
    expired: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/ig/token/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && (data.expired || (data.daysRemaining ?? 99) <= 7)) {
          setTokenWarning({
            show: true,
            daysRemaining: data.daysRemaining ?? 0,
            expired: data.expired ?? false,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {tokenWarning?.show && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">
            {tokenWarning.expired
              ? "Instagram APIトークンが期限切れです。"
              : `Instagram APIトークンの期限が残り${tokenWarning.daysRemaining}日です。`}
          </span>
          <Link href="/settings" className="text-destructive underline font-medium">
            設定で更新
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background px-4 py-3 md:px-6">
        <MobileSidebar />
        <div className="flex-1 flex items-center gap-4">
          {children}
        </div>
      </header>
    </>
  );
}
