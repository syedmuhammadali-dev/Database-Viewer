"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { instantiateBrowserDatabase } from "@/lib/database";
import type { Database, QueryResult } from "@/lib/database";
import type { ParsedDataset, TableInfo } from "@/lib/types";
import { uniqueTableName } from "@/lib/importers";

export function useDatabase() {
  const dbRef = useRef<Database | null>(null);
  const initRef = useRef<Promise<void> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);

  const refreshTables = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    const list = await db.listTables();
    setTables(list);
    return list;
  }, []);

  const ensureReady = useCallback(async (): Promise<Database> => {
    const init = initRef.current;
    if (init) await init;
    const db = dbRef.current;
    if (!db) {
      // Instance is not up yet (or the session was torn down).
      throw new Error(
        initRef.current === null
          ? "The in-browser database is still starting. Try again in a moment."
          : "The in-browser database session ended.",
      );
    }
    return db;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = (async () => {
      const db = await instantiateBrowserDatabase();
      dbRef.current = db;
      await db.init();
      await refreshTables();
      if (!cancelled) setReady(true);
    })();
    initRef.current = init;

    init.catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });

    return () => {
      cancelled = true;
      initRef.current = null;
      const db = dbRef.current;
      dbRef.current = null;
      if (db) {
        void db.dispose().catch(() => undefined);
      }
    };
  }, [refreshTables]);

  const importDataset = useCallback(
    async (dataset: ParsedDataset): Promise<TableInfo> => {
      const db = await ensureReady();
      const existing = (await db.listTables()).map((table) => table.name);
      const name = uniqueTableName(existing, dataset.name);
      const info = await db.createTableFromDataset({ ...dataset, name });
      setTables(await db.listTables());
      return info;
    },
    [ensureReady],
  );

  const dropTable = useCallback(
    async (name: string) => {
      const db = await ensureReady();
      await db.dropTable(name);
      setTables(await db.listTables());
    },
    [ensureReady],
  );

  const clear = useCallback(async () => {
    const db = await ensureReady();
    const list = await db.listTables();
    for (const table of list) {
      await db.dropTable(table.name).catch(() => undefined);
    }
    setTables([]);
  }, [ensureReady]);

  const selectAll = useCallback(
    async (
      name: string,
      options?: { limit?: number; offset?: number },
    ): Promise<QueryResult> => {
      const db = await ensureReady();
      return db.selectAll(name, options);
    },
    [ensureReady],
  );

  const runQuery = useCallback(
    async (sql: string): Promise<QueryResult> => {
      const db = await ensureReady();
      return db.query(sql);
    },
    [ensureReady],
  );

  return {
    ready,
    error,
    tables,
    importDataset,
    dropTable,
    clear,
    selectAll,
    runQuery,
    refreshTables,
  };
}