import type { Database, DatabaseBundleUrls } from "./types";
import { createTemporaryDatabase } from "./duckdb";

const BROWSER_BUNDLE: DatabaseBundleUrls = {
  mainModule: "/duckdb/duckdb-mvp.wasm",
  mainWorker: "/duckdb/duckdb-browser-mvp.worker.js",
  pthreadWorker: null,
};

export function instantiateBrowserDatabase(): Promise<Database> {
  return createTemporaryDatabase(BROWSER_BUNDLE);
}