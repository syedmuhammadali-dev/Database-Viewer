"use client";

import { useCallback, useRef, useState } from "react";
import type { DriveDB, DocumentData, StoredDocument } from "@/lib/gdrive/client";
import { connectDriveDatabase, listCollections, getCollection } from "@/lib/gdrive/client";
import {
  docsToDataset,
  pushRowsAsCollection,
  syncRowsToCollection,
  type SyncSummary,
} from "@/lib/gdrive/convert";
import { ensureSignedIn, isGoogleDriveConfigured, signOutOfGoogleDrive } from "@/lib/gdrive/auth";
import { toUserMessage } from "@/lib/errors";
import type { DataRow, ParsedDataset } from "@/lib/types";

export type DriveLink = { databaseName: string; collectionName: string };

export function useDriveDatabase() {
  const dbRef = useRef<DriveDB | null>(null);
  const snapshotsRef = useRef<Map<string, StoredDocument[]>>(new Map());
  const [signedIn, setSignedIn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [databaseName, setDatabaseName] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const configured = isGoogleDriveConfigured();

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await ensureSignedIn();
      setSignedIn(true);
    } catch (cause) {
      setError(toUserMessage(cause) || (cause as Error).message);
      throw cause;
    }
  }, []);

  const signOut = useCallback(() => {
    signOutOfGoogleDrive();
    dbRef.current = null;
    snapshotsRef.current.clear();
    setSignedIn(false);
    setDatabaseName(null);
    setCollections([]);
  }, []);

  const refreshCollections = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    const list = await listCollections(db);
    setCollections(list);
    return list;
  }, []);

  const connect = useCallback(
    async (name: string) => {
      setConnecting(true);
      setError(null);
      try {
        await ensureSignedIn();
        setSignedIn(true);
        const db = await connectDriveDatabase(name);
        dbRef.current = db;
        setDatabaseName(db.databaseName);
        await refreshCollections();
      } catch (cause) {
        setError(toUserMessage(cause) || (cause as Error).message);
        throw cause;
      } finally {
        setConnecting(false);
      }
    },
    [refreshCollections],
  );

  /** Loads a collection's documents as a ParsedDataset for import into the local table view. */
  const importCollection = useCallback(async (name: string): Promise<ParsedDataset> => {
    const db = dbRef.current;
    if (!db) throw new Error("Not connected to a Drive database.");
    const docs = await getCollection(db, name).all();
    snapshotsRef.current.set(name, docs);
    return docsToDataset(name, docs);
  }, []);

  /** Creates a new Drive collection seeded from a local table's rows and starts tracking it. */
  const pushTableToDrive = useCallback(async (name: string, rows: DataRow[]) => {
    const db = dbRef.current;
    if (!db) throw new Error("Not connected to a Drive database.");
    await db.createCollection(name).catch(() => undefined);
    const collection = getCollection<DocumentData>(db, name);
    const docs = await pushRowsAsCollection(collection, rows);
    snapshotsRef.current.set(name, docs);
    await refreshCollections();
    return docsToDataset(name, docs);
  }, [refreshCollections]);

  /** Reconciles a linked table's current rows back to its Drive collection (insert/update/delete). */
  const syncTableToDrive = useCallback(
    async (name: string, currentRows: DataRow[]): Promise<SyncSummary> => {
      const db = dbRef.current;
      if (!db) throw new Error("Not connected to a Drive database.");
      const collection = getCollection<DocumentData>(db, name);
      const previous = snapshotsRef.current.get(name) ?? (await collection.all());
      const { summary, docs } = await syncRowsToCollection(collection, currentRows, previous);
      snapshotsRef.current.set(name, docs);
      return summary;
    },
    [],
  );

  const getCollectionHandle = useCallback((name: string) => {
    const db = dbRef.current;
    if (!db) throw new Error("Not connected to a Drive database.");
    return getCollection<DocumentData>(db, name);
  }, []);

  return {
    configured,
    signedIn,
    connecting,
    databaseName,
    collections,
    error,
    signIn,
    signOut,
    connect,
    refreshCollections,
    importCollection,
    pushTableToDrive,
    syncTableToDrive,
    getCollectionHandle,
  };
}
