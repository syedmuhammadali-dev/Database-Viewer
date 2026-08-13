import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchDriveFile,
  fetchDriveSpreadsheet,
  isDocsDocumentLink,
  parseDispositionFilename,
  parseDriveLink,
} from "@/lib/importers/drive";
import { DriveError, ImportError } from "@/lib/errors";
import { getMaxFileSizeBytes } from "@/lib/importers/validate";

const ID = "1234567890AbCdEfGhIjKlMnOpQrStUv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseDriveLink", () => {
  it("extracts ids from Drive file share/view/preview links", () => {
    expect(
      parseDriveLink(`https://drive.google.com/file/d/${ID}/view?usp=sharing`),
    ).toEqual({ kind: "file", id: ID });
    expect(
      parseDriveLink(`https://drive.google.com/file/d/${ID}/preview`),
    ).toEqual({ kind: "file", id: ID });
  });

  it("extracts ids from Drive open and download urls", () => {
    expect(parseDriveLink(`https://drive.google.com/open?id=${ID}`)).toEqual({
      kind: "file",
      id: ID,
    });
    expect(
      parseDriveLink(
        `https://drive.google.com/uc?export=download&id=${ID}`,
      ),
    ).toEqual({ kind: "file", id: ID });
    expect(
      parseDriveLink(
        `https://drive.usercontent.google.com/download?id=${ID}&export=download`,
      ),
    ).toEqual({ kind: "file", id: ID });
  });

  it("extracts ids from Google Sheets links", () => {
    expect(
      parseDriveLink(
        `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=drive_link`,
      ),
    ).toEqual({ kind: "spreadsheet", id: ID });
    expect(
      parseDriveLink(
        `https://docs.google.com/spreadsheets/d/${ID}/` +
          "export?format=xlsx&id=x",
      ),
    ).toEqual({ kind: "spreadsheet", id: ID });
  });

  it("rejects folder links, other hosts and junk", () => {
    expect(
      parseDriveLink(`https://drive.google.com/drive/folders/${ID}`),
    ).toBeNull();
    expect(parseDriveLink(`https://example.com/file/d/${ID}/view`)).toBeNull();
    expect(parseDriveLink("not a link")).toBeNull();
    expect(parseDriveLink("")).toBeNull();
  });
});

describe("isDocsDocumentLink", () => {
  it("recognizes Google Docs document links", () => {
    expect(
      isDocsDocumentLink(`https://docs.google.com/document/d/${ID}/edit`),
    ).toBe(true);
    expect(
      isDocsDocumentLink(`https://docs.google.com/spreadsheets/d/${ID}/edit`),
    ).toBe(false);
  });
});

describe("parseDispositionFilename", () => {
  it("decodes RFC 5987 filenames", () => {
    expect(
      parseDispositionFilename(
        `attachment; filename*=UTF-8''${encodeURIComponent("sales report.csv")}`,
      ),
    ).toBe("sales report.csv");
  });

  it("falls back to a plain filename", () => {
    expect(
      parseDispositionFilename('attachment; filename="data.csv"'),
    ).toBe("data.csv");
  });

  it("returns null when no filename is present", () => {
    expect(parseDispositionFilename("attachment")).toBeNull();
    expect(parseDispositionFilename(null)).toBeNull();
  });
});

describe("fetchDriveFile", () => {
  it("downloads bytes from the public file endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new ArrayBuffer(4), {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": 'attachment; filename="notes.csv"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { bytes, name } = await fetchDriveFile(
      ID,
      new AbortController().signal,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("drive.usercontent.google.com/download?id=");
    expect(url).toContain(ID);
    expect(name).toBe("notes.csv");
    expect(bytes.byteLength).toBe(4);
  });
});

describe("fetchDriveSpreadsheet", () => {
  it("downloads an xlsx export from the Sheets endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new ArrayBuffer(8), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { bytes, name } = await fetchDriveSpreadsheet(
      ID,
      new AbortController().signal,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("docs.google.com/spreadsheets/d/");
    expect(url).toContain("/export?format=xlsx");
    expect(name).toBe(`spreadsheet-${ID}.xlsx`);
    expect(bytes.byteLength).toBe(8);
  });
});

describe("shared download guardrails", () => {
  it("throws DriveError for HTML responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    await expect(
      fetchDriveFile(ID, new AbortController().signal),
    ).rejects.toThrow(DriveError);
  });

  it("throws DriveError for missing files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    await expect(
      fetchDriveFile(ID, new AbortController().signal),
    ).rejects.toThrow(DriveError);
  });

  it("rejects files over the maximum size", async () => {
    const tooBig = getMaxFileSizeBytes() + 1;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new ArrayBuffer(1), {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(tooBig),
          },
        }),
      ),
    );
    await expect(
      fetchDriveFile(ID, new AbortController().signal),
    ).rejects.toThrow(ImportError);
  });
});