import type { DataRow, ParsedDataset } from "@/lib/types";
import { ParseError } from "@/lib/errors";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isArrayOfObjects(value: unknown[]): boolean {
  return value.length > 0 && value.some(isPlainObject);
}

function flattenObject(
  value: Record<string, unknown>,
  out: DataRow,
  prefix: string,
): void {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) {
      flattenObject(child, out, path);
    } else if (Array.isArray(child)) {
      out[path] = JSON.stringify(child);
    } else {
      out[path] = child;
    }
  }
}

function rowFromEntry(entry: unknown): DataRow {
  if (isPlainObject(entry)) {
    const out: DataRow = {};
    flattenObject(entry, out, "");
    return out;
  }
  if (Array.isArray(entry)) {
    if (entry.every((cell) => !isPlainObject(cell))) {
      const out: DataRow = {};
      entry.forEach((cell, index) => {
        out[`column_${index + 1}`] = cell;
      });
      return out;
    }
    return toEntryRows(entry)[0];
  }
  return { value: entry };
}

function toEntryRows(entries: unknown[]): DataRow[] {
  if (isArrayOfObjects(entries)) {
    return entries.map((entry) => {
      const out: DataRow = {};
      flattenObject(entry as Record<string, unknown>, out, "");
      return out;
    });
  }
  return entries.map(rowFromEntry);
}

function uniqueColumns(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header && header.length > 0 ? header : `column_${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export type ParseJsonResult = ParsedDataset;

export async function parseJsonFile(file: File): Promise<ParseJsonResult> {
  const content = await file.text();
  const name = file.name.replace(/\.[^.]+$/, "").trim() || "dataset";
  return parseJson(content, name);
}

export async function parseJson(
  content: string,
  name: string,
): Promise<ParseJsonResult> {
  if (typeof content !== "string") {
    throw new ParseError("Unable to read this file's contents.");
  }
  if (content.trim().length === 0) {
    throw new ParseError("This file is empty. Nothing to import.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new ParseError(`This file is not valid JSON (${detail}).`);
  }

  const rows = normalizeJsonData(parsed);
  if (rows.length === 0) {
    throw new ParseError("This JSON file has no records to import.");
  }

  const columnSet = new Map<string, number>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.set(key, columnSet.get(key) ?? 0);
    }
  }

  const rawColumns = Array.from(columnSet.keys());
  const columns = uniqueColumns(rawColumns);
  if (columns.length === 0) {
    throw new ParseError("This JSON file does not contain any columns.");
  }

  return { name, columns, rows };
}

function normalizeJsonData(value: unknown): DataRow[] {
  if (Array.isArray(value)) {
    return toEntryRows(value);
  }
  if (isPlainObject(value)) {
    // A single object with scalar/array values: import as a single row.
    const out: DataRow = {};
    flattenObject(value, out, "");
    return Object.keys(out).length > 0 ? [out] : [];
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [{ value }];
}