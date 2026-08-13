export type DataRow = Record<string, unknown>;

export type ParsedDataset = {
  name: string;
  columns: string[];
  rows: DataRow[];
};

export type TableInfo = {
  name: string;
  rowCount: number;
  columns: string[];
};

export type ViewMode = "table" | "json" | "sql";

export type DataSourceKind =
  | "csv"
  | "excel"
  | "json"
  | "google-drive"
  | "google-sheets";
