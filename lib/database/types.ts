import type { DataRow, ParsedDataset, TableInfo } from "@/lib/types";

export type SqlType = "INTEGER" | "DOUBLE" | "BOOLEAN" | "VARCHAR";

/** Pseudo-column key used to carry DuckDB's implicit `rowid` alongside a row's real columns for row-level edit/delete. */
export const ROW_ID_COLUMN = "__rowid__";

export interface Database {
  init(): Promise<void>;
  listTables(): Promise<TableInfo[]>;
  getTable(name: string): Promise<TableInfo | null>;
  createTableFromDataset(parsed: ParsedDataset): Promise<TableInfo>;
  dropTable(name: string): Promise<void>;
  renameTable(name: string, newName: string): Promise<void>;
  selectAll(
    name: string,
    options?: { limit?: number; offset?: number; includeRowId?: boolean },
  ): Promise<QueryResult>;
  query(sql: string): Promise<QueryResult>;
  insertRow(name: string, values: DataRow): Promise<void>;
  updateRow(name: string, rowid: number, values: DataRow): Promise<void>;
  deleteRow(name: string, rowid: number): Promise<void>;
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