import type { ParsedDataset } from "@/lib/types";
import { ImportError } from "@/lib/errors";
import {
  detectFileKind,
  validateImportFile,
  type FileKind,
} from "./validate";
import { parseCsv } from "@/lib/parsers/csv";

export async function importFile(file: File): Promise<ParsedDataset> {
  const kind = detectFileKind(file);
  validateImportFile(file, kind);
  const content = await file.text();
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
      throw new ImportError("Excel import is coming very soon.");
    case "json":
      throw new ImportError("JSON import is coming very soon.");
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