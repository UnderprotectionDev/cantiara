import { env } from "@/env";
import { createTauriBearerHeaders } from "@/features/account-access/lib/tauri-session";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";

const FILE_ATTACHMENT_ASSET_PATH = "/api/file-attachments/";

function serverURL() {
  return new URL(env.VITE_SERVER_URL);
}

export function fileAttachmentAssetURL(path: string) {
  const baseURL = serverURL();
  const assetURL = new URL(path, baseURL);
  if (
    assetURL.origin !== baseURL.origin ||
    !assetURL.pathname.startsWith(FILE_ATTACHMENT_ASSET_PATH)
  ) {
    throw new Error("File Attachment asset path is not product-controlled.");
  }
  return assetURL;
}

export async function fetchFileAttachmentAsset(
  path: string,
  signal?: AbortSignal,
) {
  const headers = await createTauriBearerHeaders(undefined);
  const response = await defaultClientShell.request(
    fileAttachmentAssetURL(path),
    {
      credentials: "include",
      headers,
      signal,
    },
  );
  if (!response.ok) {
    throw new Error("File Attachment asset is unavailable.");
  }
  return response.blob();
}

export async function downloadFileAttachmentAsset(
  path: string,
  fileName: string,
) {
  const blob = await fetchFileAttachmentAsset(path);
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = fileName;
  anchor.href = objectURL;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectURL), 0);
}
