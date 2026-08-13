import type { DataRow, ParsedDataset, TableInfo } from "@/lib/types";

export type SqlType = "INTEGER" | "DOUBLE" | "BOOLEAN" | "VARCHAR";

export interface Database {
  init(): Promise<void>;
  listTables(): Promise<TableInfo[]>;
  getTable(name: string): Promise<TableInfo | null>;
  createTableFromDataset(parsed: ParsedDataset): Promise<TableInfo>;
  dropTable(name: string): Promise<void>;
  renameTable(name: string, newName: string): Promise<void>;
  selectAll(name: string, options?: { limit?: number; offset?: number }): Promise<QueryResult>;
  query(sql: string): Promise<QueryResult>;
  dispose(): Promise<void>;
}

export interface QueryResult {
  columns: string[];
  rows: DataRow[];
  rowCount: number;
}

export interface DatabaseBundleUrls {
  mainModule: string;
  mainWorker: string | null;
  pthreadWorker: string | null;
}