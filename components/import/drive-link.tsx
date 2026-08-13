"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import {
  fetchDriveFile,
  parseDriveFileId,
} from "@/lib/importers/drive";
import { toUserMessage } from "@/lib/errors";
import { isAbortError } from "@/lib/importers/read-file";

type GoogleDriveLinkProps = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export default function GoogleDriveLink({
  onFile,
  disabled,
}: GoogleDriveLinkProps) {
  const [link, setLink] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleFetch = useCallback(async () => {
    if (fetching || disabled) return;
    const id = parseDriveFileId(link);
    if (!id) {
      setError(
        'That doesn\'t look like a Google Drive file link. Paste a share link like https://drive.google.com/file/d/…/view',
      );
      return;
    }
    abortRef.current = new AbortController();
    setFetching(true);
    setError(null);
    try {
      const { bytes, name } = await fetchDriveFile(
        id,
        abortRef.current.signal,
      );
      onFile(new File([bytes], name, { type: "application/octet-stream" }));
      setLink("");
    } catch (cause) {
      if (!isAbortError(cause)) setError(toUserMessage(cause));
    } finally {
      setFetching(false);
      abortRef.current = null;
    }
  }, [fetching, disabled, link, onFile]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const canFetch =
    !disabled && !fetching && link.trim().length > 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleFetch();
      }}
    >
      <label className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="Paste a Google Drive file link…"
            aria-label="Google Drive file link"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-8 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={!canFetch}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {fetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Link2 className="h-3.5 w-3.5" aria-hidden />
          )}
          Fetch
        </button>
      </label>
      {error ? (
        <p className="mt-2 text-xs leading-5 text-amber-300">{error}</p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          The file must be publicly shared (&quot;Anyone with the link&quot;).
          It is fetched straight into your browser and never leaves it.
        </p>
      )}
    </form>
  );
}