"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Pencil } from "lucide-react";
import type { Post } from "@/lib/firebase/firestore";
import type { PlatformConfig } from "@/lib/platforms/types";
import { formatKpiValue } from "@/lib/kpi/calculator";
import { getThumbnailUrl } from "@/lib/platforms/utils";

type Props = {
  posts: Post[];
  config: PlatformConfig;
  onEditPost?: (post: Post) => void;
};

export function PostsTable({ posts, config, onEditPost }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Post>[]>(() => {
    const base: ColumnDef<Post>[] = [
      {
        accessorKey: "postKey",
        header: "投稿",
        cell: ({ row }) => {
          const { postKey, title, permalink, thumbnailUrl } = row.original;
          const thumb = getThumbnailUrl(config.id, postKey, thumbnailUrl);
          const content = (
            <div className="flex items-center gap-2">
              {thumb && (
                <img
                  src={thumb}
                  alt=""
                  className="w-16 h-9 rounded object-cover shrink-0"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 max-w-[180px]">
                <span className="text-sm truncate block">
                  {title || postKey}
                </span>
              </div>
            </div>
          );
          if (permalink) {
            return (
              <a href={permalink} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                {content}
              </a>
            );
          }
          return content;
        },
      },
      {
        accessorKey: "publishedAt",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            投稿日時
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const d = row.original.publishedAt?.toDate?.();
          if (!d) return "—";
          const dateStr = d.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const cap = row.original.capturedAt?.toDate?.();
          if (!cap) return dateStr;
          const diffH = Math.floor((cap.getTime() - d.getTime()) / (1000 * 60 * 60));
          const delayLabel = diffH < 1 ? "<1h" : diffH < 48 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`;
          return (
            <div>
              <span>{dateStr}</span>
              <span className="block text-[10px] text-amber-600">{delayLabel}後に記録</span>
            </div>
          );
        },
        sortingFn: (a, b) => {
          const aDate = a.original.publishedAt?.toDate?.()?.getTime() ?? 0;
          const bDate = b.original.publishedAt?.toDate?.()?.getTime() ?? 0;
          return aDate - bDate;
        },
      },
      {
        id: "tags",
        header: "タグ",
        cell: ({ row }) => {
          const tags = row.original.tags;
          return (
            <div className="flex flex-wrap gap-1">
              {Object.entries(tags)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-xs">
                    {v}
                  </Badge>
                ))}
            </div>
          );
        },
      },
    ];

    // Add primary metrics as columns
    const primaryMetrics = config.metrics.filter((m) => m.required).slice(0, 3);
    for (const metric of primaryMetrics) {
      base.push({
        accessorFn: (row) => row.metrics[metric.key],
        id: `metric_${metric.key}`,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {metric.label}
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => {
          const v = getValue() as number | undefined;
          return v != null ? v.toLocaleString("ja-JP") : "—";
        },
      });
    }

    // Add KPIs as columns
    for (const kpi of config.kpis) {
      base.push({
        accessorFn: (row) => row.calculatedKpis?.[kpi.key],
        id: `kpi_${kpi.key}`,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {kpi.label}
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => formatKpiValue(getValue() as number, kpi.format),
      });
    }

    base.push({
      accessorKey: "source",
      header: "入力元",
      cell: ({ row }) => {
        const labels: Record<string, string> = {
          manual: "手動",
          csv: "CSV",
          api: "API",
        };
        return (
          <Badge variant="outline" className="text-xs">
            {labels[row.original.source] ?? row.original.source}
          </Badge>
        );
      },
    });

    if (onEditPost) {
      base.push({
        id: "edit",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEditPost(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ),
      });
    }

    return base;
  }, [config, onEditPost]);

  const table = useReactTable({
    data: posts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <p className="text-lg mb-1">投稿データがありません</p>
        <p className="text-sm">「投稿を追加」または「CSVアップロード」でデータを入力してください</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id} className="whitespace-nowrap">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
