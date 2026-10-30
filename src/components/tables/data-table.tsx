"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { EmptyState } from "@/components/shared/common";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    align?: "left" | "right" | "center";
  }
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageSize?: number;
  initialSorting?: SortingState;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  pagination?: boolean;
  label?: string;
  rowTestId?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  initialSorting = [],
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  emptyAction,
  onRowClick,
  getRowId,
  pagination = true,
  label,
  rowTestId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [paging, setPaging] = React.useState({ pageIndex: 0, pageSize });
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination: paging },
    onSortingChange: setSorting,
    onPaginationChange: setPaging,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    getRowId,
    autoResetPageIndex: false,
  });

  // Keep the page index valid when filters shrink the data
  React.useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(data.length / paging.pageSize) - 1);
    if (paging.pageIndex > maxPage) setPaging((p) => ({ ...p, pageIndex: 0 }));
  }, [data.length, paging.pageIndex, paging.pageSize]);

  const rows = table.getRowModel().rows;
  const total = data.length;
  const from = total === 0 ? 0 : paging.pageIndex * paging.pageSize + 1;
  const to = pagination ? Math.min(total, (paging.pageIndex + 1) * paging.pageSize) : total;

  return (
    <div className="min-w-0">
      <Table aria-label={label}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => {
                const meta = h.column.columnDef.meta;
                const sortable = h.column.getCanSort();
                const dir = h.column.getIsSorted();
                return (
                  <TableHead
                    key={h.id}
                    className={cn(meta?.className, meta?.align === "right" && "text-right", meta?.align === "center" && "text-center")}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                  >
                    {h.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none", meta?.align === "right" && "flex-row-reverse")}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === "asc" ? <ArrowUp className="size-3" /> : dir === "desc" ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-testid={rowTestId?.(row.original)}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={onRowClick ? (e) => {
                  if ((e.target as HTMLElement).closest("button,a,[role=menuitem],input")) return;
                  onRowClick(row.original);
                } : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <TableCell key={cell.id} className={cn(meta?.className, meta?.align === "right" && "text-right tabular", meta?.align === "center" && "text-center")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pagination && total > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground tabular" aria-live="polite">
            Showing {from}–{to} of {total}
          </p>
          <div className="flex items-center gap-2">
            <span className="hidden text-muted-foreground sm:inline">Rows</span>
            <Select value={String(paging.pageSize)} onValueChange={(v) => setPaging({ pageIndex: 0, pageSize: Number(v) })}>
              <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="px-1 text-muted-foreground tabular">
              Page {paging.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
