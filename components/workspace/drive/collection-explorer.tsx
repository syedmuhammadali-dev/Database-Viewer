"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { Collection, DocumentData, StoredDocument } from "@/lib/gdrive/client";
import { toUserMessage } from "@/lib/errors";

type CollectionExplorerProps = {
  name: string;
  collection: Collection<DocumentData>;
  onClose: () => void;
};

/**
 * A document-oriented (Mongo-style) view of a Drive collection: raw JSON
 * documents with insert/edit/delete, calling the gdrive-db Collection API
 * directly instead of going through SQL/DuckDB.
 */
export default function CollectionExplorer({ name, collection, onClose }: CollectionExplorerProps) {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("{\n  \n}");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocs(await collection.all());
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [collection]);

  useEffect(() => {
    let cancelled = false;
    collection
      .all()
      .then((result) => {
        if (!cancelled) setDocs(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(toUserMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collection]);

  const handleInsert = useCallback(async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError("Insert document must be valid JSON.");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError("Insert document must be a JSON object.");
      return;
    }
    setError(null);
    try {
      await collection.insert(parsed as DocumentData);
      setDraft("{\n  \n}");
      await load();
    } catch (cause) {
      setError(toUserMessage(cause));
    }
  }, [collection, draft, load]);

  const handleDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        await collection.delete(id);
        await load();
      } catch (cause) {
        setError(toUserMessage(cause));
      } finally {
        setBusyId(null);
      }
    },
    [collection, load],
  );

  const startEdit = useCallback((doc: StoredDocument) => {
    const fields: Record<string, unknown> = { ...doc };
    delete fields.id;
    setEditingId(doc.id);
    setEditDraft(JSON.stringify(fields, null, 2));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(editDraft);
    } catch {
      setError("Edited document must be valid JSON.");
      return;
    }
    setBusyId(editingId);
    setError(null);
    try {
      await collection.update(editingId, parsed as DocumentData);
      setEditingId(null);
      await load();
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusyId(null);
    }
  }, [collection, editDraft, editingId, load]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{name}</h2>
            <p className="text-xs text-zinc-500">
              Document view · db.{name}.find() style CRUD, straight to Drive
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              title="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {error ? (
          <p className="border-b border-zinc-800 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
            {error}
          </p>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading documents…
            </div>
          ) : docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-600">No documents yet.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5"
                >
                  {editingId === doc.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        rows={6}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-xs text-zinc-200 outline-none focus:border-blue-500"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-md px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busyId === doc.id}
                          onClick={() => void handleSaveEdit()}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-400 disabled:opacity-50"
                        >
                          {busyId === doc.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : null}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(doc)}
                        className="min-w-0 flex-1 overflow-x-auto text-left font-mono text-xs leading-5 text-zinc-300"
                        title="Click to edit"
                      >
                        <pre className="whitespace-pre-wrap wrap-break-word">
                          {JSON.stringify(doc, null, 2)}
                        </pre>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === doc.id}
                        onClick={() => void handleDelete(doc.id)}
                        className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                        title="Delete document"
                      >
                        {busyId === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-zinc-800 p-3">
          <label className="text-xs font-medium text-zinc-500">Insert document (JSON)</label>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 font-mono text-xs text-zinc-200 outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => void handleInsert()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Insert
          </button>
          <p className="mt-2 text-[11px] leading-4 text-zinc-600">
            gdrive-db limits: equality-only filters (no $gt/$lt/$in), whole
            collection loads on every call, and no transactions — concurrent
            edits from two tabs can overwrite each other.
          </p>
        </div>
      </div>
    </div>
  );
}
