"use client";

import {
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  columnFilteringFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Search,
  X,
} from "lucide-react";
import type { DataRow } from "@/lib/types";
import TablePagination from "./table-pagination";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
});

type DataTableProps = {
  rows: DataRow[];
  columns: string[];
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-xs text-zinc-600">NULL</span>;
  }
  return <span>{formatCell(value)}</span>;
}

export default function DataTable({ rows, columns }: DataTableProps) {
  const helper = useMemo(
    () => createColumnHelper<typeof features, DataRow>(),
    [],
  );

  const columnDefs = useMemo(
    () =>
      helper.columns(
        columns.map((col) =>
          helper.accessor(col, {
            header: col,
            size: 180,
            cell: (ctx) => <CellValue value={ctx.getValue()} />,
          }),
        ),
      ),
    [helper, columns],
  );

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 50 },
    },
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: () => true,
    columnResizeMode: "onChange",
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const totalCount = table.getRowCount();
  const searchValue = (table.state.globalFilter ?? "") as string;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 focus-within:border-blue-500">
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            placeholder="Search all columns…"
            aria-label="Search rows"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          {searchValue ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => table.setGlobalFilter("")}
              className="rounded p-0.5 text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </label>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">
          {filteredCount.toLocaleString()} / {totalCount.toLocaleString()}
        </span>
        <ColumnVisibility table={table} />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSorted = header.column.getIsSorted();
                  const size = header.getSize();
                  return (
                    <th
                      key={header.id}
                      style={{ width: `${size}px` }}
                      className="relative select-none border-b border-zinc-800 bg-zinc-900 px-3 py-1.5 text-left align-middle text-xs font-medium text-zinc-400"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex w-full items-center gap-1 rounded transition-colors hover:text-zinc-100"
                      >
                        <span className="truncate">
                          {header.isPlaceholder ? null : (
                            <table.FlexRender header={header} />
                          )}
                        </span>
                        {isSorted === "asc" ? (
                          <ArrowUp className="h-3 w-3 shrink-0 text-blue-400" aria-hidden />
                        ) : isSorted === "desc" ? (
                          <ArrowDown className="h-3 w-3 shrink-0 text-blue-400" aria-hidden />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
                        )}
                      </button>
                      {header.column.getCanResize() ? (
                        <button
                          type="button"
                          aria-label="Resize column"
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-blue-500 ${
                            header.column.getIsResizing()
                              ? "bg-blue-500"
                              : ""
                          }`}
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-zinc-500"
                >
                  No rows match the current search or filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/70"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="max-w-[320px] truncate px-3 py-1.5 align-middle text-zinc-300"
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        pageIndex={table.state.pagination.pageIndex}
        pageCount={table.getPageCount()}
        pageSize={table.state.pagination.pageSize}
        onPageSizeChange={(size) =>
          table.setPagination({ pageIndex: 0, pageSize: size })
        }
        onPrevious={() => table.previousPage()}
        onNext={() => table.nextPage()}
        canPrevious={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
      />
    </div>
  );
}

type ColumnVisibilityProps = {
  table: ReturnType<typeof useTable<typeof features, DataRow>>;
};

function ColumnVisibility({ table }: ColumnVisibilityProps) {
  const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        Columns
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-64 w-60 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
          {columns.map((column) => {
            const visible = column.getIsVisible();
            return (
              <label
                key={column.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={() => column.toggleVisibility()}
                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-blue-500"
                />
                <span className="truncate">{column.id}</span>
                {visible ? (
                  <Check className="ml-auto h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
                ) : null}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}