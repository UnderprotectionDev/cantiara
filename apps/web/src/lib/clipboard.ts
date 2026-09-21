export type ClipboardWriter = (text: string) => Promise<void>;

export function writeTextToClipboard(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return Promise.reject(new Error("Clipboard is unavailable."));
  }
  return navigator.clipboard.writeText(text);
}
