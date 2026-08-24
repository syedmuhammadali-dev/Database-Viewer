import { ImportError } from "@/lib/errors";

export const SUPPORTED_EXTENSIONS: Record<string, string[]> = {
  csv: [".csv", ".txt", ".tsv"],
  excel: [".xlsx", ".xls"],
  json: [".json"],
  sqlite: [".db", ".sqlite", ".sqlite3"],
  parquet: [".parquet"],
};

export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_EXTENSIONS.csv,
  ...SUPPORTED_EXTENSIONS.excel,
  ...SUPPORTED_EXTENSIONS.json,
  ...SUPPORTED_EXTENSIONS.sqlite,
  ...SUPPORTED_EXTENSIONS.parquet,
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

export type FileKind = "csv" | "excel" | "json" | "sqlite" | "parquet" | "unknown";

const SQLITE_MAGIC = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61,
  0x74, 0x20, 0x33, 0x00,
]; // "SQLite format 3\0"

const PARQUET_MAGIC = [0x50, 0x41, 0x52, 0x31]; // "PAR1"

const OFFICE_DOCUMENT_EXTENSIONS = [
  ".doc",
  ".docx",
  ".odt",
  ".ppt",
  ".pptx",
  ".odp",
];

function kindFromExtension(ext: string): FileKind {
  if (SUPPORTED_EXTENSIONS.csv.includes(ext)) return "csv";
  if (SUPPORTED_EXTENSIONS.excel.includes(ext)) return "excel";
  if (SUPPORTED_EXTENSIONS.json.includes(ext)) return "json";
  if (SUPPORTED_EXTENSIONS.sqlite.includes(ext)) return "sqlite";
  if (SUPPORTED_EXTENSIONS.parquet.includes(ext)) return "parquet";
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

  // SQLite database file (header is the literal string "SQLite format 3\0").
  if (startsWith(bytes, SQLITE_MAGIC)) return "sqlite";

  // Parquet: starts (and ends) with the "PAR1" magic.
  if (startsWith(bytes, PARQUET_MAGIC)) return "parquet";

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
  // Word/PowerPoint/OpenDocument files are also ZIP archives, but they are
  // documents, not spreadsheets — surface them as unsupported instead of
  // misreading them as Excel workbooks.
  if (sniffed === "excel" && ext && OFFICE_DOCUMENT_EXTENSIONS.includes(ext)) {
    return "unknown";
  }
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