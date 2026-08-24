import Link from "next/link";
import {
  Database,
  FileSpreadsheet,
  Table2,
  ShieldCheck,
  Cloud,
  Terminal,
  FolderSync,
} from "lucide-react";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,rgba(56,130,246,0.18),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
            <Database className="h-4 w-4 text-blue-400" aria-hidden />
          </span>
          <span className="text-lg">DataLens</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm text-zinc-400">
          <Link
            className="hidden rounded-md px-3 py-2 transition-colors hover:bg-zinc-800 hover:text-zinc-100 sm:block"
            href="/#privacy"
          >
            Privacy
          </Link>
          <Link
            href="/workspace"
            className="rounded-md px-3 py-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Open Workspace
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pb-24 pt-20 text-center sm:pt-28">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          Local-first temporary data explorer
        </span>

        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
          Your data. Your browser.{" "}
          <span className="text-blue-400">Your database.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          Upload CSV, Excel, JSON or Parquet files, connect Google Drive or
          Google Sheets, and explore your data with Table, JSON and SQL
          views. Sign
          in with Google and a Drive folder becomes a live database — edit it
          with SQL or a MongoDB-style API, powered by{" "}
          <a
            href="https://www.npmjs.com/package/gdrive-db"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:underline"
          >
            gdrive-db
          </a>
          .
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/workspace"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 text-sm font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <Table2 className="h-4 w-4" aria-hidden />
            Open Workspace
          </Link>
          <Link
            href="/workspace"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-6 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Continue with Google
          </Link>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Google sign-in connects Drive &amp; Sheets imports directly in your
          browser.
        </p>

        <section
          id="privacy"
          className="mt-20 w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-left"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
            Private by design
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Your imported datasets are processed locally in your browser. We do
            not store your imported files in our database.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-zinc-400 sm:grid-cols-3">
            <li>
              <span className="font-medium text-zinc-300">CSV</span> upload
            </li>
            <li>
              <span className="font-medium text-zinc-300">Excel</span> upload
            </li>
            <li>
              <span className="font-medium text-zinc-300">JSON</span> upload
            </li>
            <li>
              <span className="font-medium text-zinc-300">Parquet</span> upload
            </li>
            <li>
              <span className="font-medium text-zinc-300">Google Drive</span>{" "}
              import
            </li>
            <li>
              <span className="font-medium text-zinc-300">Google Sheets</span>{" "}
              import
            </li>
            <li>
              <span className="font-medium text-zinc-300">SQL</span> queries
            </li>
          </ul>
        </section>

        <section
          id="gdrive-db"
          className="mt-8 w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-left"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Cloud className="h-4 w-4 text-blue-400" aria-hidden />
            Your Google Drive folder, as a live database
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            DataLens uses{" "}
            <a
              href="https://www.npmjs.com/package/gdrive-db"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-400 hover:underline"
            >
              gdrive-db
            </a>{" "}
            — an open-source SDK that stores collections as JSON files inside
            a folder in your own Google Drive. Sign in with Google, point
            DataLens at a database folder, and every collection in it opens
            here like a table in pgAdmin: browse it, run SQL against it, or
            edit it MongoDB-style (<code className="text-zinc-300">find</code>
            , <code className="text-zinc-300">insert</code>,{" "}
            <code className="text-zinc-300">update</code>,{" "}
            <code className="text-zinc-300">delete</code>) — every change
            writes straight back to the files in Drive. It only ever
            requests the least-privilege <code className="text-zinc-300">drive.file</code>{" "}
            scope, so it can see just the folder it created, never your
            whole Drive.
          </p>

          <div className="mt-4 grid gap-2 text-sm text-zinc-400 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <FolderSync className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
              Drive folder ↔ database
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <Terminal className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
              Edit via SQL
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <Database className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
              Or MongoDB-style CRUD
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300">
              npm i gdrive-db
            </code>
            <a
              href="https://www.npmjs.com/package/gdrive-db"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              View on npm
            </a>
            <a
              href="https://github.com/syedmuhammadali-dev/G-Drive-DB"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              Source on GitHub
            </a>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Not a replacement for Postgres/Mongo/Firebase — great for
            prototypes, small tools, and learning. See the{" "}
            <a
              href="https://www.npmjs.com/package/gdrive-db"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              package docs
            </a>{" "}
            for limits (equality-only filters, no transactions).
          </p>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-8 text-center">
        <p className="text-xs text-zinc-600">
          DataLens keeps your workspace temporary — export your work before
          leaving the page. Google Drive sync is powered by{" "}
          <a
            href="https://www.npmjs.com/package/gdrive-db"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:underline"
          >
            gdrive-db
          </a>
          .
        </p>
      </footer>
    </div>
  );
}