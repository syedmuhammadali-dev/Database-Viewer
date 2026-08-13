import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(
  root,
  "node_modules",
  "@duckdb",
  "duckdb-wasm",
  "dist",
);
const targetDir = join(root, "public", "duckdb");

const files = ["duckdb-mvp.wasm", "duckdb-browser-mvp.worker.js"];

await mkdir(targetDir, { recursive: true });
for (const file of files) {
  await copyFile(join(sourceDir, file), join(targetDir, file));
}
console.log(`Copied ${files.join(", ")} into public/duckdb/`);