import { DriveError, ImportError } from "@/lib/errors";
import { getMaxFileSizeBytes, humanFileSize } from "./validate";
import { isAbortError } from "./read-file";

const DRIVE_ID_RX = /^[\w-]{20,}$/;

export type DriveTarget =
  | { kind: "file"; id: string }
  | { kind: "spreadsheet"; id: string };

const FILE_HOSTS = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
]);

export function parseDriveLink(input: string): DriveTarget | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  if (host === "docs.google.com") {
    const match = url.pathname.match(/^\/(?:spreadsheets|spreadsheet)\/d\/([\w-]{20,})\b/);
    if (match?.[1]) return { kind: "spreadsheet", id: match[1] };
    return null;
  }

  if (!FILE_HOSTS.has(host)) return null;

  const param = url.searchParams.get("id");
  if (param && DRIVE_ID_RX.test(param)) return { kind: "file", id: param };
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.includes("folders")) return null;
  const index = segments.indexOf("d");
  const candidate = index !== -1 ? segments[index + 1] : undefined;
  if (candidate && DRIVE_ID_RX.test(candidate)) {
    return { kind: "file", id: candidate };
  }
  return null;
}

export function isDocsDocumentLink(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return false;
  }
  return (
    url.hostname === "docs.google.com" && /^\/document\//.test(url.pathname)
  );
}

export function parseDispositionFilename(
  disposition: string | null,
): string | null {
  if (!disposition) return null;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    const value = decodeURIComponent(star[1].trim()).replace(/^"|"$/g, "");
    if (value) return value;
  }
  const plain = disposition.match(/filename="?([^"]*)"?/i);
  const value = plain?.[1]?.trim();
  return value ? value : null;
}

async function download(
  url: string,
  fallbackName: string,
  signal: AbortSignal,
): Promise<{ bytes: ArrayBuffer; name: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      mode: "cors",
      redirect: "follow",
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new DriveError(
      "Could not reach Google. Check your connection and try again.",
    );
  }

  if (response.status === 404) {
    throw new DriveError("File not found. Make sure it still exists.");
  }
  if (!response.ok) {
    throw new DriveError(
      `Google responded with status ${response.status}. Share the item as "Anyone with the link" and try again.`,
    );
  }

  const max = getMaxFileSizeBytes();
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > max) {
    throw new ImportError(
      `File is too large (${humanFileSize(contentLength)}). Maximum file size is ${humanFileSize(max)}.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new DriveError(
      'This item is not publicly shared or needs a confirmation. Set sharing to "Anyone with the link" and try again.',
    );
  }

  const bytes = await response.arrayBuffer();
  const name =
    parseDispositionFilename(response.headers.get("content-disposition")) ??
    fallbackName;
  return { bytes, name };
}

export function fetchDriveFile(
  id: string,
  signal: AbortSignal,
): Promise<{ bytes: ArrayBuffer; name: string }> {
  return download(
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
    `${id}.bin`,
    signal,
  );
}

export function fetchDriveSpreadsheet(
  id: string,
  signal: AbortSignal,
): Promise<{ bytes: ArrayBuffer; name: string }> {
  return download(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx`,
    `spreadsheet-${id}.xlsx`,
    signal,
  );
}