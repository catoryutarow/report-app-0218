"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagSelector } from "./TagSelector";
import type { PlatformConfig } from "@/lib/platforms/types";
import type { Account } from "@/lib/firebase/firestore";
import { useState } from "react";

type Props = {
  config: PlatformConfig;
  account: Account;
  onSubmit: (data: {
    postKey: string;
    publishedAt: string;
    permalink: string;
    tags: Record<string, string>;
    metrics: Record<string, number>;
    notes: string;
  }) => Promise<void>;
};

export function PostForm({ config, account, onSubmit }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [tags, setTags] = useState<Record<string, string>>({});

  // Build Zod schema dynamically from platform config
  const metricsShape: Record<string, z.ZodTypeAny> = {};
  for (const metric of config.metrics) {
    metricsShape[metric.key] = metric.required
      ? z.coerce.number().min(0, `${metric.label}は0以上で入力してください`)
      : z.coerce.number().min(0).optional().or(z.literal("").transform(() => undefined));
  }

  const schema = z.object({
    postKey: z.string().min(1, "投稿IDを入力してください"),
    publishedAt: z.string().min(1, "投稿日時を入力してください"),
    permalink: z.string().optional(),
    notes: z.string().optional(),
    metrics: z.object(metricsShape),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      postKey: "",
      publishedAt: "",
      permalink: "",
      notes: "",
      metrics: {},
    },
  });

  const onFormSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const metrics: Record<string, number> = {};
      for (const [key, val] of Object.entries(values.metrics)) {
        if (val != null && val !== "") {
          metrics[key] = Number(val);
        }
      }

      await onSubmit({
        postKey: values.postKey,
        publishedAt: values.publishedAt,
        permalink: values.permalink ?? "",
        tags,
        metrics,
        notes: values.notes ?? "",
      });
      reset();
      setTags({});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="postKey">投稿ID</Label>
              <Input
                id="postKey"
                placeholder="例: 20260218_01"
                {...register("postKey")}
              />
              {errors.postKey && (
                <p className="text-xs text-destructive">{errors.postKey.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="publishedAt">投稿日時</Label>
              <Input
                id="publishedAt"
                type="datetime-local"
                {...register("publishedAt")}
              />
              {errors.publishedAt && (
                <p className="text-xs text-destructive">{errors.publishedAt.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="permalink">投稿URL（任意）</Label>
            <Input
              id="permalink"
              placeholder="https://..."
              {...register("permalink")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">分類タグ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {config.tagDimensions.map((dim) => (
              <TagSelector
                key={dim.key}
                dimension={dim}
                customOptions={account.tags[dim.key as keyof typeof account.tags]}
                value={tags[dim.key] ?? ""}
                onChange={(v) => setTags((prev) => ({ ...prev, [dim.key]: v }))}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">インサイト数値</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {config.metrics.map((metric) => (
              <div key={metric.key} className="space-y-1">
                <Label htmlFor={metric.key}>
                  {metric.label}
                  {metric.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={metric.key}
                  type="number"
                  min="0"
                  step={metric.type === "float" || metric.type === "currency" ? "0.01" : "1"}
                  placeholder="0"
                  {...register(`metrics.${metric.key}` as const)}
                />
                {errors.metrics?.[metric.key] && (
                  <p className="text-xs text-destructive">
                    {(errors.metrics[metric.key] as { message?: string })?.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メモ（任意）</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="伸びた理由、改善点などのメモ"
            {...register("notes")}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? "保存中..." : "保存してKPIを自動計算"}
        </Button>
      </div>
    </form>
  );
}
