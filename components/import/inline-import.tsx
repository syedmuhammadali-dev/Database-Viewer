"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import Dropzone from "./dropzone";
import GoogleDriveLink from "./drive-link";
import {
  importFileInto,
  type BinaryImportKind,
  type ImportFileOutcome,
} from "@/lib/importers";
import type { ParsedDataset } from "@/lib/types";
import { toUserMessage } from "@/lib/errors";
import { isAbortError } from "@/lib/importers/read-file";

type InlineImportProps = {
  onImported: (dataset: ParsedDataset) => void | Promise<void>;
  onBinaryFile?: (
    file: File,
    kind: BinaryImportKind,
    buffer: ArrayBuffer,
  ) => Promise<ImportFileOutcome[]>;
  disabled?: boolean;
};

type InlineItem = {
  id: string;
  name: string;
  status: "pending" | "importing" | "done" | "error";
  detail: string | null;
};

export default function InlineImport({
  onImported,
  onBinaryFile,
  disabled,
}: InlineImportProps) {
  const [items, setItems] = useState<InlineItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (running || disabled) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      const next: InlineItem[] = files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        status: "pending",
        detail: null,
      }));
      setItems((prev) => [...prev, ...next]);
      try {
        for (let i = 0; i < files.length; i += 1) {
          if (controller.signal.aborted) return;
          const id = next[i].id;
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status: "importing", detail: null } : item,
            ),
          );
          try {
            const outcomes = await importFileInto(
              files[i],
              onImported,
              controller.signal,
              undefined,
              onBinaryFile,
            );
            const detail = outcomes
              .map((outcome) => outcomeName(outcome))
              .join(", ");
            setItems((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, status: "done", detail }
                  : item,
              ),
            );
          } catch (error) {
            if (isAbortError(error)) return;
            setItems((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, status: "error", detail: toUserMessage(error) }
                  : item,
              ),
            );
          }
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [running, disabled, onImported, onBinaryFile],
  );

  const handleDriveFile = useCallback(
    (file: File) => {
      void handleFiles([file]);
    },
    [handleFiles],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const controlsDisabled = disabled || running;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-xl">
        <h2 className="text-base font-medium text-zinc-200">
          Import your data
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          Upload files or a folder, or paste a Google Drive link. CSV, Excel,
          JSON and Parquet are all detected automatically. Data is processed
          in your browser and becomes a table in your temporary database.
        </p>

        <div className="mt-5 space-y-4">
          <section aria-label="Import from Google Drive link">
            <GoogleDriveLink onFile={handleDriveFile} disabled={controlsDisabled} />
          </section>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-600">
            <span className="h-px flex-1 bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-800" />
          </div>

          <section aria-label="Upload files">
            <Dropzone onFiles={(files) => void handleFiles(files)} disabled={controlsDisabled} />
          </section>
        </div>

        {items.length > 0 ? (
          <ul className="mt-6 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5"
              >
                {item.status === "done" ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                ) : item.status === "error" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                ) : (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-400" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">{item.name}</p>
                  <p
                    className={`truncate text-xs leading-5 ${
                      item.status === "error"
                        ? "text-amber-300"
                        : "text-zinc-500"
                    }`}
                  >
                    {item.status === "error"
                      ? item.detail
                      : item.status === "done"
                        ? `Imported as ${item.detail}`
                        : item.status === "importing"
                          ? "Importing…"
                          : "Queued"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function outcomeName(outcome: ImportFileOutcome): string {
  return `${outcome.name} (${outcome.rows.toLocaleString()} rows)`;
}