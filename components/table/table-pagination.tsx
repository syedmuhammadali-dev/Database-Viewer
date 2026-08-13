"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type TablePaginationProps = {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
};

const PAGE_SIZES = [25, 50, 100, 200];

export default function TablePagination({
  pageIndex,
  pageCount,
  pageSize,
  onPageSizeChange,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
}: TablePaginationProps) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-t border-zinc-800 bg-zinc-900/40 px-3">
      <label className="flex items-center gap-1.5 text-xs text-zinc-500">
        Rows per page
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="ml-auto text-xs tabular-nums text-zinc-500">
        Page {pageIndex + 1} of {Math.max(1, pageCount)}
      </span>
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canPrevious}
        aria-label="Previous page"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next page"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}