import type { WebCaptureKind } from "@cantiara/api/web-capture";
import { format } from "date-fns";

import type { ActiveTabCapture, WebCaptureDraft } from "./web-capture";

export const PAIRING_INVALID_MESSAGE =
  "This Pairing code is invalid, expired, or already used.";
export const DEFAULT_DEVICE = "Browser extension";
const HTTP_URL_PATTERN = /^https?:\/\//;

export const CAPTURE_ACTIONS: Array<{
  kind: WebCaptureKind;
  label: string;
}> = [
  { kind: "url", label: "Capture URL" },
  { kind: "selected-text", label: "Capture selected text" },
  { kind: "selected-image", label: "Capture selected image" },
  { kind: "screenshot", label: "Capture screenshot" },
];

export function draftFor(
  kind: WebCaptureKind,
  tab: ActiveTabCapture,
  mediaDataUrl?: string,
): WebCaptureDraft {
  const clientIdempotencyKey = crypto.randomUUID();
  if (kind === "selected-text") {
    return {
      clientIdempotencyKey,
      content: tab.selectedText,
      kind,
      link: tab.url,
      originUrl: tab.url,
    };
  }
  if (kind === "selected-image") {
    const { selectedImageUrl, url } = tab;
    const selectedImageLink =
      selectedImageUrl && HTTP_URL_PATTERN.test(selectedImageUrl)
        ? selectedImageUrl
        : url;
    return {
      clientIdempotencyKey,
      content: "Selected image",
      kind,
      link: selectedImageLink,
      originUrl: tab.url,
    };
  }
  if (kind === "screenshot") {
    return {
      clientIdempotencyKey,
      content: `Screenshot of ${tab.title || tab.url}`,
      kind,
      link: tab.url,
      mediaDataUrl,
      originUrl: tab.url,
    };
  }
  return {
    clientIdempotencyKey,
    content: tab.title || tab.url,
    kind,
    link: tab.url,
    originUrl: tab.url,
  };
}

export function formatSavedAt(value: string | null) {
  if (!value) {
    return "Not yet";
  }
  return format(new Date(value), "PP p");
}
