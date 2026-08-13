import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/parsers/csv";
import { ParseError } from "@/lib/errors";

describe("parseCsv", () => {
  it("parses a valid CSV with headers and rows", async () => {
    const csv = [
      "id,name,email,age,city,status",
      "1,Ali,ali@example.com,19,Karachi,Active",
      "2,Ahmed,ahmed@example.com,22,Lahore,Active",
      "3,Hamza,hamza@example.com,21,Islamabad,Inactive",
    ].join("\n");

    const dataset = await parseCsv(csv, "users");

    expect(dataset.name).toBe("users");
    expect(dataset.columns).toEqual([
      "id",
      "name",
      "email",
      "age",
      "city",
      "status",
    ]);
    expect(dataset.rows).toHaveLength(3);
    expect(dataset.rows[0]).toEqual({
      id: "1",
      name: "Ali",
      email: "ali@example.com",
      age: "19",
      city: "Karachi",
      status: "Active",
    });
  });

  it("handles quoted values and commas inside fields", async () => {
    const csv = [
      'name,notes',
      '"Doe, John","Hello, world"',
      '"Smith, Jane","A, B, C"',
    ].join("\n");

    const dataset = await parseCsv(csv, "people");

    expect(dataset.rows[0]).toEqual({
      name: "Doe, John",
      notes: "Hello, world",
    });
    expect(dataset.rows[1].notes).toBe("A, B, C");
  });

  it("converts empty values to null", async () => {
    const csv = ["name,email", "Ali,", ",ali@example.com"].join("\n");

    const dataset = await parseCsv(csv, "contacts");

    expect(dataset.rows[0]).toEqual({ name: "Ali", email: null });
    expect(dataset.rows[1]).toEqual({ name: null, email: "ali@example.com" });
  });

  it("deduplicates duplicate column headers", async () => {
    const csv = ["a,a,a,b", "1,2,3,4"].join("\n");

    const dataset = await parseCsv(csv, "dup");

    expect(dataset.columns).toEqual(["a", "a_1", "a_2", "b"]);
  });

  it("trims header whitespace", async () => {
    const csv = [" name , age ", "Ali, 19"].join("\n");

    const dataset = await parseCsv(csv, "trim");

    expect(dataset.columns).toEqual(["name", "age"]);
  });

  it("does not strip spaces inside values", async () => {
    const csv = [" name , Full Name ", "Ali, Ali Raza "].join("\n");

    const dataset = await parseCsv(csv, "spaces");

    expect(dataset.rows[0]["Full Name"]).toBe(" Ali Raza ");
  });

  it("handles UTF-8 content", async () => {
    const csv = ["name,city", "Ahmad,کراچی", "Zeynep,İstanbul"].join("\n");

    const dataset = await parseCsv(csv, "utf8");

    expect(dataset.rows[0].city).toBe("کراچی");
    expect(dataset.rows[1].city).toBe("İstanbul");
  });

  it("throws on an empty file", async () => {
    await expect(parseCsv("", "empty")).rejects.toBeInstanceOf(ParseError);
    await expect(parseCsv("\n\n", "empty")).rejects.toBeInstanceOf(ParseError);
  });

  it("throws when there are no data rows", async () => {
    await expect(parseCsv("id,name\n", "empty")).rejects.toBeInstanceOf(
      ParseError,
    );
  });

  it("uses the first row as headers even if they look numeric", async () => {
    const dataset = await parseCsv("1,Ali\n2,Bilal\n", "nums");

    expect(dataset.columns).toEqual(["1", "Ali"]);
    expect(dataset.rows[0]).toEqual({ "1": "2", Ali: "Bilal" });
  });

  it("reports inconsistent columns with a helpful message", async () => {
    const csv = ["a,b,c", "1,2,3", "1,2"].join("\n");

    await expect(parseCsv(csv, "bad")).rejects.toMatchObject({
      category: "ParseError",
      message: expect.stringMatching(/Too few fields|Too many fields|field/i),
    });
  });

  it("rejects content that is not a string", async () => {
    await expect(
      parseCsv(["not a string"] as unknown as string, "bad"),
    ).rejects.toBeInstanceOf(ParseError);
  });
});