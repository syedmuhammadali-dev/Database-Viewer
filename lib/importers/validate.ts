import { ImportError } from "@/lib/errors";

export const SUPPORTED_EXTENSIONS: Record<string, string[]> = {
  csv: [".csv", ".txt"],
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

export function detectFileKind(file: File): FileKind {
  const ext = extensionOf(file.name);
  if (ext && SUPPORTED_EXTENSIONS.csv.includes(ext)) return "csv";
  if (ext && SUPPORTED_EXTENSIONS.excel.includes(ext)) return "excel";
  if (ext && SUPPORTED_EXTENSIONS.json.includes(ext)) return "json";
  return "unknown";
}

export function validateImportFile(file: File, kind: FileKind): void {
  const ext = extensionOf(file.name);
  if (kind === "unknown" || (ext && !ALL_SUPPORTED_EXTENSIONS.includes(ext))) {
    throw new ImportError(
      "Unsupported file type. Upload a .csv, .xlsx, .xls or .json file.",
    );
  }

  if (!file.type || file.type === "application/octet-stream") {
    // MIME type unavailable or generic; trust extension (validated above).
  } else if (kind === "csv" && !file.type.includes("csv") && file.type.startsWith("text/") === false) {
    throw new ImportError(
      `"${file.name}" does not look like a CSV file (detected ${file.type}).`,
    );
  } else if (kind === "json" && !file.type.includes("json")) {
    throw new ImportError(
      `"${file.name}" does not look like a JSON file (detected ${file.type}).`,
    );
  }

  if (file.size > getMaxFileSizeBytes()) {
    throw new ImportError(
      `File is too large (${humanFileSize(file.size)}). Maximum file size is ${humanFileSize(getMaxFileSizeBytes())}.`,
    );
  }

  if (file.size === 0) {
    throw new ImportError("The selected file is empty.");
  }
}