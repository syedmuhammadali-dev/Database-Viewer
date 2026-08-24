"use client";

import { useCallback, useState } from "react";
import { FolderInput, Loader2 } from "lucide-react";
import {
  getDriveAccessToken,
  getGooglePickerApiKey,
  isPickerConfigured,
} from "@/lib/gdrive/auth";
import { pickDriveFolder } from "@/lib/gdrive/picker";
import { downloadDriveFile, listFolderFiles } from "@/lib/gdrive/drive-api";
import { toUserMessage } from "@/lib/errors";

type DriveFolderPickerProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

/**
 * Lets the user pick any existing Google Drive folder (via Google Picker,
 * not just the app-managed gdrive-db folder) and imports every file in it
 * through the same file pipeline as a local upload.
 */
export default function DriveFolderPicker({ onFiles, disabled }: DriveFolderPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getDriveAccessToken();
      const apiKey = getGooglePickerApiKey();
      if (!apiKey) {
        setError("Drive folder browsing isn't configured.");
        return;
      }
      const folder = await pickDriveFolder({ apiKey, accessToken: token });
      if (!folder) return;

      const entries = await listFolderFiles(folder.id, token);
      if (entries.length === 0) {
        setError(`"${folder.name}" has no files to import.`);
        return;
      }

      const files: File[] = [];
      const failures: string[] = [];
      for (const entry of entries) {
        try {
          files.push(await downloadDriveFile(entry, token));
        } catch (cause) {
          failures.push(`${entry.name}: ${toUserMessage(cause)}`);
        }
      }
      if (files.length > 0) onFiles(files);
      if (failures.length > 0) {
        setError(
          `${failures.length} file${failures.length === 1 ? "" : "s"} couldn't be imported — ${failures.join("; ")}`,
        );
      }
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, onFiles]);

  if (!isPickerConfigured()) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={disabled || busy}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FolderInput className="h-3.5 w-3.5" aria-hidden />
        )}
        Browse a Drive folder
      </button>
      {error ? <p className="mt-2 text-xs leading-5 text-amber-300">{error}</p> : null}
    </div>
  );
}
