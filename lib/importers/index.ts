import type { ParsedDataset } from "@/lib/types";
import { ImportError } from "@/lib/errors";
import {
  detectFileKind,
  decodeUtf8,
  validateImportFile,
  type FileKind,
} from "./validate";
import { parseCsv } from "@/lib/parsers/csv";
import { parseJson } from "@/lib/parsers/json";
import { inspectWorkbook, parseSheet } from "@/lib/parsers/excel";
import { readFileAsArrayBuffer } from "./read-file";

export type ImportPhase = "reading" | "parsing" | "importing";

export type ImportFileOutcome = { name: string; rows: number };

export type BinaryImportKind = "parquet";

export async function importFileInto(
  file: File,
  onImported: (dataset: ParsedDataset) => void | Promise<void>,
  signal: AbortSignal,
  onPhase?: (phase: ImportPhase) => void,
  onBinaryFile?: (
    file: File,
    kind: BinaryImportKind,
    buffer: ArrayBuffer,
  ) => Promise<ImportFileOutcome[]>,
): Promise<ImportFileOutcome[]> {
  validateImportFile(file);
  onPhase?.("reading");
  const buffer = await readFileAsArrayBuffer(file, () => undefined, signal);
  const bytes = new Uint8Array(buffer);
  const kind = detectFileKind(file, bytes);
  if (kind === "unknown") {
    throw new ImportError(
      `"${file.name}" is not a supported file. Upload a .csv, .xlsx, .xls, .json or .parquet file.`,
    );
  }

  if (kind === "sqlite") {
    throw new ImportError(
      `"${file.name}" is a SQLite database. SQLite import isn't supported yet (the DuckDB SQLite extension is unstable in this build) — export its tables to CSV or Parquet and import those instead.`,
    );
  }

  if (kind === "parquet") {
    if (!onBinaryFile) {
      throw new ImportError(`"${file.name}" can't be imported here.`);
    }
    onPhase?.("importing");
    return onBinaryFile(file, kind, buffer);
  }

  onPhase?.("parsing");
  const outcomes: ImportFileOutcome[] = [];
  if (kind === "excel") {
    const workbook = inspectWorkbook(buffer, file.name);
    for (const sheet of workbook.sheets) {
      const dataset = parseSheet(buffer, sheet.name, file.name);
      onPhase?.("importing");
      await onImported(dataset);
      outcomes.push({ name: dataset.name, rows: dataset.rows.length });
    }
    return outcomes;
  }
  const content = decodeUtf8(bytes);
  const dataset = await importContent(kind, file.name, content);
  onPhase?.("importing");
  await onImported(dataset);
  outcomes.push({ name: dataset.name, rows: dataset.rows.length });
  return outcomes;
}

export async function importFile(file: File): Promise<ParsedDataset> {
  validateImportFile(file);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const kind = detectFileKind(file, bytes);
  const content = decodeUtf8(bytes);
  return importContent(kind, file.name, content);
}

export async function importContent(
  kind: FileKind,
  fileName: string,
  content: string,
): Promise<ParsedDataset> {
  const name = fileName.replace(/\.[^.]+$/, "").trim() || "dataset";
  switch (kind) {
    case "csv":
      return parseCsv(content, name);
    case "excel":
      throw new ImportError(
        `"${fileName}" looks like an Excel file. Use the worksheet picker to import it.`,
      );
    case "json":
      return parseJson(content, name);
    default:
      throw new ImportError(
        "Unsupported file type. Upload a .csv, .xlsx, .xls or .json file — documents and presentations (.docx, .odt, .pptx) can't be imported as data tables.",
      );
  }
}

export function uniqueTableName(existing: string[], base: string): string {
  const seen = new Set(existing);
  if (!seen.has(base)) return base;
  let i = 2;
  while (seen.has(`${base}_${i}`)) {
    i += 1;
  }
  return `${base}_${i}`;
}