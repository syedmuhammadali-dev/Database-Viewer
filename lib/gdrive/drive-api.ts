import { DriveError, ImportError } from "@/lib/errors";
import { getMaxFileSizeBytes, humanFileSize } from "@/lib/importers/validate";

const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_APPS_FOLDER = "application/vnd.google-apps.folder";
const GOOGLE_APPS_PREFIX = "application/vnd.google-apps.";
const GOOGLE_APPS_SPREADSHEET = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type DriveFileEntry = {
  id: string;
  name: string;
  mimeType: string;
};

type ListFilesResponse = {
  files?: DriveFileEntry[];
  nextPageToken?: string;
};

/** Lists the immediate (non-folder) children of a Drive folder using an OAuth access token. */
export async function listFolderFiles(
  folderId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<DriveFileEntry[]> {
  const files: DriveFileEntry[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(DRIVE_FILES_ENDPOINT);
    url.searchParams.set(
      "q",
      `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    );
    url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType)");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    if (!response.ok) {
      throw new DriveError(
        `Could not list this folder's files (Google responded with status ${response.status}).`,
      );
    }
    const data = (await response.json()) as ListFilesResponse;
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files.filter((file) => file.mimeType !== GOOGLE_APPS_FOLDER);
}

/** Downloads one Drive file (exporting Google Sheets to XLSX) as a browser File. */
export async function downloadDriveFile(
  file: DriveFileEntry,
  accessToken: string,
  signal?: AbortSignal,
): Promise<File> {
  const isGoogleNative = file.mimeType.startsWith(GOOGLE_APPS_PREFIX);
  if (isGoogleNative && file.mimeType !== GOOGLE_APPS_SPREADSHEET) {
    throw new ImportError(
      `"${file.name}" is a Google Docs/Slides file and can't be imported as a table.`,
    );
  }

  const url = isGoogleNative
    ? `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(XLSX_MIME_TYPE)}`
    : `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(file.id)}?alt=media`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  if (!response.ok) {
    throw new DriveError(
      `Could not download "${file.name}" (Google responded with status ${response.status}).`,
    );
  }

  const max = getMaxFileSizeBytes();
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > max) {
    throw new ImportError(
      `"${file.name}" is too large (${humanFileSize(contentLength)}). Maximum file size is ${humanFileSize(max)}.`,
    );
  }

  const bytes = await response.arrayBuffer();
  const name = isGoogleNative ? `${file.name}.xlsx` : file.name;
  return new File([bytes], name, { type: "application/octet-stream" });
}
