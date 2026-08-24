"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RotateCcw,
  StopCircle,
  X,
} from "lucide-react";
import Dropzone from "./dropzone";
import GoogleDriveLink from "./drive-link";
import type { ParsedDataset } from "@/lib/types";
import {
  detectFileKind,
  decodeUtf8,
  humanFileSize,
  validateImportFile,
  getMaxFileSizeBytes,
  type FileKind,
} from "@/lib/importers/validate";
import { importContent, type BinaryImportKind, type ImportFileOutcome } from "@/lib/importers";
import {
  readFileAsArrayBuffer,
  isAbortError,
} from "@/lib/importers/read-file";
import {
  inspectWorkbook,
  parseSheet,
  type SheetSummary,
  type WorkbookInspect,
} from "@/lib/parsers/excel";
import { toUserMessage } from "@/lib/errors";

type FileItem = {
  id: string;
  file: File;
  kind: FileKind;
  status: "pending" | "reading" | "parsing" | "done" | "error";
  progress: number;
  error: string | null;
  result: ParsedDataset | null;
  outcomeLabel: string | null;
};

type ExcelItem = {
  id: string;
  file: File;
  buffer: ArrayBuffer;
  inspection: WorkbookInspect;
  selected: string[];
};

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (dataset: ParsedDataset) => void | Promise<void>;
  onBinaryFile?: (
    file: File,
    kind: BinaryImportKind,
    buffer: ArrayBuffer,
  ) => Promise<ImportFileOutcome[]>;
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
    outcomeLabel: null,
  };
}

export default function ImportDialog({
  open,
  onOpenChange,
  onImported,
  onBinaryFile,
}: ImportDialogProps) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [excelItems, setExcelItems] = useState<ExcelItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

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
        validateImportFile(item.file);
      } catch (error) {
        setItem(item.id, { status: "error", error: toUserMessage(error) });
        return;
      }

      try {
        setItem(item.id, { status: "reading", progress: 0, error: null });

        const buffer = await readFileAsArrayBuffer(
          item.file,
          (pct) => setItem(item.id, { progress: pct }),
          signal,
        );
        const bytes = new Uint8Array(buffer);
        const kind = detectFileKind(item.file, bytes);
        if (kind === "unknown") {
          setItem(item.id, {
            status: "error",
            error:
              'Unsupported file type. Supported: CSV/TSV, Excel (.xlsx/.xls), JSON and Parquet — detected automatically.',
          });
          return;
        }
        setItem(item.id, { kind, status: "parsing" });

        if (kind === "sqlite") {
          setItem(item.id, {
            status: "error",
            error:
              "SQLite import isn't supported yet (the DuckDB SQLite extension is unstable in this build) — export its tables to CSV or Parquet and import those instead.",
          });
          return;
        }

        if (kind === "parquet") {
          if (!onBinaryFile) {
            setItem(item.id, {
              status: "error",
              error: `"${item.file.name}" can't be imported here.`,
            });
            return;
          }
          const outcomes = await onBinaryFile(item.file, kind, buffer);
          setItem(item.id, {
            status: "done",
            progress: 100,
            outcomeLabel: outcomes
              .map((outcome) => `${outcome.name} (${outcome.rows.toLocaleString()} rows)`)
              .join(", "),
          });
          return;
        }

        if (kind === "excel") {
          const inspection = inspectWorkbook(buffer, item.file.name);
          setItem(item.id, {
            status: "done",
            progress: 100,
            result: null,
          });
          setExcelItems((prev) => [
            ...prev,
            {
              id: item.id,
              file: item.file,
              buffer,
              inspection,
              selected: inspection.sheets.map((s) => s.name),
            },
          ]);
          return;
        }

        const content = decodeUtf8(bytes);
        const dataset = await importContent(kind, item.file.name, content);
        await onImported(dataset);
        setItem(item.id, { status: "done", progress: 100, result: dataset });
      } catch (error) {
        if (isAbortError(error)) {
          setItems((prev) => prev.filter((p) => p.id !== item.id));
          return;
        }
        setItem(item.id, { status: "error", error: toUserMessage(error) });
      }
    },
    [onImported, onBinaryFile, setItem],
  );

  const runBatch = useCallback(
    async (next: FileItem[]) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        for (const item of next) {
          if (controller.signal.aborted) return;
          await processItem(item, controller.signal);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        busyRef.current = false;
      }
    },
    [processItem],
  );

  const onFiles = useCallback(
    (files: File[]) => {
      if (busyRef.current) return;
      const next = files.map(newItem);
      setItems((prev) => [...prev, ...next]);
      void runBatch(next);
    },
    [runBatch],
  );

  const handleDriveFile = useCallback(
    (file: File) => {
      if (busyRef.current) return;
      const next = [newItem(file)];
      setItems((prev) => [...prev, ...next]);
      void runBatch(next);
    },
    [runBatch],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setItems([]);
    setExcelItems([]);
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
    busyRef.current = false;
    setItems([]);
    setExcelItems([]);
  }, []);

  const importWorksheets = useCallback(async () => {
    for (const excel of excelItems) {
      for (const sheetName of excel.selected) {
        try {
          const dataset = parseSheet(excel.buffer, sheetName, excel.file.name);
          await onImported(dataset);
          setItem(excel.id, {
            status: "done",
            result: dataset,
          });
        } catch (error) {
          setItem(excel.id, {
            status: "error",
            error: toUserMessage(error),
          });
        }
      }
    }
    setExcelItems([]);
  }, [excelItems, onImported, setItem]);

  const isBusy = items.some(
    (item) =>
      item.status === "pending" ||
      item.status === "reading" ||
      item.status === "parsing",
  );

  const doneCount =
    items.filter((i) => i.status === "done" && (i.result || i.outcomeLabel)).length +
    excelItems.length;

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
          <GoogleDriveLink onFile={handleDriveFile} disabled={isBusy} />
          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-600">
            <span className="h-px flex-1 bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-800" />
          </div>
          {items.length === 0 && excelItems.length === 0 ? (
            <div className="space-y-4">
              <Dropzone onFiles={onFiles} />
              <p className="text-center text-xs text-zinc-500">
                Maximum file size: {humanFileSize(getMaxFileSizeBytes())}. CSV,
                Excel, JSON and Parquet files are supported.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {excelItems.length > 0 ? (
                <section aria-label="Excel worksheets">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Select worksheets
                  </h3>
                  {excelItems.map((excel) => (
                    <div
                      key={excel.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-200">
                            {excel.file.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {humanFileSize(excel.file.size)} ·{" "}
                            {excel.inspection.sheets.length} sheet
                            {excel.inspection.sheets.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {excel.inspection.sheets.map((sheet: SheetSummary) => {
                          const checked = excel.selected.includes(sheet.name);
                          return (
                            <li key={sheet.name}>
                              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-300 transition-colors hover:bg-zinc-800">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setExcelItems((prev) =>
                                      prev.map((ex) =>
                                        ex.id === excel.id
                                          ? {
                                              ...ex,
                                              selected: checked
                                                ? ex.selected.filter(
                                                    (n) => n !== sheet.name,
                                                  )
                                                : [...ex.selected, sheet.name],
                                            }
                                          : ex,
                                      ),
                                    );
                                  }}
                                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-blue-500"
                                />
                                <span className="truncate">{sheet.name}</span>
                                <span className="ml-auto text-[11px] tabular-nums text-zinc-600">
                                  {sheet.rowCount} row
                                  {sheet.rowCount === 1 ? "" : "s"}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </section>
              ) : null}

              {items.length > 0 ? (
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
                              : item.outcomeLabel
                                ? ` · ${item.outcomeLabel}`
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

                      {item.status === "reading" ? (
                        <div className="mt-2">
                          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            Reading file...
                          </p>
                        </div>
                      ) : null}

                      {item.status === "parsing" ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          Parsing...
                        </p>
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
                              const retry = {
                                ...item,
                                status: "pending" as const,
                                error: null,
                                progress: 0,
                              };
                              runBatch([retry]);
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
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
          {items.some((i) => i.status === "error") ? (
            <p className="text-xs text-zinc-500">
              Some files failed. Fix and retry them.
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              {doneCount} imported
              {excelItems.length > 0
                ? ` · ${excelItems.reduce(
                    (sum, ex) => sum + ex.selected.length,
                    0,
                  )} worksheets selected`
                : ""}
            </p>
          )}
          <div className="flex items-center gap-2">
            {isBusy ? (
              <button
                type="button"
                onClick={cancelAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                <StopCircle className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </button>
            ) : null}
            {excelItems.length > 0 ? (
              <button
                type="button"
                onClick={importWorksheets}
                className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-400"
              >
                Import {excelItems.reduce((sum, ex) => sum + ex.selected.length, 0)} worksheet
                {excelItems.reduce((sum, ex) => sum + ex.selected.length, 0) === 1 ? "" : "s"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                items.length > 0 || excelItems.length > 0
                  ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  : "bg-blue-500 text-white hover:bg-blue-400"
              }`}
            >
              {items.length > 0 || excelItems.length > 0 ? "Done" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}