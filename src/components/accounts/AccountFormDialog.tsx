"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getAllPlatforms } from "@/lib/platforms";
import type { Account, Platform } from "@/lib/firebase/firestore";

const schema = z.object({
  platform: z.string().min(1, "プラットフォームを選択してください"),
  name: z.string().min(1, "アカウント名を入力してください"),
  handle: z.string().min(1, "ハンドルを入力してください"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { platform: Platform; name: string; handle: string }) => Promise<void>;
  defaultValues?: Account;
};

export function AccountFormDialog({ open, onOpenChange, onSubmit, defaultValues }: Props) {
  const platforms = getAllPlatforms();
  const isEdit = !!defaultValues;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      platform: defaultValues?.platform ?? "",
      name: defaultValues?.name ?? "",
      handle: defaultValues?.handle ?? "",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    await onSubmit(values as { platform: Platform; name: string; handle: string });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "アカウントを編集" : "アカウントを追加"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>プラットフォーム</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>アカウント名</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 自社公式アカウント" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="handle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ハンドル / チャンネル名</FormLabel>
                  <FormControl>
                    <Input placeholder="例: my_brand_official" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "保存中..." : "保存"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
