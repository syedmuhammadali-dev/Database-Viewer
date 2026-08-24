import {
  DriveDB,
  DriveDBError,
  type Collection,
  type DocumentData,
  type StoredDocument,
} from "gdrive-db";
import { DriveError } from "@/lib/errors";
import { getBrowserAuthProvider } from "./auth";

function wrapDriveError(cause: unknown, fallback: string): DriveError {
  if (cause instanceof DriveDBError) return new DriveError(cause.message);
  return new DriveError(
    cause instanceof Error ? cause.message : fallback,
  );
}

/**
 * Connects to (or creates) the `DataLens/<database>` folder pair in the
 * signed-in user's own Drive. Requires only the least-privilege
 * `drive.file` scope — DataLens never sees the rest of the user's Drive.
 */
export async function connectDriveDatabase(database: string): Promise<DriveDB> {
  try {
    return await DriveDB.connect({
      database,
      auth: getBrowserAuthProvider(),
    });
  } catch (cause) {
    throw wrapDriveError(cause, `Could not connect to Drive database "${database}".`);
  }
}

export async function listCollections(db: DriveDB): Promise<string[]> {
  try {
    return await db.listCollections();
  } catch (cause) {
    throw wrapDriveError(cause, "Could not list collections.");
  }
}

export async function readCollectionDocs(
  db: DriveDB,
  name: string,
): Promise<StoredDocument[]> {
  try {
    return await db.collection(name).all();
  } catch (cause) {
    throw wrapDriveError(cause, `Could not read collection "${name}".`);
  }
}

export function getCollection<T extends object = DocumentData>(
  db: DriveDB,
  name: string,
): Collection<T> {
  return db.collection<T>(name);
}

export { DriveDBError };
export type { Collection, DocumentData, StoredDocument, DriveDB };
