"use client";

import type { ReactNode } from "react";
import { Cloud, Layers, Loader2, Table as TableIcon, UploadCloud } from "lucide-react";
import type { TableInfo } from "@/lib/types";

type SidebarProps = {
  tables: TableInfo[];
  activeTableName: string | null;
  onSelectTable: (name: string) => void;
  linkedTableNames?: Set<string>;
  syncingTableName?: string | null;
  onPushTable?: (name: string) => void;
  onSyncTable?: (name: string) => void;
  footer?: ReactNode;
};

export default function Sidebar({
  tables,
  activeTableName,
  onSelectTable,
  linkedTableNames,
  syncingTableName,
  onPushTable,
  onSyncTable,
  footer,
}: SidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/40">
      <div className="flex h-9 items-center gap-2 border-b border-zinc-800 px-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <Layers className="h-3.5 w-3.5" aria-hidden />
        Tables
      </div>
      <nav className="flex-1 overflow-y-auto py-1" aria-label="Database tables">
        {tables.length === 0 ? (
          <p className="px-3 py-2 text-xs leading-5 text-zinc-600">
            No tables yet.
            <br />
            Import a dataset to get started.
          </p>
        ) : (
          <ul className="space-y-px p-1.5">
            {tables.map((table) => {
              const isActive = table.name === activeTableName;
              const isLinked = linkedTableNames?.has(table.name) ?? false;
              const isSyncing = syncingTableName === table.name;
              return (
                <li key={table.name} className="group flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectTable(table.name)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${isActive
                        ? "bg-blue-500/15 text-blue-300"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                      }`}
                  >
                    <TableIcon
                      className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                      aria-hidden
                    />
                    <span className="truncate">{table.name}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-zinc-600">
                      {table.rowCount.toLocaleString()}
                    </span>
                  </button>
                  {onPushTable || onSyncTable ? (
                    <button
                      type="button"
                      disabled={isSyncing}
                      title={
                        isLinked
                          ? "Sync edits to Drive"
                          : "Push this table to Drive as a collection"
                      }
                      onClick={() =>
                        isLinked ? onSyncTable?.(table.name) : onPushTable?.(table.name)
                      }
                      className={`shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50 ${
                        isLinked ? "text-emerald-400" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : isLinked ? (
                        <Cloud className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <UploadCloud className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {footer}
    </aside>
  );
}