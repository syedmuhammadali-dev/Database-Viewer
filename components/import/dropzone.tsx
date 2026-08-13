"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload, FolderOpen, Upload } from "lucide-react";

type DropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export default function Dropzone({ onFiles, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
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

  const directoryAttributes: Record<string, string> = {
    webkitdirectory: "",
    directory: "",
  };

  return (
    <div className="space-y-3">
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
        onClick={(event) => {
          if (!disabled && event.target !== folderRef.current) {
            inputRef.current?.click();
          }
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
            Drag and drop files or a folder here
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            CSV, Excel and JSON are detected automatically
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <input
          ref={folderRef}
          type="file"
          multiple
          className="sr-only"
          {...directoryAttributes}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) onFiles(files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) folderRef.current?.click();
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50"
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          Choose a folder
        </button>
      </div>
    </div>
  );
}