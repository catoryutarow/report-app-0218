"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Snapshot } from "@/lib/firebase/firestore";

type Props = {
  snapshots: Snapshot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  compareId: string | null;
  onCompareSelect: (id: string | null) => void;
};

export function SnapshotSelector({
  snapshots,
  selectedId,
  onSelect,
  onDelete,
  compareId,
  onCompareSelect,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Current snapshot */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-medium">
          表示するスナップショット
        </label>
        <div className="flex items-center gap-2">
          <Select value={selectedId ?? ""} onValueChange={onSelect}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="スナップショットを選択" />
            </SelectTrigger>
            <SelectContent>
              {snapshots.map((s) => (
                <SelectItem key={s.id} value={s.id!}>
                  {s.label}（{s.postCount}件）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedId && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(selectedId)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Compare with */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-medium">
          比較対象
        </label>
        <Select
          value={compareId ?? "__none__"}
          onValueChange={(v: string) => onCompareSelect(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="比較なし" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">比較なし</SelectItem>
            {snapshots
              .filter((s) => s.id !== selectedId)
              .map((s) => (
                <SelectItem key={s.id} value={s.id!}>
                  {s.label}（{s.postCount}件）
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
