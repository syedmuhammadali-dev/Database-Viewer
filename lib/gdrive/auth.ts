import { BrowserAuthProvider } from "gdrive-db";
import { AppError } from "@/lib/errors";

export class GoogleAuthError extends AppError {
  constructor(message: string) {
    super(message, "AuthError");
    this.name = "GoogleAuthError";
  }
}

export function getGoogleClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return id && id.trim().length > 0 ? id.trim() : null;
}

export function isGoogleDriveConfigured(): boolean {
  return getGoogleClientId() !== null;
}

export function getGooglePickerApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function isPickerConfigured(): boolean {
  return isGoogleDriveConfigured() && getGooglePickerApiKey() !== null;
}

let cachedProvider: BrowserAuthProvider | null = null;

/**
 * gdrive-db caches the access token in memory only (never localStorage), so
 * this module-level singleton is what keeps the user "signed in" across
 * workspace actions during a single page session — a reload always requires
 * signing in again, matching the app's no-persistence rule.
 */
export function getBrowserAuthProvider(): BrowserAuthProvider {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new GoogleAuthError(
      "Google sign-in isn't configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID (see README) to enable Drive sync.",
    );
  }
  if (!cachedProvider) {
    cachedProvider = new BrowserAuthProvider({ clientId });
  }
  return cachedProvider;
}

export function signOutOfGoogleDrive(): void {
  cachedProvider?.signOut();
  cachedProvider = null;
}

/** Resolves a live Drive access token, prompting sign-in if needed. */
export async function getDriveAccessToken(): Promise<string> {
  const provider = getBrowserAuthProvider();
  try {
    return await provider.getAccessToken();
  } catch (cause) {
    throw new GoogleAuthError(
      cause instanceof Error
        ? cause.message
        : "Google sign-in failed. Please try again.",
    );
  }
}

export async function ensureSignedIn(): Promise<void> {
  await getDriveAccessToken();
}
