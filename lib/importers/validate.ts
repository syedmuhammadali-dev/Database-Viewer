import { ImportError } from "@/lib/errors";

export const SUPPORTED_EXTENSIONS: Record<string, string[]> = {
  csv: [".csv", ".txt", ".tsv"],
  excel: [".xlsx", ".xls"],
  json: [".json"],
};

export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_EXTENSIONS.csv,
  ...SUPPORTED_EXTENSIONS.excel,
  ...SUPPORTED_EXTENSIONS.json,
];

export const DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export function getMaxFileSizeBytes(): number {
  const raw = process.env.NEXT_PUBLIC_MAX_FILE_SIZE_BYTES;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }
  return parsed;
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  return name.slice(dot).toLowerCase();
}

export type FileKind = "csv" | "excel" | "json" | "unknown";

function kindFromExtension(ext: string): FileKind {
  if (SUPPORTED_EXTENSIONS.csv.includes(ext)) return "csv";
  if (SUPPORTED_EXTENSIONS.excel.includes(ext)) return "excel";
  if (SUPPORTED_EXTENSIONS.json.includes(ext)) return "json";
  return "unknown";
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

function containsNul(head: Uint8Array): boolean {
  return head.includes(0);
}

function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function decodeUtf8(bytes: Uint8Array): string {
  return stripUtf8Bom(new TextDecoder("utf-8").decode(bytes));
}

/**
 * Content-based format detection (magic bytes + text heuristics).
 * Works even when the file extension is missing or wrong.
 */
export function sniffFileKind(bytes: Uint8Array): FileKind {
  if (bytes.length === 0) return "unknown";

  // Excel: xlsx/xlsm/xlsb are ZIP archives; xls is an OLE Compound File.
  if (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08]) ||
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])
  ) {
    return "excel";
  }

  // Binary/opaque content we cannot turn into a table.
  if (containsNul(bytes.subarray(0, 4096))) return "unknown";

  const text = decodeUtf8(bytes).trim();
  if (text === "") return "unknown";

  // JSON objects / arrays.
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      JSON.parse(text);
      return "json";
    } catch {
      return "unknown";
    }
  }

  // Everything else textual is parsed as a delimited table (CSV/TSV/SSV).
  return "csv";
}

/**
 * Resolve the import kind: extension first (fast path), confirmed or
 * replaced by content sniffing once bytes are available.
 */
export function detectFileKind(file: File, bytes?: Uint8Array): FileKind {
  const ext = extensionOf(file.name);
  const extKind = ext ? kindFromExtension(ext) : "unknown";
  if (!bytes) return extKind;
  const sniffed = sniffFileKind(bytes);
  if (sniffed === "unknown") return extKind !== "unknown" ? extKind : "unknown";
  return sniffed;
}

export function validateImportFile(file: File): void {
  if (file.size > getMaxFileSizeBytes()) {
    throw new ImportError(
      `File is too large (${humanFileSize(file.size)}). Maximum file size is ${humanFileSize(getMaxFileSizeBytes())}.`,
    );
  }

  if (file.size === 0) {
    throw new ImportError("The selected file is empty.");
  }
}