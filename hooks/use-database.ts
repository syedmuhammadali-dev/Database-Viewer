"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { instantiateBrowserDatabase } from "@/lib/database";
import type { Database, QueryResult } from "@/lib/database";
import type { ParsedDataset, TableInfo } from "@/lib/types";
import { uniqueTableName } from "@/lib/importers";

export function useDatabase() {
  const dbRef = useRef<Database | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);

  const refreshTables = useCallback(async () => {
    if (!dbRef.current) return;
    const list = await dbRef.current.listTables();
    setTables(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await instantiateBrowserDatabase();
        if (cancelled) {
          await db.dispose().catch(() => undefined);
          return;
        }
        dbRef.current = db;
        await db.init();
        await refreshTables();
        if (!cancelled) setReady(true);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();
    return () => {
      cancelled = true;
      const db = dbRef.current;
      dbRef.current = null;
      if (db) {
        void db.dispose().catch(() => undefined);
      }
    };
  }, [refreshTables]);

  const importDataset = useCallback(
    async (dataset: ParsedDataset): Promise<TableInfo> => {
      const db = dbRef.current;
      if (!db) throw new Error("Database engine is not ready yet.");
      const existing = (await db.listTables()).map((table) => table.name);
      const name = uniqueTableName(existing, dataset.name);
      const info = await db.createTableFromDataset({ ...dataset, name });
      setTables(await db.listTables());
      return info;
    },
    [],
  );

  const dropTable = useCallback(
    async (name: string) => {
      const db = dbRef.current;
      if (!db) return;
      await db.dropTable(name);
      setTables(await db.listTables());
    },
    [],
  );

  const clear = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    const list = await db.listTables();
    for (const table of list) {
      await db.dropTable(table.name).catch(() => undefined);
    }
    setTables([]);
  }, []);

  const selectAll = useCallback(
    async (
      name: string,
      options?: { limit?: number; offset?: number },
    ): Promise<QueryResult> => {
      const db = dbRef.current;
      if (!db) throw new Error("Database engine is not ready yet.");
      return db.selectAll(name, options);
    },
    [],
  );

  const runQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    const db = dbRef.current;
    if (!db) throw new Error("Database engine is not ready yet.");
    return db.query(sql);
  }, []);

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