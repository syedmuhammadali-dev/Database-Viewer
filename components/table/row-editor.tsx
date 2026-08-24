"use client";

import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import type { DataRow } from "@/lib/types";

type RowEditorProps = {
  title: string;
  columns: string[];
  initialValues?: DataRow;
  saving?: boolean;
  error?: string | null;
  onSave: (values: DataRow) => void | Promise<void>;
  onClose: () => void;
};

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function RowEditor({
  title,
  columns,
  initialValues,
  saving,
  error,
  onSave,
  onClose,
}: RowEditorProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const column of columns) out[column] = toInputValue(initialValues?.[column]);
    return out;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {error ? (
          <p className="border-b border-zinc-800 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
            {error}
          </p>
        ) : null}

        <form
          className="flex-1 overflow-y-auto px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(values);
          }}
        >
          <div className="space-y-2.5">
            {columns.map((column) => (
              <label key={column} className="block">
                <span className="text-xs font-medium text-zinc-500">{column}</span>
                <input
                  value={values[column] ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [column]: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden />
              )}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
