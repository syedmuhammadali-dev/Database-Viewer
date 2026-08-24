"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import WorkspaceHeader from "./workspace-header";
import Sidebar from "./sidebar";
import MainArea from "./main-area";
import DrivePanel from "./drive/drive-panel";
import CollectionExplorer from "./drive/collection-explorer";
import ImportDialog from "@/components/import/import-dialog";
import RowEditor from "@/components/table/row-editor";
import type { DataRow, ParsedDataset, ViewMode } from "@/lib/types";
import { ROW_ID_COLUMN } from "@/lib/database";
import { useDatabase } from "@/hooks/use-database";
import { useDriveDatabase, type DriveLink } from "@/hooks/use-drive-database";
import { extractDmlTargetTable } from "@/lib/sql/dml";
import { toUserMessage } from "@/lib/errors";

const DRIVE_SYNC_LIMIT = 100_000;

type RowEditorState = { mode: "add" } | { mode: "edit"; row: DataRow };

export default function Workspace() {
  const {
    ready,
    error: engineError,
    tables,
    importDataset,
    clear,
    selectAll,
    runQuery,
    insertRow,
    updateRow,
    deleteRow,
    refreshTables,
  } = useDatabase();
  const drive = useDriveDatabase();

  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [importOpen, setImportOpen] = useState(false);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [driveLinks, setDriveLinks] = useState<Record<string, DriveLink>>({});
  const [busyTableName, setBusyTableName] = useState<string | null>(null);
  const [busyCollection, setBusyCollection] = useState<string | null>(null);
  const [driveActionError, setDriveActionError] = useState<string | null>(null);
  const [explorerCollection, setExplorerCollection] = useState<string | null>(null);
  const [rowEditor, setRowEditor] = useState<RowEditorState | null>(null);
  const [rowEditorSaving, setRowEditorSaving] = useState(false);
  const [rowEditorError, setRowEditorError] = useState<string | null>(null);

  const linkedTableNames = useMemo(() => new Set(Object.keys(driveLinks)), [driveLinks]);
  const linkedCollectionNames = useMemo(
    () => new Set(Object.values(driveLinks).map((link) => link.collectionName)),
    [driveLinks],
  );

  const activeTable = useMemo(
    () => tables.find((t) => t.name === activeTableName) ?? null,
    [tables, activeTableName],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeTableName) {
        setRows([]);
        setRowsLoading(false);
        setRowsError(null);
        return;
      }
      setRowsLoading(true);
      setRowsError(null);
      try {
        const result = await selectAll(activeTableName, { includeRowId: true });
        if (!cancelled) setRows(result.rows);
      } catch (cause) {
        if (!cancelled) setRowsError(toUserMessage(cause));
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTableName, selectAll]);

  const handleImported = useCallback(
    async (dataset: ParsedDataset) => {
      const info = await importDataset(dataset);
      setActiveTableName(info.name);
      setViewMode("table");
    },
    [importDataset],
  );

  const handleClear = useCallback(async () => {
    await clear();
    setActiveTableName(null);
    setViewMode("table");
    setRows([]);
    setRowsError(null);
    setDriveLinks({});
  }, [clear]);

  const syncIfLinked = useCallback(
    async (tableName: string) => {
      const link = driveLinks[tableName];
      if (!link) return;
      setBusyTableName(tableName);
      try {
        const result = await selectAll(tableName, { limit: DRIVE_SYNC_LIMIT });
        await drive.syncTableToDrive(link.collectionName, result.rows);
      } catch (cause) {
        setDriveActionError(toUserMessage(cause));
      } finally {
        setBusyTableName(null);
      }
    },
    [drive, driveLinks, selectAll],
  );

  const handleRunQuery = useCallback(
    async (sql: string) => {
      const result = await runQuery(sql);
      await refreshTables();
      if (activeTableName) {
        selectAll(activeTableName, { includeRowId: true })
          .then((res) => setRows(res.rows))
          .catch(() => undefined);
      }
      const target = extractDmlTargetTable(sql);
      if (target && driveLinks[target]) void syncIfLinked(target);
      return result;
    },
    [runQuery, refreshTables, activeTableName, selectAll, driveLinks, syncIfLinked],
  );

  const handleImportCollection = useCallback(
    async (name: string) => {
      setBusyCollection(name);
      setDriveActionError(null);
      try {
        const dataset = await drive.importCollection(name);
        const info = await importDataset(dataset);
        setDriveLinks((prev) => ({
          ...prev,
          [info.name]: { databaseName: drive.databaseName ?? name, collectionName: name },
        }));
        setActiveTableName(info.name);
        setViewMode("table");
      } catch (cause) {
        setDriveActionError(toUserMessage(cause));
      } finally {
        setBusyCollection(null);
      }
    },
    [drive, importDataset],
  );

  const handlePushTable = useCallback(
    async (tableName: string) => {
      setBusyTableName(tableName);
      setDriveActionError(null);
      try {
        const result = await selectAll(tableName, { limit: DRIVE_SYNC_LIMIT });
        await drive.pushTableToDrive(tableName, result.rows);
        setDriveLinks((prev) => ({
          ...prev,
          [tableName]: { databaseName: drive.databaseName ?? tableName, collectionName: tableName },
        }));
      } catch (cause) {
        setDriveActionError(toUserMessage(cause));
      } finally {
        setBusyTableName(null);
      }
    },
    [drive, selectAll],
  );

  const handleSyncTable = useCallback(
    async (tableName: string) => {
      setDriveActionError(null);
      await syncIfLinked(tableName);
    },
    [syncIfLinked],
  );

  const refreshActiveRows = useCallback(async () => {
    if (!activeTableName) return;
    const result = await selectAll(activeTableName, { includeRowId: true });
    setRows(result.rows);
  }, [activeTableName, selectAll]);

  const handleAddRow = useCallback(() => {
    setRowEditorError(null);
    setRowEditor({ mode: "add" });
  }, []);

  const handleEditRow = useCallback((row: DataRow) => {
    setRowEditorError(null);
    setRowEditor({ mode: "edit", row });
  }, []);

  const handleDeleteRow = useCallback(
    async (row: DataRow) => {
      if (!activeTableName) return;
      const rowid = Number(row[ROW_ID_COLUMN]);
      if (!Number.isFinite(rowid)) return;
      try {
        await deleteRow(activeTableName, rowid);
        await refreshActiveRows();
        void syncIfLinked(activeTableName);
      } catch (cause) {
        setDriveActionError(toUserMessage(cause));
      }
    },
    [activeTableName, deleteRow, refreshActiveRows, syncIfLinked],
  );

  const handleSaveRow = useCallback(
    async (values: DataRow) => {
      if (!activeTableName || !rowEditor) return;
      setRowEditorSaving(true);
      setRowEditorError(null);
      try {
        if (rowEditor.mode === "add") {
          await insertRow(activeTableName, values);
        } else {
          const rowid = Number(rowEditor.row[ROW_ID_COLUMN]);
          if (!Number.isFinite(rowid)) throw new Error("Missing row reference.");
          await updateRow(activeTableName, rowid, values);
        }
        setRowEditor(null);
        await refreshActiveRows();
        void syncIfLinked(activeTableName);
      } catch (cause) {
        setRowEditorError(toUserMessage(cause));
      } finally {
        setRowEditorSaving(false);
      }
    },
    [activeTableName, rowEditor, insertRow, updateRow, refreshActiveRows, syncIfLinked],
  );

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <WorkspaceHeader
        tableCount={tables.length}
        activeTableName={activeTableName}
        importDisabled={false}
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
          linkedTableNames={linkedTableNames}
          syncingTableName={busyTableName}
          onPushTable={drive.databaseName ? handlePushTable : undefined}
          onSyncTable={drive.databaseName ? handleSyncTable : undefined}
          footer={
            <DrivePanel
              drive={drive}
              linkedCollections={linkedCollectionNames}
              busyCollection={busyCollection}
              onImportCollection={handleImportCollection}
              onOpenExplorer={setExplorerCollection}
            />
          }
        />
        <MainArea
          tables={tables}
          activeTable={activeTable}
          activeTableName={activeTableName}
          rows={rows}
          rowsLoading={rowsLoading}
          rowsError={rowsError}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          runQuery={handleRunQuery}
          onImported={handleImported}
          onAddRow={handleAddRow}
          onEditRow={handleEditRow}
          onDeleteRow={(row) => void handleDeleteRow(row)}
        />
      </div>
      <div className="flex h-7 shrink-0 items-center border-t border-zinc-800 bg-zinc-900/60 px-3 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Database className="h-3 w-3" aria-hidden />
          {!ready ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Initializing in-browser engine…
            </>
          ) : engineError ? (
            <>
              <TriangleAlert className="h-3 w-3 text-amber-400" aria-hidden />
              {engineError}
            </>
          ) : driveActionError ? (
            <>
              <TriangleAlert className="h-3 w-3 text-amber-400" aria-hidden />
              {driveActionError}
            </>
          ) : (
            "Temporary in-browser session"
          )}
        </span>
        <span className="ml-auto">Data stays in your browser</span>
      </div>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
      {rowEditor && activeTable ? (
        <RowEditor
          title={rowEditor.mode === "add" ? `Add row to ${activeTable.name}` : `Edit row in ${activeTable.name}`}
          columns={activeTable.columns}
          initialValues={rowEditor.mode === "edit" ? rowEditor.row : undefined}
          saving={rowEditorSaving}
          error={rowEditorError}
          onSave={handleSaveRow}
          onClose={() => setRowEditor(null)}
        />
      ) : null}
      {explorerCollection && drive.databaseName ? (
        <CollectionExplorer
          key={explorerCollection}
          name={explorerCollection}
          collection={drive.getCollectionHandle(explorerCollection)}
          onClose={() => setExplorerCollection(null)}
        />
      ) : null}
      <Link
        href="/"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-zinc-800 focus:px-3 focus:py-1 focus:text-sm"
      >
        Skip to landing page
      </Link>
    </div>
  );
}