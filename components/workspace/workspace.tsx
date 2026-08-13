"use client";

import { useMemo, useState } from "react";
import { Database } from "lucide-react";
import Link from "next/link";
import WorkspaceHeader from "./workspace-header";
import Sidebar from "./sidebar";
import MainArea from "./main-area";
import type { TableInfo, ViewMode } from "@/lib/types";

export default function Workspace() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const activeTable = useMemo(
    () => tables.find((t) => t.name === activeTableName) ?? null,
    [tables, activeTableName],
  );

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <WorkspaceHeader
        tableCount={tables.length}
        activeTableName={activeTableName}
        onClear={() => {
          setTables([]);
          setActiveTableName(null);
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          tables={tables}
          activeTableName={activeTableName}
          onSelectTable={(name) => {
            setActiveTableName(name);
            setViewMode("table");
          }}
        />
        <MainArea
          tables={tables}
          activeTable={activeTable}
          activeTableName={activeTableName}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
      <div className="flex h-7 shrink-0 items-center border-t border-zinc-800 bg-zinc-900/60 px-3 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Database className="h-3 w-3" aria-hidden />
          DuckDB-Wasm · temporary in-browser session
        </span>
        <span className="ml-auto">Data stays in your browser</span>
      </div>
      <Link
        href="/"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-zinc-800 focus:px-3 focus:py-1 focus:text-sm"
      >
        Skip to landing page
      </Link>
    </div>
  );
}