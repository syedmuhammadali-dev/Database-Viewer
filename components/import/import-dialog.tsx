"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileUp,
  Loader2,
  RotateCcw,
  StopCircle,
  X,
} from "lucide-react";
import Dropzone from "./dropzone";
import type { ParsedDataset } from "@/lib/types";
import {
  detectFileKind,
  humanFileSize,
  validateImportFile,
  getMaxFileSizeBytes,
} from "@/lib/importers/validate";
import { importContent } from "@/lib/importers";
import { readFileWithProgress, isAbortError } from "@/lib/importers/read-file";
import { toUserMessage } from "@/lib/errors";

type FileItem = {
  id: string;
  file: File;
  kind: ReturnType<typeof detectFileKind>;
  status: "pending" | "reading" | "parsing" | "done" | "error";
  progress: number;
  error: string | null;
  result: ParsedDataset | null;
};

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (dataset: ParsedDataset) => void;
};

function newItem(file: File): FileItem {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    kind: detectFileKind(file),
    status: "pending",
    progress: 0,
    error: null,
    result: null,
  };
}

export default function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: ImportDialogProps) {
  const [items, setItems] = useState<FileItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const setItem = useCallback(
    (id: string, patch: Partial<FileItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const processItem = useCallback(
    async (item: FileItem, signal: AbortSignal) => {
      try {
        validateImportFile(item.file, item.kind);
      } catch (error) {
        setItem(item.id, {
          status: "error",
          error: toUserMessage(error),
        });
        return;
      }

      try {
        setItem(item.id, { status: "reading", progress: 0, error: null });
        const content = await readFileWithProgress(
          item.file,
          (pct) => setItem(item.id, { progress: pct }),
          (status) => setItem(item.id, { status }),
          signal,
        );
        const dataset = await importContent(item.kind, item.file.name, content);
        setItem(item.id, { status: "done", progress: 100, result: dataset });
        onImported(dataset);
      } catch (error) {
        if (isAbortError(error)) {
          setItems((prev) => prev.filter((p) => p.id !== item.id));
          return;
        }
        setItem(item.id, { status: "error", error: toUserMessage(error) });
      }
    },
    [onImported, setItem],
  );

  const onFiles = useCallback(
    (files: File[]) => {
      if (items.length > 0 || abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const next = files.map(newItem);
      setItems(next);
      void processBatch(next, controller.signal, processItem);
    },
    [items.length, processItem],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setItems([]);
  }, []);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [onOpenChange, reset]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const cancelAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setItems([]);
  }, []);

  const isBusy = items.some(
    (item) => item.status === "pending" || item.status === "reading" || item.status === "parsing",
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import dataset"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        open ? "" : "pointer-events-none invisible"
      }`}
    >
      <button
        type="button"
        aria-label="Close import dialog"
        onClick={close}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            Import dataset
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="space-y-4">
              <Dropzone onFiles={onFiles} />
              <p className="text-center text-xs text-zinc-500">
                Maximum file size: {humanFileSize(getMaxFileSizeBytes())}. CSV,
                Excel and JSON files are supported.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileUp className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {humanFileSize(item.file.size)}
                        {item.result
                          ? ` · ${item.result.rows.length.toLocaleString()} rows`
                          : ""}
                      </p>
                    </div>
                    {item.status === "done" ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    ) : item.status === "error" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                    ) : (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin text-blue-400"
                        aria-hidden
                      />
                    )}
                  </div>

                  {item.status === "reading" ||
                  item.status === "parsing" ? (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.status === "reading"
                          ? "Reading file..."
                          : "Parsing..."}
                      </p>
                    </div>
                  ) : null}

                  {item.status === "error" ? (
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <p className="text-xs leading-5 text-amber-300">
                        {item.error}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setItem(item.id, {
                            status: "pending",
                            error: null,
                            progress: 0,
                          });
                          if (!abortRef.current) {
                            const controller = new AbortController();
                            abortRef.current = controller;
                            void processItem(
                              { ...item, status: "pending", error: null },
                              controller.signal,
                            );
                          }
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden />
                        Retry
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
          {items.some((i) => i.status === "error") ? (
            <p className="text-xs text-zinc-500">
              Some files failed. Fix and retry them individually.
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              {items.filter((i) => i.status === "done").length} of{" "}
              {items.length} imported
            </p>
          )}
          <div className="flex items-center gap-2">
            {items.length > 0 && isBusy ? (
              <button
                type="button"
                onClick={cancelAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                <StopCircle className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-400"
            >
              {items.length > 0 ? "Done" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function processBatch(
  items: FileItem[],
  signal: AbortSignal,
  processItem: (item: FileItem, signal: AbortSignal) => Promise<void>,
): Promise<void> {
  for (const item of items) {
    if (signal.aborted) return;
    await processItem(item, signal);
  }
}