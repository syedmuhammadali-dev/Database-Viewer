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
        "Unsupported file type. Upload a .csv, .xlsx, .xls or .json file.",
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