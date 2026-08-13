"use client";

import {
  ChevronDown,
  Database,
  Download,
  Eraser,
  Table as TableIcon,
  User,
} from "lucide-react";
import Link from "next/link";

type WorkspaceHeaderProps = {
  tableCount: number;
  activeTableName: string | null;
  importDisabled?: boolean;
  onImportClick: () => void;
  onClear: () => void;
};

export default function WorkspaceHeader({
  tableCount,
  activeTableName,
  importDisabled = false,
  onImportClick,
  onClear,
}: WorkspaceHeaderProps) {
  const hasData = tableCount > 0;

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900/70 px-3">
      <Link
        href="/"
        className="mr-2 flex items-center gap-2 font-semibold tracking-tight"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800">
          <Database className="h-4 w-4 text-blue-400" aria-hidden />
        </span>
        <span className="hidden text-sm sm:block">DataLens</span>
      </Link>

      <button
        type="button"
        onClick={onImportClick}
        disabled={importDisabled}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-40"
        title={
          importDisabled
            ? "Database engine is initializing"
            : "Import a dataset from a file"
        }
      >
        <TableIcon className="h-4 w-4" aria-hidden />
        Dataset
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
      </button>

      <span className="mx-1 hidden h-5 w-px bg-zinc-800 sm:block" />

      <button
        type="button"
        disabled={!hasData}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-40"
        title={hasData ? "Export current dataset" : "Import data to export"}
      >
        <Download className="h-4 w-4" aria-hidden />
        Export
      </button>

      <button
        type="button"
        onClick={onClear}
        disabled={!hasData}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-40"
        title={
          hasData ? "Clear temporary session" : "No data to clear"
        }
      >
        <Eraser className="h-4 w-4" aria-hidden />
        Clear
      </button>

      <div className="ml-auto flex items-center gap-2">
        {activeTableName ? (
          <span className="hidden max-w-[16rem] truncate text-xs text-zinc-500 md:block">
            Active: <span className="text-zinc-300">{activeTableName}</span>
          </span>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <User className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Account</span>
        </button>
      </div>
    </header>
  );
}