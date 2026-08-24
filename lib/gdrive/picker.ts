import { DriveError } from "@/lib/errors";

const GAPI_SCRIPT_SRC = "https://apis.google.com/js/api.js";

interface GapiGlobal {
  load(api: string, options: { callback: () => void; onerror?: () => void }): void;
}

interface PickerDoc {
  id: string;
  name: string;
}

interface PickerResponse {
  action: string;
  docs?: PickerDoc[];
}

interface PickerDocsView {
  setSelectFolderEnabled(enabled: boolean): PickerDocsView;
  setIncludeFolders(include: boolean): PickerDocsView;
  setMimeTypes(mimeTypes: string): PickerDocsView;
}

interface PickerInstance {
  setVisible(visible: boolean): void;
}

interface PickerBuilder {
  addView(view: PickerDocsView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setCallback(callback: (data: PickerResponse) => void): PickerBuilder;
  build(): PickerInstance;
}

interface GooglePickerNamespace {
  DocsView: new (viewId: unknown) => PickerDocsView;
  ViewId: { FOLDERS: unknown };
  Action: { PICKED: string; CANCEL: string };
  PickerBuilder: new () => PickerBuilder;
}

function getGapi(): GapiGlobal | undefined {
  return (window as unknown as { gapi?: GapiGlobal }).gapi;
}

function getGooglePicker(): GooglePickerNamespace | undefined {
  return (window as unknown as { google?: { picker?: GooglePickerNamespace } }).google?.picker;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new DriveError("Failed to load the Google Picker script.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new DriveError("Failed to load the Google Picker script."));
    document.head.appendChild(script);
  });
}

let pickerReady: Promise<void> | null = null;

async function ensurePickerLoaded(): Promise<void> {
  if (!pickerReady) {
    pickerReady = loadScript(GAPI_SCRIPT_SRC).then(
      () =>
        new Promise<void>((resolve, reject) => {
          const gapi = getGapi();
          if (!gapi) {
            reject(new DriveError("The Google API script did not initialize."));
            return;
          }
          gapi.load("picker", {
            callback: resolve,
            onerror: () => reject(new DriveError("Could not load the Google Picker library.")),
          });
        }),
    );
  }
  return pickerReady;
}

export type PickedFolder = { id: string; name: string };

/** Opens Google's folder picker; resolves null if the user cancels. */
export async function pickDriveFolder(options: {
  apiKey: string;
  accessToken: string;
}): Promise<PickedFolder | null> {
  await ensurePickerLoaded();
  const picker = getGooglePicker();
  if (!picker) {
    throw new DriveError("The Google Picker library did not load.");
  }
  return new Promise<PickedFolder | null>((resolve, reject) => {
    try {
      const view = new picker.DocsView(picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setMimeTypes("application/vnd.google-apps.folder");
      const instance = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(options.accessToken)
        .setDeveloperKey(options.apiKey)
        .setCallback((data) => {
          if (data.action === picker.Action.PICKED) {
            const doc = data.docs?.[0];
            resolve(doc ? { id: doc.id, name: doc.name } : null);
          } else if (data.action === picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      instance.setVisible(true);
    } catch (cause) {
      reject(
        new DriveError(
          cause instanceof Error ? cause.message : "Could not open the Google Drive picker.",
        ),
      );
    }
  });
}
