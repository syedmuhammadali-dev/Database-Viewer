export type DataRow = Record<string, unknown>;

export type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
};

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

export type DatasetContext = {
  sourceKind: DataSourceKind;
  sourceName: string;
  tableName: string;
};
