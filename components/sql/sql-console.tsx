"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Play, TriangleAlert, Zap } from "lucide-react";
import type { QueryResult } from "@/lib/database";
import { toUserMessage } from "@/lib/errors";
import { highlightSql } from "@/lib/sql/highlight";
import DataTable from "@/components/table/data-table";

type SqlConsoleProps = {
  runQuery: (sql: string) => Promise<QueryResult>;
  disabled?: boolean;
};

const DEFAULT_QUERY = `-- A temporary in-browser DuckDB session.
-- Query any imported table:
SELECT
  *
FROM
  "table_name"
LIMIT
  100;`;

export default function SqlConsole({ runQuery, disabled }: SqlConsoleProps) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const pre = preRef.current;
    if (textarea && pre) {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    }
  }, []);

  const run = useCallback(async () => {
    if (running || disabled) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setElapsedMs(null);
    const started = performance.now();
    try {
      const res = await runQuery(query);
      setElapsedMs(performance.now() - started);
      setResult(res);
    } catch (cause) {
      setElapsedMs(performance.now() - started);
      setError(toUserMessage(cause));
    } finally {
      setRunning(false);
    }
  }, [running, disabled, runQuery, query]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void run();
        return;
      }
      if (event.key === "Tab" && textarea) {
        event.preventDefault();
        const { selectionStart, selectionEnd } = textarea;
        const next =
          query.slice(0, selectionStart) +
          "  " +
          query.slice(selectionEnd);
        setQuery(next);
        requestAnimationFrame(() => {
          textarea.selectionStart = selectionStart + 2;
          textarea.selectionEnd = selectionStart + 2;
        });
      }
    },
    [query, run],
  );

  const canRun = !disabled && !running && query.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative h-44 shrink-0 overflow-hidden border-b border-zinc-800">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="SQL query editor"
          className="absolute inset-0 resize-none overflow-auto bg-transparent p-3 font-mono text-[13px] leading-5 text-transparent caret-zinc-100 outline-none selection:bg-blue-500/30 [tab-size:2] whitespace-pre"
        />
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto p-3 font-mono text-[13px] leading-5 text-zinc-300 [tab-size:2] whitespace-pre"
          dangerouslySetInnerHTML={{ __html: `${highlightSql(query)}\n` }}
        />
      </div>

      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={!canRun}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          Run
        </button>
        <span className="text-[11px] text-zinc-600">
          Ctrl/⌘ + Enter
        </span>
        <span className="ml-auto inline-flex items-center gap-2 text-[11px]">
          {disabled ? (
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Engine initializing…
            </span>
          ) : error ? (
            <span className="inline-flex max-w-full items-center gap-1.5 text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{error}</span>
            </span>
          ) : elapsedMs !== null && result ? (
            <span className="inline-flex items-center gap-1.5 tabular-nums text-zinc-400">
              <Zap className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
              {result.rowCount.toLocaleString()} rows ·{" "}
              {result.columns.length} columns · {elapsedMs.toFixed(1)} ms
            </span>
          ) : (
            <span className="text-zinc-600">
              {running ? "Running query…" : "Results appear here"}
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {result && !error ? (
          <DataTable rows={result.rows} columns={result.columns} />
        ) : result === null && !running && !error && !disabled ? (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
            Write a query and press Run.
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
            {error
              ? "Fix the query and try again."
              : running
                ? "Running query…"
                : disabled
                  ? "Waiting for the in-browser engine…"
                  : ""}
          </div>
        )}
      </div>
    </div>
  );
}