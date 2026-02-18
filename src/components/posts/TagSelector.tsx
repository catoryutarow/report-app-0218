"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TagDimension } from "@/lib/platforms/types";
import { useState } from "react";

type Props = {
  dimension: TagDimension;
  customOptions?: string[];
  value: string;
  onChange: (value: string) => void;
};

export function TagSelector({ dimension, customOptions, value, onChange }: Props) {
  const [isCustom, setIsCustom] = useState(false);
  const options = customOptions && customOptions.length > 0
    ? customOptions
    : dimension.examples;

  if (isCustom) {
    return (
      <div className="space-y-1">
        <Label className="text-sm">{dimension.label}</Label>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder={`${dimension.label}を入力`}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setIsCustom(false)}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            一覧から選択
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-sm">{dimension.label}</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={`${dimension.label}を選択`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setIsCustom(true)}
          className="text-xs text-muted-foreground hover:text-foreground px-2"
        >
          カスタム入力
        </button>
      </div>
    </div>
  );
}
