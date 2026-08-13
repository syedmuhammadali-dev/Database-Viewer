import type { DataRow } from "@/lib/types";
import type { SqlType } from "./types";

export function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function sanitizeTableName(name: string): string {
  let clean = name
    .trim()
    .replace(/\.[a-zA-Z0-9]+$/u, "")
    .replace(/\s+/gu, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  if (clean.length === 0) clean = "dataset";
  if (/^\d/u.test(clean)) clean = `t_${clean}`;
  return clean;
}

function looksLikeNumber(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (!Number.isFinite(Number(trimmed))) return false;
  return String(Number(trimmed)) === trimmed;
}

function looksLikeInteger(value: unknown): boolean {
  if (typeof value === "number") return Number.isInteger(value);
  if (typeof value !== "string") return false;
  return looksLikeNumber(value) && Number.isInteger(Number(value));
}

function looksLikeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  return typeof value === "string" && /^(true|false)$/iu.test(value.trim());
}

export function inferColumnType(values: unknown[]): SqlType {
  const nonNull = values.filter((value) => value !== null && value !== undefined);
  if (nonNull.length === 0) return "VARCHAR";
  if (nonNull.every(looksLikeBoolean)) return "BOOLEAN";
  if (nonNull.every(looksLikeNumber)) {
    return nonNull.every(looksLikeInteger) ? "INTEGER" : "DOUBLE";
  }
  return "VARCHAR";
}

export function inferTypes(rows: DataRow[], columns: string[]): Record<string, SqlType> {
  const result: Record<string, SqlType> = {};
  for (const column of columns) {
    result[column] = inferColumnType(rows.map((row) => row[column]));
  }
  return result;
}

export function coerceValue(value: unknown, type: SqlType): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "INTEGER":
    case "DOUBLE":
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      }
      return value;
    case "BOOLEAN":
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.trim().toLowerCase() === "true";
      return value;
    default:
      return value;
  }
}