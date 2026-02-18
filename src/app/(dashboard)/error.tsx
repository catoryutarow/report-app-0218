"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h2 className="text-xl font-bold mb-2">エラーが発生しました</h2>
      <p className="text-sm text-muted-foreground mb-1">
        {error.message}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-4">
          Digest: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          再試行
        </Button>
        <Button onClick={() => (window.location.href = "/login")} variant="ghost">
          ログイン画面へ
        </Button>
      </div>
    </div>
  );
}
