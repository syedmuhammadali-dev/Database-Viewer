"use client";

import { useState } from "react";
import {
  Cloud,
  CloudOff,
  Database as DatabaseIcon,
  Loader2,
  LogOut,
  RefreshCw,
  Table as TableIcon,
} from "lucide-react";
import type { useDriveDatabase } from "@/hooks/use-drive-database";

type DriveDatabase = ReturnType<typeof useDriveDatabase>;

type DrivePanelProps = {
  drive: DriveDatabase;
  linkedCollections: Set<string>;
  busyCollection: string | null;
  onImportCollection: (name: string) => void | Promise<void>;
  onOpenExplorer: (name: string) => void;
};

export default function DrivePanel({
  drive,
  linkedCollections,
  busyCollection,
  onImportCollection,
  onOpenExplorer,
}: DrivePanelProps) {
  const [dbNameInput, setDbNameInput] = useState("workspace");
  const [connectError, setConnectError] = useState<string | null>(null);

  if (!drive.configured) {
    return (
      <div className="border-t border-zinc-800 px-3 py-3 text-xs leading-5 text-zinc-500">
        <p className="flex items-center gap-1.5 text-zinc-400">
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
          Drive sync not configured
        </p>
        <p className="mt-1">
          Set <code className="text-zinc-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>{" "}
          to treat a Drive folder as a live database via{" "}
          <a
            href="https://www.npmjs.com/package/gdrive-db"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:underline"
          >
            gdrive-db
          </a>
          . See README.
        </p>
      </div>
    );
  }

  if (!drive.databaseName) {
    return (
      <div className="border-t border-zinc-800 px-3 py-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <Cloud className="h-3.5 w-3.5" aria-hidden />
          Drive database
        </p>
        <form
          className="mt-2 flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            setConnectError(null);
            drive.connect(dbNameInput.trim() || "workspace").catch((cause) => {
              setConnectError(cause instanceof Error ? cause.message : String(cause));
            });
          }}
        >
          <input
            value={dbNameInput}
            onChange={(event) => setDbNameInput(event.target.value)}
            placeholder="Database name"
            aria-label="Drive database name"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={drive.connecting}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-500 text-xs font-medium text-white transition-colors hover:bg-blue-400 disabled:opacity-50"
          >
            {drive.connecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <DatabaseIcon className="h-3.5 w-3.5" aria-hidden />
            )}
            {drive.signedIn ? "Connect" : "Sign in with Google"}
          </button>
        </form>
        {(connectError ?? drive.error) ? (
          <p className="mt-1.5 text-[11px] leading-4 text-amber-300">
            {connectError ?? drive.error}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] leading-4 text-zinc-600">
            Stored under <code>DataLens/{dbNameInput || "workspace"}</code> in
            your Drive.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-800 px-3 py-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <Cloud className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          {drive.databaseName}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Refresh collections"
            onClick={() => void drive.refreshCollections()}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            title="Sign out of Google Drive"
            onClick={drive.signOut}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {drive.collections.length === 0 ? (
        <p className="mt-2 text-[11px] leading-4 text-zinc-600">
          No collections yet. Push a local table to Drive to create one.
        </p>
      ) : (
        <ul className="mt-2 space-y-px">
          {drive.collections.map((name) => {
            const linked = linkedCollections.has(name);
            const busy = busyCollection === name;
            return (
              <li key={name} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenExplorer(name)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  title="Open as documents (Mongo-style)"
                >
                  <TableIcon className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
                  <span className="truncate">{name}</span>
                </button>
                {!linked ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onImportCollection(name)}
                    className="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-blue-400 hover:bg-zinc-800 disabled:opacity-50"
                    title="Import as a table"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : "Import"}
                  </button>
                ) : (
                  <span className="shrink-0 px-1.5 text-[10px] text-emerald-400">linked</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {drive.error ? (
        <p className="mt-1.5 text-[11px] leading-4 text-amber-300">{drive.error}</p>
      ) : (
        <p className="mt-2 text-[11px] leading-4 text-zinc-600">
          Edits sync on the cloud icon next to a linked table, or
          automatically after a single-statement SQL INSERT/UPDATE/DELETE.
        </p>
      )}
    </div>
  );
}
