import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchDriveFile,
  parseDispositionFilename,
  parseDriveFileId,
} from "@/lib/importers/drive";
import { DriveError, ImportError } from "@/lib/errors";
import { getMaxFileSizeBytes } from "@/lib/importers/validate";

const ID = "1234567890AbCdEfGhIjKlMnOpQrStUv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseDriveFileId", () => {
  it("extracts ids from share/view/preview links", () => {
    expect(
      parseDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`),
    ).toBe(ID);
    expect(parseDriveFileId(`https://drive.google.com/file/d/${ID}/preview`)).toBe(
      ID,
    );
  });

  it("extracts ids from open and download urls", () => {
    expect(parseDriveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
    expect(
      parseDriveFileId(`https://drive.google.com/uc?export=download&id=${ID}`),
    ).toBe(ID);
    expect(
      parseDriveFileId(
        `https://drive.usercontent.google.com/download?id=${ID}&export=download`,
      ),
    ).toBe(ID);
  });

  it("rejects folder links and links on other hosts", () => {
    expect(
      parseDriveFileId(
        `https://drive.google.com/drive/folders/${ID}`,
      ),
    ).toBeNull();
    expect(
      parseDriveFileId(`https://example.com/file/d/${ID}/view`),
    ).toBeNull();
    expect(parseDriveFileId("not a link")).toBeNull();
    expect(parseDriveFileId("")).toBeNull();
  });
});

describe("parseDispositionFilename", () => {
  it("decodes RFC 5987 filenames", () => {
    expect(
      parseDispositionFilename(`attachment; filename*=UTF-8''${encodeURIComponent("sales report.csv")}`),
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
  it("downloads bytes from the public endpoint", async () => {
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