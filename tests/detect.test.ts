import { describe, it, expect } from "vitest";
import {
  decodeUtf8,
  detectFileKind,
  sniffFileKind,
  validateImportFile,
} from "@/lib/importers/validate";

function file(name: string, bytes: Uint8Array): File {
  return new File([bytes.buffer as ArrayBuffer], name, { type: "application/octet-stream" });
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function bytesOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer()) as Uint8Array;
}

describe("sniffFileKind", () => {
  it("detects xlsx by ZIP magic bytes", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    expect(sniffFileKind(bytes)).toBe("excel");
  });

  it("detects xls by CFB magic bytes", () => {
    const bytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]);
    expect(sniffFileKind(bytes)).toBe("excel");
  });

  it("detects JSON objects and arrays", () => {
    expect(sniffFileKind(utf8('{"a": 1}'))).toBe("json");
    expect(sniffFileKind(utf8('[1, 2, 3]'))).toBe("json");
  });

  it("treats textual tabular content as csv (delimiter sniffed later)", () => {
    expect(sniffFileKind(utf8("a,b,c\n1,2,3"))).toBe("csv");
    expect(sniffFileKind(utf8("a;b\n1;2"))).toBe("csv");
    expect(sniffFileKind(utf8("a\tb\n1\t2"))).toBe("csv");
  });

  it("detects SQLite databases by magic header", () => {
    const header = utf8("SQLite format 3\0");
    const bytes = new Uint8Array([...header, 4, 0, 1, 1]);
    expect(sniffFileKind(bytes)).toBe("sqlite");
  });

  it("detects Parquet files by PAR1 magic", () => {
    const bytes = new Uint8Array([0x50, 0x41, 0x52, 0x31, 1, 2, 3]);
    expect(sniffFileKind(bytes)).toBe("parquet");
  });

  it("rejects binary content with NUL bytes", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x00, 0x61, 0x00]);
    expect(sniffFileKind(bytes)).toBe("unknown");
  });

  it("rejects empty content", () => {
    expect(sniffFileKind(new Uint8Array(0))).toBe("unknown");
  });
});

describe("detectFileKind", () => {
  it("relies on content over a misleading extension", async () => {
    const json = file("notes.csv", utf8('{"name": "ada"}'));
    expect(detectFileKind(json, await bytesOf(json))).toBe(
      "json",
    );
  });

  it("detects unknown extensions by content", async () => {
    const json = file("export.dump", utf8('[{"a":1}]'));
    expect(detectFileKind(json, await bytesOf(json))).toBe(
      "json",
    );
    const csv = file("data-unknown", utf8("a,b\n1,2"));
    expect(detectFileKind(csv, await bytesOf(csv))).toBe(
      "csv",
    );
  });

  it("falls back to the extension when content is ambiguous", async () => {
    const csv = file("table.csv", utf8("a,b\n1,2"));
    expect(detectFileKind(csv, await bytesOf(csv))).toBe(
      "csv",
    );
  });

  it("returns unknown for unsupported binaries even with an odd extension", async () => {
    const binary = file("photo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
    expect(detectFileKind(binary, await bytesOf(binary))).toBe(
      "unknown",
    );
  });

  it("does not misread Word/PowerPoint files as Excel despite ZIP magic", async () => {
    const docx = file("report.docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
    expect(detectFileKind(docx, await bytesOf(docx))).toBe("unknown");
    const pptx = file("deck.pptx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
    expect(detectFileKind(pptx, await bytesOf(pptx))).toBe("unknown");
  });

  it("detects a SQLite database via extension and magic header", async () => {
    const header = utf8("SQLite format 3\0");
    const db = file("app.sqlite", new Uint8Array([...header, 4, 0, 1, 1]));
    expect(detectFileKind(db, await bytesOf(db))).toBe("sqlite");
  });

  it("detects a Parquet file via extension and magic bytes", async () => {
    const parquet = file(
      "table.parquet",
      new Uint8Array([0x50, 0x41, 0x52, 0x31, 1, 2, 3]),
    );
    expect(detectFileKind(parquet, await bytesOf(parquet))).toBe("parquet");
  });

  it("still detects real Excel workbooks by ZIP magic", async () => {
    const xlsx = file("book.xlsx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
    expect(detectFileKind(xlsx, await bytesOf(xlsx))).toBe("excel");
  });
});

describe("decodeUtf8", () => {
  it("strips a UTF-8 BOM", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("a,b\n1,2")]);
    expect(decodeUtf8(withBom)).toBe("a,b\n1,2");
  });
});

describe("validateImportFile", () => {
  it("rejects empty files", () => {
    const empty = new File([""], "empty.csv");
    expect(() => validateImportFile(empty)).toThrow(/empty/);
  });

  it("accepts files with unknown extensions", () => {
    const unknown = new File(["hello world"], "file.xyz");
    expect(() => validateImportFile(unknown)).not.toThrow();
  });
});
