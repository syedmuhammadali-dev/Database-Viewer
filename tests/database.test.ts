import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createTemporaryDatabase } from "@/lib/database";
import type { Database } from "@/lib/database";
import type { ParsedDataset } from "@/lib/types";

const NODE_WORKER = resolve(
  "node_modules/@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs",
);
const NODE_WASM = resolve(
  "node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm",
);

function patchNodeDuckDbGlobals() {
  const workerUrl = pathToFileURL(NODE_WORKER).href;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("file:")) {
      return new Response(await readFile(fileURLToPath(url)));
    }
    return originalFetch(input);
  }) as typeof fetch;
  URL.createObjectURL = () => workerUrl;
}

function nodeBundle() {
  return {
    mainModule: NODE_WASM,
    mainWorker: pathToFileURL(NODE_WORKER).href,
    pthreadWorker: null,
  };
}

const people: ParsedDataset = {
  name: "people.csv",
  columns: ["id", "name", "age", "active", "note"],
  rows: [
    { id: 1, name: "Ada", age: 36, active: true, note: "pioneer" },
    { id: 2, name: "Grace", age: 42, active: false, note: null },
    { id: 3, name: "Alan", age: 41, active: true, note: "enigma" },
  ],
};

describe("temporary duckdb database", () => {
  let db: Database;

  beforeAll(async () => {
    patchNodeDuckDbGlobals();
    db = await createTemporaryDatabase(nodeBundle());
    await db.init();
  }, 30000);

  afterAll(async () => {
    await db.dispose();
  });

  it("creates an empty database", async () => {
    const tables = await db.listTables();
    expect(tables).toHaveLength(0);
  });

  it("creates a table from a parsed dataset", async () => {
    const info = await db.createTableFromDataset(people);
    expect(info.name).toBe("people");
    expect(info.rowCount).toBe(3);
    expect(info.columns).toEqual(["id", "name", "age", "active", "note"]);
  });

  it("lists tables with row counts", async () => {
    const tables = await db.listTables();
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("people");
    expect(tables[0].rowCount).toBe(3);
  });

  it("selects all rows with typed values", async () => {
    const result = await db.selectAll("people");
    expect(result.columns).toEqual(["id", "name", "age", "active", "note"]);
    expect(result.rowCount).toBe(3);
    expect(result.rows[0].name).toBe("Ada");
    expect(result.rows[0].age).toBe(36);
    expect(result.rows[0].active).toBe(true);
    expect(result.rows[2].note).toBe("enigma");
  });

  it("supports paging via selectAll options", async () => {
    const page = await db.selectAll("people", { limit: 2, offset: 1 });
    expect(page.rows.map((row) => row.name)).toEqual(["Grace", "Alan"]);
  });

  it("runs arbitrary SQL queries", async () => {
    const result = await db.query(
      "SELECT name, age FROM people WHERE age > 40 ORDER BY age DESC",
    );
    expect(result.rows.map((row) => row.name)).toEqual(["Grace", "Alan"]);
    expect(Number(result.rows[0].age)).toBe(42);
  });

  it("preserves leading zeros as strings", async () => {
    const dataset: ParsedDataset = {
      name: "codes",
      columns: ["code"],
      rows: [{ code: "001" }, { code: "042" }, { code: "7" }],
    };
    await db.createTableFromDataset(dataset);
    const result = await db.query("SELECT code FROM codes ORDER BY code");
    expect(result.rows.map((row) => row.code)).toEqual(["001", "042", "7"]);
  });

  it("renames a table", async () => {
    await db.renameTable("codes", "postal");
    const tables = await db.listTables();
    expect(tables.map((table) => table.name)).toContain("postal");
    await db.renameTable("postal", "codes");
  });

  it("rejects renaming onto an existing table", async () => {
    await expect(db.renameTable("people", "codes")).rejects.toThrow();
  });

  it("drops a table", async () => {
    await db.dropTable("codes");
    const tables = await db.listTables();
    expect(tables.map((table) => table.name)).not.toContain("codes");
  });

  it("returns null for an unknown table", async () => {
    expect(await db.getTable("nope")).toBeNull();
  });

  it("inserts, updates and deletes rows by rowid", async () => {
    const withRowIds = await db.selectAll("people", { includeRowId: true });
    expect(withRowIds.columns[0]).toBe("__rowid__");
    const ada = withRowIds.rows.find((row) => row.name === "Ada")!;
    const adaRowId = Number(ada.__rowid__);

    await db.updateRow("people", adaRowId, { age: 37 });
    const afterUpdate = await db.selectAll("people");
    expect(afterUpdate.rows.find((row) => row.name === "Ada")?.age).toBe(37);

    await db.insertRow("people", {
      id: 4,
      name: "Rear",
      age: 30,
      active: true,
      note: "admiral",
    });
    const afterInsert = await db.selectAll("people");
    expect(afterInsert.rowCount).toBe(4);
    expect(afterInsert.rows.map((row) => row.name)).toContain("Rear");

    const withRowIdsAfterInsert = await db.selectAll("people", { includeRowId: true });
    const rear = withRowIdsAfterInsert.rows.find((row) => row.name === "Rear")!;
    await db.deleteRow("people", Number(rear.__rowid__));
    const afterDelete = await db.selectAll("people");
    expect(afterDelete.rowCount).toBe(3);
    expect(afterDelete.rows.map((row) => row.name)).not.toContain("Rear");
  });

  it("imports a Parquet file directly", async () => {
    const duckdb = await import("@duckdb/duckdb-wasm");
    const logger = new duckdb.VoidLogger();
    const worker = await duckdb.createWorker(pathToFileURL(NODE_WORKER).href);
    const fixture = new duckdb.AsyncDuckDB(logger, worker);
    await fixture.instantiate(NODE_WASM, null);
    let bytes: Uint8Array;
    try {
      const conn = await fixture.connect();
      await conn.query(
        "CREATE TABLE cities AS SELECT * FROM (VALUES ('Lahore', 11), ('Karachi', 16)) AS t(name, pop_millions)",
      );
      await conn.query("COPY cities TO 'export.parquet' (FORMAT PARQUET)");
      await conn.close();
      bytes = await fixture.copyFileToBuffer("export.parquet");
    } finally {
      await fixture.terminate();
    }

    const info = await db.importParquetBuffer("cities", bytes.buffer as ArrayBuffer);
    expect(info.name).toBe("cities");
    expect(info.rowCount).toBe(2);
    const result = await db.selectAll("cities");
    expect(result.rows.map((row) => row.name).sort()).toEqual(["Karachi", "Lahore"]);
  }, 30000);

}, 60000);
