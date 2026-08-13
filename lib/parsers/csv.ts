import Papa from "papaparse";
import type { DataRow, ParsedDataset } from "@/lib/types";
import { ParseError } from "@/lib/errors";

function normalizeCsvRow(row: Record<string, unknown>): DataRow {
  const out: DataRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === "" || value === undefined) {
      out[key] = null;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function uniqueColumns(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base =
      header && header.trim().length > 0
        ? header.trim()
        : `column_${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export type ParseCsvResult = ParsedDataset;

export async function parseCsvFile(file: File): Promise<ParseCsvResult> {
  const content = await file.text();
  const name = file.name.replace(/\.[^.]+$/, "").trim() || "dataset";
  return parseCsv(content, name);
}

export async function parseCsv(
  content: string,
  name: string,
): Promise<ParseCsvResult> {
  if (typeof content !== "string") {
    throw new ParseError("Unable to read this file's contents.");
  }
  if (content.trim().length === 0) {
    throw new ParseError("This file is empty. Nothing to import.");
  }

  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    const rowHint =
      first.row !== undefined
        ? ` near row ${first.row + 1}`
        : "";
    throw new ParseError(
      `Unable to parse the CSV (${first.message}).${rowHint}`,
    );
  }

  const data = result.data as Record<string, unknown>[];
  if (data.length === 0) {
    throw new ParseError("The file contains a header but no data rows.");
  }

  const rawColumns = result.meta.fields ?? [];
  if (rawColumns.length === 0) {
    throw new ParseError("The file does not have a usable header row.");
  }

  const columns = uniqueColumns(rawColumns);
  if (columns.length === 0) {
    throw new ParseError("The file does not contain any columns.");
  }

  const rows = data.map(normalizeCsvRow);

  return { name, columns, rows };
}