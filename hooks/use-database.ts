"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { instantiateBrowserDatabase } from "@/lib/database";
import type { Database, QueryResult } from "@/lib/database";
import type { DataRow, ParsedDataset, TableInfo } from "@/lib/types";
import { uniqueTableName } from "@/lib/importers";
import { DatabaseError } from "@/lib/errors";

const ENGINE_START_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DatabaseError(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

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
    const init = withTimeout(
      (async () => {
        const db = await instantiateBrowserDatabase();
        dbRef.current = db;
        await db.init();
        await refreshTables();
        if (!cancelled) setReady(true);
      })(),
      ENGINE_START_TIMEOUT_MS,
      "The in-browser database engine took too long to start. Reload the page to try again.",
    );
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
      options?: { limit?: number; offset?: number; includeRowId?: boolean },
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

  const insertRow = useCallback(
    async (name: string, values: DataRow) => {
      const db = await ensureReady();
      await db.insertRow(name, values);
      setTables(await db.listTables());
    },
    [ensureReady],
  );

  const updateRow = useCallback(
    async (name: string, rowid: number, values: DataRow) => {
      const db = await ensureReady();
      await db.updateRow(name, rowid, values);
    },
    [ensureReady],
  );

  const deleteRow = useCallback(
    async (name: string, rowid: number) => {
      const db = await ensureReady();
      await db.deleteRow(name, rowid);
      setTables(await db.listTables());
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
    insertRow,
    updateRow,
    deleteRow,
    refreshTables,
  };
}