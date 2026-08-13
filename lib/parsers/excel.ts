import * as XLSX from "xlsx";
import type { DataRow, ParsedDataset } from "@/lib/types";
import { ParseError } from "@/lib/errors";

export type SheetSummary = {
  name: string;
  rowCount: number;
  columns: string[];
};

export type WorkbookInspect = {
  fileName: string;
  workbookName: string;
  sheets: SheetSummary[];
};

function workbookNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || "workbook";
}

function uniqueColumns(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base =
      typeof header === "string" && header.trim().length > 0
        ? header.trim()
        : `column_${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function looksLikeExcel(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) return false;
  // ZIP (XLSX): "PK" magic
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  // OLE2 Compound File (.xls): D0 CF 11 E0 A1 B1 1A E1
  const isCfb =
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1;
  return isZip || isCfb;
}

function readWorkbook(buffer: ArrayBuffer, fileName: string): XLSX.WorkBook {
  if (!looksLikeExcel(buffer)) {
    throw new ParseError(
      `Unable to open "${fileName}". It is not a valid Excel workbook.`,
    );
  }
  try {
    return XLSX.read(buffer, { type: "array" });
  } catch {
    throw new ParseError(
      `Unable to open "${fileName}". It is not a valid Excel workbook.`,
    );
  }
}

export function inspectWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): WorkbookInspect {
  const workbook = readWorkbook(buffer, fileName);
  const workbookName = workbookNameFromFile(fileName);

  const sheets: SheetSummary[] = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) {
      return { name, rowCount: 0, columns: [] };
    }
    const columns = readFirstRow(worksheet);
    return { name, rowCount: readRowCount(worksheet), columns };
  });

  return { fileName, workbookName, sheets };
}

function readRowCount(worksheet: XLSX.WorkSheet): number {
  const ref = worksheet["!ref"];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  return range.e.r - range.s.r + 1;
}

function readFirstRow(worksheet: XLSX.WorkSheet): string[] {
  const firstRow = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    range: 0,
    defval: null,
  });
  const cells = firstRow[0] ?? [];
  const raw = cells.map((cell) =>
    cell === null || cell === undefined ? "" : String(cell),
  );
  return uniqueColumns(raw);
}

export function parseSheet(
  buffer: ArrayBuffer,
  sheetName: string,
  fileName: string,
): ParsedDataset {
  const workbook = readWorkbook(buffer, fileName);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new ParseError(`The sheet "${sheetName}" could not be found.`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
  });

  const headerIndex = matrix.findIndex(
    (row) => Array.isArray(row) && row.length > 0,
  );
  if (headerIndex === -1) {
    throw new ParseError(
      `The sheet "${sheetName}" is empty. Nothing to import.`,
    );
  }

  const headerSources = matrix[headerIndex];
  const columns = uniqueColumns(headerSources.map((cell) => String(cell)));

  const emptyOnly = columns.every((col) => col.length === 0);
  if (columns.length === 0 || emptyOnly) {
    throw new ParseError(
      `The sheet "${sheetName}" does not have a usable header row.`,
    );
  }

  const rows: DataRow[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!Array.isArray(row) || row.every((cell) => cell === null || cell === "")) {
      continue;
    }
    const record: DataRow = {};
    const length = Math.max(columns.length, row.length);
    for (let c = 0; c < length; c += 1) {
      let value: unknown = row[c];
      if (value === undefined || value === "") value = null;
      record[columns[c] ?? `column_${c + 1}`] = value;
    }
    rows.push(record);
  }

  if (rows.length === 0) {
    throw new ParseError(
      `The sheet "${sheetName}" has a header but no data rows.`,
    );
  }

  return {
    name: sheetName,
    columns,
    rows,
  };
}