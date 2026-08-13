"use client";

import { Layers, Table as TableIcon } from "lucide-react";
import type { TableInfo } from "@/lib/types";

type SidebarProps = {
  tables: TableInfo[];
  activeTableName: string | null;
  onSelectTable: (name: string) => void;
};

export default function Sidebar({
  tables,
  activeTableName,
  onSelectTable,
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
              return (
                <li key={table.name}>
                  <button
                    type="button"
                    onClick={() => onSelectTable(table.name)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${isActive
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
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}