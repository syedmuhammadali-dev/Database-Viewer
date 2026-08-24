import type { DataRow, ParsedDataset } from "@/lib/types";
import type { Collection, DocumentData, StoredDocument } from "gdrive-db";

/** Turns a collection's documents into a table dataset; `id` becomes a normal column. */
export function docsToDataset(name: string, docs: StoredDocument[]): ParsedDataset {
  const columnSet = new Map<string, true>();
  columnSet.set("id", true);
  for (const doc of docs) {
    for (const key of Object.keys(doc)) columnSet.set(key, true);
  }
  const columns = Array.from(columnSet.keys());
  const rows: DataRow[] = docs.map((doc) => {
    const row: DataRow = {};
    for (const column of columns) row[column] = doc[column] ?? null;
    return row;
  });
  return { name, columns, rows };
}

export type SyncSummary = { inserted: number; updated: number; deleted: number };

function isPlainDoc(row: DataRow): row is DataRow & { id?: unknown } {
  return typeof row === "object" && row !== null;
}

/**
 * Reconciles a local table's current rows back into a Drive collection.
 * gdrive-db has no diffing of its own, so this compares against the last
 * known snapshot (by id) and issues the minimal insert/update/delete calls —
 * this is what makes SQL/table edits on a Drive-linked table "round-trip".
 */
export async function syncRowsToCollection(
  collection: Collection<DocumentData>,
  currentRows: DataRow[],
  previousDocs: StoredDocument[],
): Promise<{ summary: SyncSummary; docs: StoredDocument[] }> {
  const previousById = new Map(previousDocs.map((doc) => [doc.id, doc]));
  const seenIds = new Set<string>();
  const summary: SyncSummary = { inserted: 0, updated: 0, deleted: 0 };

  for (const row of currentRows) {
    if (!isPlainDoc(row)) continue;
    const { id, ...fields } = row as DataRow & { id?: unknown };
    if (typeof id === "string" && previousById.has(id)) {
      seenIds.add(id);
      const before = previousById.get(id)!;
      const changed = Object.keys(fields).some(
        (key) => (before as DataRow)[key] !== fields[key],
      );
      if (changed) {
        await collection.update(id, fields);
        summary.updated += 1;
      }
    } else {
      await collection.insert(fields);
      summary.inserted += 1;
    }
  }

  for (const doc of previousDocs) {
    if (!seenIds.has(doc.id)) {
      await collection.delete(doc.id);
      summary.deleted += 1;
    }
  }

  return { summary, docs: await collection.all() };
}

/** Seeds a new Drive collection from a local table's current rows (id column, if any, is dropped — Drive assigns fresh ids). */
export async function pushRowsAsCollection(
  collection: Collection<DocumentData>,
  rows: DataRow[],
): Promise<StoredDocument[]> {
  const payload = rows.map((row) => {
    const fields = { ...(row as DataRow & { id?: unknown }) };
    delete fields.id;
    return fields;
  });
  if (payload.length > 0) await collection.insertMany(payload);
  return collection.all();
}
