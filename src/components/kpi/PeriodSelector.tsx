"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { periodPresets, type PeriodPreset } from "@/lib/kpi/periods";

type Props = {
  selected: PeriodPreset;
  onSelect: (preset: PeriodPreset) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (val: string) => void;
  onCustomEndChange?: (val: string) => void;
};

export function PeriodSelector({
  selected,
  onSelect,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {periodPresets.map((p) => (
        <Button
          key={p.key}
          variant={selected === p.key ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(p.key)}
        >
          {p.label}
        </Button>
      ))}
      {selected === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onCustomStartChange?.(e.target.value)
            }
            className="w-36 h-8 text-sm"
          />
          <span className="text-muted-foreground text-sm">〜</span>
          <Input
            type="date"
            value={customEnd ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onCustomEndChange?.(e.target.value)
            }
            className="w-36 h-8 text-sm"
          />
        </div>
      )}
    </div>
  );
}
