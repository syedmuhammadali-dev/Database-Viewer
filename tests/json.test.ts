import { describe, expect, it } from "vitest";
import { parseJson } from "@/lib/parsers/json";
import { ParseError } from "@/lib/errors";

describe("parseJson", () => {
  it("parses an array of objects", async () => {
    const dataset = await parseJson(
      JSON.stringify([
        { id: 1, name: "Ali", age: 19 },
        { id: 2, name: "Ahmed", age: 22 },
      ]),
      "people",
    );

    expect(dataset.name).toBe("people");
    expect(dataset.columns).toEqual(["id", "name", "age"]);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[1]).toEqual({ id: 2, name: "Ahmed", age: 22 });
  });

  it("supports mixed primitive types and null", async () => {
    const dataset = await parseJson(
      JSON.stringify([
        { s: "text", n: 3.14, b: true, nul: null, missed: undefined },
      ]),
      "types",
    );

    expect(dataset.rows[0].s).toBe("text");
    expect(dataset.rows[0].n).toBe(3.14);
    expect(dataset.rows[0].b).toBe(true);
    expect(dataset.rows[0].nul).toBeNull();
  });

  it("flattens nested objects with dot paths without data loss", async () => {
    const dataset = await parseJson(
      JSON.stringify([
        {
          id: 1,
          address: { city: "Karachi", geo: { lat: 24.86, lng: 67 } },
          tags: ["a", "b"],
        },
      ]),
      "nested",
    );

    expect(dataset.columns).toContain("address.city");
    expect(dataset.columns).toContain("address.geo.lat");
    expect(dataset.rows[0]["address.city"]).toBe("Karachi");
    expect(dataset.rows[0]["address.geo.lng"]).toBe(67);
    expect(dataset.rows[0].tags).toBe('["a","b"]');
  });

  it("preserves arrays of primitives as JSON strings", async () => {
    const dataset = await parseJson(
      JSON.stringify([{ id: 1, nums: [1, 2, 3] }]),
      "arr",
    );

    expect(dataset.rows[0].nums).toBe("[1,2,3]");
  });

  it("treats a scalar array as a single column", async () => {
    const dataset = await parseJson(JSON.stringify(["cat", "dog", 12]), "list");

    expect(dataset.columns).toEqual(["value"]);
    expect(dataset.rows[1].value).toBe("dog");
  });

  it("treats a top-level object as a single row", async () => {
    const dataset = await parseJson(
      JSON.stringify({ name: "Ali", age: 19 }),
      "obj",
    );

    expect(dataset.rows).toHaveLength(1);
    expect(dataset.rows[0]).toEqual({ name: "Ali", age: 19 });
  });

  it("expands an array of arrays into columns", async () => {
    const dataset = await parseJson(
      JSON.stringify([
        [1, "x"],
        [2, "y"],
      ]),
      "matrix",
    );

    expect(dataset.columns).toEqual(["column_1", "column_2"]);
    expect(dataset.rows[0]).toEqual({ column_1: 1, column_2: "x" });
  });

  it("throws on invalid JSON", async () => {
    await expect(parseJson("{ not valid", "bad")).rejects.toBeInstanceOf(
      ParseError,
    );
  });

  it("throws on an empty file", async () => {
    await expect(parseJson("", "empty")).rejects.toBeInstanceOf(ParseError);
    await expect(parseJson("   ", "empty")).rejects.toBeInstanceOf(ParseError);
  });

  it("throws when there are no records", async () => {
    await expect(parseJson("[]", "none")).rejects.toBeInstanceOf(ParseError);
    await expect(parseJson("null", "none")).rejects.toBeInstanceOf(ParseError);
  });

  it("rejects non-string content", async () => {
    await expect(
      parseJson(42 as unknown as string, "bad"),
    ).rejects.toBeInstanceOf(ParseError);
  });
});