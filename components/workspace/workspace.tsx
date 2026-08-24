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
import type { DataRow, ParsedDataset, ViewMode } from "@/lib/types";
import { useDatabase } from "@/hooks/use-database";
import { useDriveDatabase, type DriveLink } from "@/hooks/use-drive-database";
import { toUserMessage } from "@/lib/errors";

const DRIVE_SYNC_LIMIT = 100_000;

export default function Workspace() {
  const {
    ready,
    error: engineError,
    tables,
    importDataset,
    clear,
    selectAll,
    runQuery,
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
        const result = await selectAll(activeTableName);
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

  const handleRunQuery = useCallback(
    async (sql: string) => {
      const result = await runQuery(sql);
      await refreshTables();
      if (activeTableName) {
        selectAll(activeTableName)
          .then((res) => setRows(res.rows))
          .catch(() => undefined);
      }
      return result;
    },
    [runQuery, refreshTables, activeTableName, selectAll],
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
      const link = driveLinks[tableName];
      if (!link) return;
      setBusyTableName(tableName);
      setDriveActionError(null);
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