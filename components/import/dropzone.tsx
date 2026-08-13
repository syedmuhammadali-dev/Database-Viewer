"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload, Upload } from "lucide-react";
import { ALL_SUPPORTED_EXTENSIONS } from "@/lib/importers/validate";

type DropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export default function Dropzone({ onFiles, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled],
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`group relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isDragging
          ? "border-blue-400 bg-blue-500/10"
          : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALL_SUPPORTED_EXTENSIONS.join(",")}
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors group-hover:bg-zinc-700">
        {isDragging ? (
          <CloudUpload className="h-6 w-6" aria-hidden />
        ) : (
          <Upload className="h-6 w-6" aria-hidden />
        )}
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-200">
          Drag and drop files here
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          or click to browse · CSV, Excel, JSON
        </p>
      </div>
    </div>
  );
}