import { ImportError } from "@/lib/errors";

export function readFileWithProgress(
  file: File,
  onProgress: (pct: number) => void,
  onStatus: (status: "reading" | "parsing") => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    onStatus("reading");
    onProgress(0);

    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, (event.loaded / event.total) * 100));
      }
    };

    reader.onload = () => {
      if (typeof reader.result === "string") {
        onProgress(100);
        onStatus("parsing");
        resolve(reader.result);
      } else {
        reject(new ImportError("Failed to read the file."));
      }
    };

    reader.onerror = () => {
      reject(new ImportError("Could not read this file on your device."));
    };

    reader.onabort = () => {
      reject(new DOMException("The read was aborted.", "AbortError"));
    };

    signal.addEventListener(
      "abort",
      () => {
        reader.abort();
      },
      { once: true },
    );

    reader.readAsText(file, "utf-8");
  });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}