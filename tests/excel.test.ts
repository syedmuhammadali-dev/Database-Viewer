import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  inspectWorkbook,
  parseSheet,
} from "@/lib/parsers/excel";
import { ParseError } from "@/lib/errors";

function workbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

describe("inspectWorkbook", () => {
  it("lists sheets and their columns", () => {
    const buffer = workbookBuffer({
      Users: [
        ["id", "name", "email"],
        [1, "Ali", "ali@example.com"],
        [2, "Ahmed", "ahmed@example.com"],
      ],
      Products: [
        ["sku", "price"],
        ["A1", 9.99],
      ],
    });

    const inspected = inspectWorkbook(buffer, "company.xlsx");

    expect(inspected.fileName).toBe("company.xlsx");
    expect(inspected.workbookName).toBe("company");
    expect(inspected.sheets.map((s) => s.name)).toEqual([
      "Users",
      "Products",
    ]);
    expect(inspected.sheets[0].columns).toEqual(["id", "name", "email"]);
    expect(inspected.sheets[0].rowCount).toBe(3);
  });

  it("reports an empty sheet", () => {
    const buffer = workbookBuffer({ Empty: [] });
    const inspected = inspectWorkbook(buffer, "empty.xlsx");
    expect(inspected.sheets[0].rowCount).toBe(0);
  });
});

describe("parseSheet", () => {
  it("parses a sheet into a normalized dataset", () => {
    const buffer = workbookBuffer({
      Users: [
        ["id", "name", "age"],
        [1, "Ali", 19],
        [2, "Ahmed", 22],
        [3, "Hamza", null],
      ],
    });

    const dataset = parseSheet(buffer, "Users", "company.xlsx");

    expect(dataset.name).toBe("Users");
    expect(dataset.columns).toEqual(["id", "name", "age"]);
    expect(dataset.rows).toHaveLength(3);
    expect(dataset.rows[0]).toEqual({ id: 1, name: "Ali", age: 19 });
    expect(dataset.rows[2]).toEqual({ id: 3, name: "Hamza", age: null });
  });

  it("preserves sheet names across multiple sheets", () => {
    const buffer = workbookBuffer({
      Orders: [["order_id", "total"], [101, 250]],
      Sales: [["sale_id", "region"], [1, "North"]],
    });

    const orders = parseSheet(buffer, "Orders", "company.xlsx");
    const sales = parseSheet(buffer, "Sales", "company.xlsx");

    expect(orders.name).toBe("Orders");
    expect(orders.rows[0].total).toBe(250);
    expect(sales.name).toBe("Sales");
    expect(sales.rows[0].region).toBe("North");
  });

  it("throws on an empty sheet", () => {
    const buffer = workbookBuffer({ Empty: [] });
    expect(() => parseSheet(buffer, "Empty", "empty.xlsx")).toThrow(
      ParseError,
    );
  });

  it("throws when the sheet does not exist", () => {
    const buffer = workbookBuffer({ Users: [["id"], [1]] });
    expect(() => parseSheet(buffer, "Missing", "company.xlsx")).toThrow(
      ParseError,
    );
  });

  it("rejects a malformed workbook buffer", () => {
    const garbage = new ArrayBuffer(16);
    new Uint8Array(garbage).fill(0xff);
    expect(() => parseSheet(garbage, "Sheet1", "broken.xlsx")).toThrow(
      ParseError,
    );
    expect(() => inspectWorkbook(garbage, "broken.xlsx")).toThrow(
      ParseError,
    );
  });

  it("skips fully blank trailing rows", () => {
    const buffer = workbookBuffer({
      Users: [
        ["id", "name"],
        [1, "Ali"],
        [null, null],
        [2, "Bilal"],
      ],
    });

    const dataset = parseSheet(buffer, "Users", "company.xlsx");

    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[1]).toEqual({ id: 2, name: "Bilal" });
  });
});