"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import type { Account } from "@/lib/firebase/firestore";
import { getPlatformConfig } from "@/lib/platforms";
import { platformColors, platformEmoji } from "@/lib/platforms/utils";

type Props = {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
};

export function AccountCard({ account, onEdit, onDelete }: Props) {
  const config = getPlatformConfig(account.platform);
  const colors = platformColors[account.platform];
  const emoji = platformEmoji[account.platform];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <CardTitle className="text-base">{account.name}</CardTitle>
            <p className="text-sm text-muted-foreground">@{account.handle}</p>
          </div>
        </div>
        <Badge variant="outline" className={colors}>
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Link
            href={`/accounts/${account.id}`}
            className="text-sm text-primary hover:underline"
          >
            ダッシュボードを見る →
          </Link>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(account)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(account)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
