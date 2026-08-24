import type { DataRow, ParsedDataset, TableInfo } from "@/lib/types";
import { DatabaseError, QueryError } from "@/lib/errors";
import type {
  Database,
  DatabaseBundleUrls,
  QueryResult,
  SqlType,
} from "./types";
import { ROW_ID_COLUMN } from "./types";
import {
  coerceValue,
  inferTypes,
  quoteIdentifier,
  sanitizeTableName,
} from "./sql";

type AsyncDuckDB = import("@duckdb/duckdb-wasm").AsyncDuckDB;
type AsyncConnection = import("@duckdb/duckdb-wasm").AsyncDuckDBConnection;
type ArrowTable = import("apache-arrow").Table;

interface ArrowRow {
  toJSON(): Record<string, unknown>;
  [key: string]: unknown;
}

export async function createTemporaryDatabase(
  bundle: DatabaseBundleUrls,
): Promise<Database> {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const logger = new duckdb.VoidLogger();

  let worker: Worker | undefined;
  if (bundle.mainWorker) {
    worker = await duckdb.createWorker(bundle.mainWorker);
  }

  const instance = new duckdb.AsyncDuckDB(logger, worker);
  await instance.instantiate(bundle.mainModule, bundle.pthreadWorker);
  await instance.open({
    path: ":memory:",
    query: {
      castBigIntToDouble: true,
      castTimestampToDate: true,
      castDurationToTime64: true,
    },
  });

  return new DuckDatabase(instance);
}

function toRows(table: ArrowTable): QueryResult {
  const columns = table.schema.fields.map((field) => field.name);
  const raw = table.toArray() as unknown as ArrowRow[];
  const rows: DataRow[] = raw.map((row) => {
    const json = row.toJSON();
    const flat: DataRow = {};
    for (const column of columns) {
      flat[column] = json[column] === undefined ? null : json[column];
    }
    return flat;
  });
  return { columns, rows, rowCount: rows.length };
}

class DuckDatabase implements Database {
  private readonly instance: AsyncDuckDB;
  private connection: AsyncConnection | null = null;

  constructor(instance: AsyncDuckDB) {
    this.instance = instance;
  }

  private async conn(): Promise<AsyncConnection> {
    if (!this.connection) {
      this.connection = await this.instance.connect();
    }
    return this.connection;
  }

  private async run(sql: string): Promise<QueryResult> {
    try {
      const table = (await (await this.conn()).query(sql)) as ArrowTable;
      return toRows(table);
    } catch (error) {
      throw new QueryError(
        `Query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async count(name: string): Promise<number> {
    const result = await this.run(
      `SELECT count(*) AS n FROM ${quoteIdentifier(name)}`,
    );
    const n = result.rows[0]?.n;
    return typeof n === "number" ? n : 0;
  }

  async init(): Promise<void> {
    await this.conn();
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.run(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name",
    );
    const names = result.rows.map((row) => String(row.table_name));
    const tables: TableInfo[] = [];
    for (const name of names) {
      const info = await this.getTable(name);
      if (info) tables.push(info);
    }
    return tables;
  }

  async getTable(name: string): Promise<TableInfo | null> {
    const columnsResult = await this.run(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'main' AND table_name = '${name.replaceAll("'", "''")}' ORDER BY ordinal_position`,
    );
    if (columnsResult.rows.length === 0) return null;
    const rowCount = await this.count(name);
    return {
      name,
      columns: columnsResult.rows.map((row) => String(row.column_name)),
      rowCount,
    };
  }

  async createTableFromDataset(parsed: ParsedDataset): Promise<TableInfo> {
    const columns = parsed.columns;
    if (columns.length === 0) {
      throw new DatabaseError("Dataset has no columns to create a table from.");
    }
    const tableName = sanitizeTableName(parsed.name);
    const types = inferTypes(parsed.rows, columns);
    const quotedColumns = columns.map((column) => {
      const sqlType: SqlType = types[column] ?? "VARCHAR";
      return `${quoteIdentifier(column)} ${sqlType}`;
    });

    const conn = await this.conn();
    try {
      await this.run(
        `CREATE TABLE ${quoteIdentifier(tableName)} (${quotedColumns.join(", ")})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(
        `Could not create table "${tableName}": ${message}`,
      );
    }

    if (parsed.rows.length > 0) {
      const placeholders = columns.map(() => "?").join(", ");
      const stmt = await conn
        .prepare(
          `INSERT INTO ${quoteIdentifier(tableName)} VALUES (${placeholders})`,
        )
        .catch((error: unknown) => {
          throw new DatabaseError(
            `Could not prepare insert for "${tableName}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      try {
        await this.run("BEGIN TRANSACTION");
        for (const row of parsed.rows) {
          const params = columns.map((column) =>
            coerceValue(row[column], types[column] ?? "VARCHAR"),
          );
          await stmt.query(...params);
        }
        await this.run("COMMIT");
      } catch (error) {
        await this.run("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await stmt.close().catch(() => undefined);
      }
    }

    return (await this.getTable(tableName))!;
  }

  async dropTable(name: string): Promise<void> {
    await this.run(`DROP TABLE IF EXISTS ${quoteIdentifier(name)}`);
  }

  async renameTable(name: string, newName: string): Promise<void> {
    const target = sanitizeTableName(newName);
    const existing = await this.listTables().then((tables) =>
      tables.map((table) => table.name),
    );
    if (existing.includes(target)) {
      throw new DatabaseError(`A table named "${target}" already exists.`);
    }
    await this.run(
      `ALTER TABLE ${quoteIdentifier(name)} RENAME TO ${quoteIdentifier(target)}`,
    );
  }

  async selectAll(
    name: string,
    options: { limit?: number; offset?: number; includeRowId?: boolean } = {},
  ): Promise<QueryResult> {
    const select = options.includeRowId
      ? `rowid AS ${quoteIdentifier(ROW_ID_COLUMN)}, *`
      : "*";
    let sql = `SELECT ${select} FROM ${quoteIdentifier(name)}`;
    const clauses: string[] = [];
    if (options.limit !== undefined && options.limit > 0) {
      clauses.push(`LIMIT ${Math.floor(options.limit)}`);
    }
    if (options.offset !== undefined && options.offset > 0) {
      clauses.push(`OFFSET ${Math.floor(options.offset)}`);
    }
    if (clauses.length > 0) sql = `${sql} ${clauses.join(" ")}`;
    return this.run(sql);
  }

  async query(sql: string): Promise<QueryResult> {
    return this.run(sql);
  }

  private async columnTypes(name: string): Promise<Record<string, SqlType>> {
    const result = await this.run(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'main' AND table_name = '${name.replaceAll("'", "''")}' ORDER BY ordinal_position`,
    );
    const known: SqlType[] = ["INTEGER", "DOUBLE", "BOOLEAN", "VARCHAR"];
    const types: Record<string, SqlType> = {};
    for (const row of result.rows) {
      const dataType = String(row.data_type);
      const column = String(row.column_name);
      types[column] = (known as string[]).includes(dataType)
        ? (dataType as SqlType)
        : "VARCHAR";
    }
    return types;
  }

  async insertRow(name: string, values: DataRow): Promise<void> {
    const columns = Object.keys(values);
    if (columns.length === 0) {
      throw new DatabaseError("No columns to insert.");
    }
    const types = await this.columnTypes(name);
    const conn = await this.conn();
    const quotedColumns = columns.map(quoteIdentifier).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const stmt = await conn
      .prepare(
        `INSERT INTO ${quoteIdentifier(name)} (${quotedColumns}) VALUES (${placeholders})`,
      )
      .catch((error: unknown) => {
        throw new DatabaseError(
          `Could not prepare insert for "${name}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    try {
      const params = columns.map((column) =>
        coerceValue(values[column], types[column] ?? "VARCHAR"),
      );
      await stmt.query(...params);
    } catch (error) {
      throw new DatabaseError(
        `Could not insert row into "${name}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      await stmt.close().catch(() => undefined);
    }
  }

  async updateRow(name: string, rowid: number, values: DataRow): Promise<void> {
    const columns = Object.keys(values);
    if (columns.length === 0) return;
    const types = await this.columnTypes(name);
    const conn = await this.conn();
    const setClause = columns
      .map((column) => `${quoteIdentifier(column)} = ?`)
      .join(", ");
    const stmt = await conn
      .prepare(`UPDATE ${quoteIdentifier(name)} SET ${setClause} WHERE rowid = ?`)
      .catch((error: unknown) => {
        throw new DatabaseError(
          `Could not prepare update for "${name}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    try {
      const params = [
        ...columns.map((column) => coerceValue(values[column], types[column] ?? "VARCHAR")),
        rowid,
      ];
      await stmt.query(...params);
    } catch (error) {
      throw new DatabaseError(
        `Could not update row in "${name}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      await stmt.close().catch(() => undefined);
    }
  }

  async deleteRow(name: string, rowid: number): Promise<void> {
    if (!Number.isFinite(rowid)) {
      throw new DatabaseError("Invalid row reference.");
    }
    await this.run(
      `DELETE FROM ${quoteIdentifier(name)} WHERE rowid = ${Math.trunc(rowid)}`,
    );
  }

  async dispose(): Promise<void> {
    if (this.connection) {
      await this.connection.close().catch(() => undefined);
      this.connection = null;
    }
    await this.instance.terminate().catch(() => undefined);
  }
}