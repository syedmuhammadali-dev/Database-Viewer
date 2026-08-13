import { ImportError } from "@/lib/errors";

export function readFileAsArrayBuffer(
  file: File,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, (event.loaded / event.total) * 100));
      }
    };

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onProgress(100);
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

    reader.readAsArrayBuffer(file);
  });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}