"use client";

import {
  Braces,
  FileJson,
  Loader2,
  Table as TableIcon,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import type { DataRow, ParsedDataset, TableInfo, ViewMode } from "@/lib/types";
import type { QueryResult } from "@/lib/database";
import DataTable from "@/components/table/data-table";
import SqlConsole from "@/components/sql/sql-console";
import InlineImport from "@/components/import/inline-import";

type MainAreaProps = {
  tables: TableInfo[];
  activeTable: TableInfo | null;
  activeTableName: string | null;
  rows: DataRow[];
  rowsLoading: boolean;
  rowsError: string | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  runQuery: (sql: string) => Promise<QueryResult>;
  onImported: (dataset: ParsedDataset) => void | Promise<void>;
  onAddRow?: () => void;
  onEditRow?: (row: DataRow) => void;
  onDeleteRow?: (row: DataRow) => void;
};

export default function MainArea({
  tables,
  activeTable,
  activeTableName,
  rows,
  rowsLoading,
  rowsError,
  viewMode,
  onViewModeChange,
  runQuery,
  onImported,
  onAddRow,
  onEditRow,
  onDeleteRow,
}: MainAreaProps) {
  const hasData = tables.length > 0;

  if (!hasData) {
    return (
      <main className="flex flex-1 flex-col overflow-hidden">
        <TabBar viewMode={viewMode} onViewModeChange={onViewModeChange} />
        {viewMode === "sql" ? (
          <SqlConsole runQuery={runQuery} />
        ) : (
          <InlineImport onImported={onImported} />
        )}
      </main>
    );
  }

  if (!activeTableName || !activeTable) {
    return (
      <main className="flex flex-1 flex-col overflow-hidden">
        <TabBar viewMode={viewMode} onViewModeChange={onViewModeChange} />
        {viewMode === "sql" ? (
          <SqlConsole runQuery={runQuery} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Select a table from the sidebar.
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <TabBar viewMode={viewMode} onViewModeChange={onViewModeChange} />
      {viewMode === "sql" ? (
        <SqlConsole runQuery={runQuery} />
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
            <span className="text-sm font-medium text-zinc-200">
              {activeTable.name}
            </span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-400">
              {activeTable.rowCount.toLocaleString()} rows ·{" "}
              {activeTable.columns.length} columns
            </span>
          </div>
          <Pane
            viewMode={viewMode}
            columns={activeTable.columns}
            rows={rows}
            rowsLoading={rowsLoading}
            rowsError={rowsError}
            onAddRow={onAddRow}
            onEditRow={onEditRow}
            onDeleteRow={onDeleteRow}
          />
        </div>
      )}
    </main>
  );
}

function Pane({
  viewMode,
  columns,
  rows,
  rowsLoading,
  rowsError,
  onAddRow,
  onEditRow,
  onDeleteRow,
}: {
  viewMode: ViewMode;
  columns: string[];
  rows: DataRow[];
  rowsLoading: boolean;
  rowsError: string | null;
  onAddRow?: () => void;
  onEditRow?: (row: DataRow) => void;
  onDeleteRow?: (row: DataRow) => void;
}) {
  if (rowsLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-600" aria-hidden />
        <p>Loading rows…</p>
      </div>
    );
  }

  if (rowsError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-amber-400">
        <TriangleAlert className="h-4 w-4" aria-hidden />
        <p>{rowsError}</p>
      </div>
    );
  }

  if (viewMode === "table") {
    return (
      <DataTable
        columns={columns}
        rows={rows}
        editable
        onAddRow={onAddRow}
        onEditRow={onEditRow}
        onDeleteRow={onDeleteRow}
      />
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-zinc-500">
      <FileJson className="h-4 w-4 text-zinc-600" aria-hidden />
      <p>
        {viewMode === "json"
          ? "JSON view will display the raw records here."
          : "SQL editor will let you query this table here."}
      </p>
      {rows.length > 0 ? (
        <p className="text-xs text-zinc-600">
          {rows.length.toLocaleString()} rows ready.
        </p>
      ) : null}
    </div>
  );
}

function TabBar({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const tabs: { key: ViewMode; label: string; icon: typeof TableIcon }[] = [
    { key: "table", label: "Table", icon: TableIcon },
    { key: "json", label: "JSON", icon: Braces },
    { key: "sql", label: "SQL", icon: Terminal },
  ];

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900/40 px-2"
      role="tablist"
      aria-label="Data views"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = viewMode === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onViewModeChange(tab.key)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors ${isActive
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}