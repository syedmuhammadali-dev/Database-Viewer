"use client";

import { useMemo, useState } from "react";
import { Database } from "lucide-react";
import Link from "next/link";
import WorkspaceHeader from "./workspace-header";
import Sidebar from "./sidebar";
import MainArea from "./main-area";
import ImportDialog from "@/components/import/import-dialog";
import type { ParsedDataset, TableInfo, ViewMode } from "@/lib/types";
import { uniqueTableName } from "@/lib/importers";

export default function Workspace() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [datasets, setDatasets] = useState<Record<string, ParsedDataset>>({});
  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [importOpen, setImportOpen] = useState(false);

  const activeTable = useMemo(
    () => tables.find((t) => t.name === activeTableName) ?? null,
    [tables, activeTableName],
  );

  const handleImported = (dataset: ParsedDataset) => {
    const existingNames = tables.map((t) => t.name);
    const tableName = uniqueTableName(existingNames, dataset.name);
    const table: TableInfo = {
      name: tableName,
      rowCount: dataset.rows.length,
      columns: dataset.columns,
    };
    setTables((prev) => [...prev, table]);
    setDatasets((prev) => ({ ...prev, [tableName]: dataset }));
    setActiveTableName(tableName);
    setViewMode("table");
  };

  const handleClear = () => {
    setTables([]);
    setDatasets({});
    setActiveTableName(null);
    setViewMode("table");
  };

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <WorkspaceHeader
        tableCount={tables.length}
        activeTableName={activeTableName}
        onImportClick={() => setImportOpen(true)}
        onClear={handleClear}
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
          activeDataset={
            activeTableName ? datasets[activeTableName] ?? null : null
          }
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
      <div className="flex h-7 shrink-0 items-center border-t border-zinc-800 bg-zinc-900/60 px-3 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Database className="h-3 w-3" aria-hidden />
          Temporary in-browser session
        </span>
        <span className="ml-auto">Data stays in your browser</span>
      </div>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
      <Link
        href="/"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-zinc-800 focus:px-3 focus:py-1 focus:text-sm"
      >
        Skip to landing page
      </Link>
    </div>
  );
}