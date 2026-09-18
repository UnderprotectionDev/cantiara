import { browser } from "wxt/browser";

export const WEB_CAPTURE_SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

const BROWSER_ARC_PATTERN = /Arc\//;
const BROWSER_CHROME_PATTERN = /Chrome\//;
const BROWSER_EDGE_PATTERN = /Edg\//;
const BROWSER_FIREFOX_PATTERN = /Firefox\//;
const HTTP_URL_PATTERN = /^https?:\/\//;
const SERVER_URL_TRAILING_SLASH_PATTERN = /\/$/;

export type WebCaptureBrowser = "Arc" | "Brave" | "Chrome" | "Edge" | "Firefox";

export type WebCaptureKind =
  | "selected-image"
  | "selected-text"
  | "screenshot"
  | "url";

export interface WebCaptureLink {
  browser: WebCaptureBrowser;
  createdAt: string;
  device: string;
  id: string;
  lastUse: string | null;
}

export interface WebCaptureTarget {
  id: string;
  label: "Project Capture Inbox" | "Workspace Capture Inbox";
  name: string;
  projectId: string | null;
}

export interface WebCaptureDraft {
  content: string;
  kind: WebCaptureKind;
  link?: string;
  mediaDataUrl?: string;
  originUrl: string;
}

interface StoredWebCaptureLink {
  browser: WebCaptureBrowser;
  device: string;
  id: string;
  lastSuccessfulSave: string | null;
  token: string;
}

interface WebCapturePairResponse {
  link: WebCaptureLink;
  token: string;
}

interface WebCaptureTargetsResponse {
  targets: WebCaptureTarget[];
}

export class WebCaptureApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = "WebCaptureApiError";
    this.code = code;
    this.status = status;
  }
}

const STORAGE_KEY = "webCaptureLink";

function endpoint(path: string) {
  return `${WEB_CAPTURE_SERVER_URL.replace(SERVER_URL_TRAILING_SLASH_PATTERN, "")}${path}`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const response = await fetch(endpoint(path), {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { code?: string; message?: string })
    | null;
  if (!response.ok) {
    throw new WebCaptureApiError(
      payload?.code ?? "WEB_CAPTURE_UNAVAILABLE",
      response.status,
      payload?.message,
    );
  }
  return payload as T;
}

export async function getStoredWebCaptureLink() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StoredWebCaptureLink | undefined) ?? null;
}

export async function clearStoredWebCaptureLink() {
  await browser.storage.local.remove(STORAGE_KEY);
}

export async function pairWebCapture(input: {
  browser: WebCaptureBrowser;
  code: string;
  device: string;
}) {
  const response = await request<WebCapturePairResponse>(
    "/api/web-capture/pair",
    { body: JSON.stringify(input), method: "POST" },
  );
  const stored: StoredWebCaptureLink = {
    browser: response.link.browser,
    device: response.link.device,
    id: response.link.id,
    lastSuccessfulSave: null,
    token: response.token,
  };
  await browser.storage.local.set({ [STORAGE_KEY]: stored });
  return stored;
}

export async function listWebCaptureTargets(token: string, search: string) {
  const query = new URLSearchParams();
  if (search.trim()) {
    query.set("search", search.trim());
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<WebCaptureTargetsResponse>(
    `/api/web-capture/inboxes${suffix}`,
    { method: "GET" },
    token,
  );
  return response.targets;
}

export async function sendWebCapture(
  token: string,
  draft: WebCaptureDraft,
  projectId: string | null,
) {
  const response = await request<{ sent: true }>(
    "/api/web-capture/send",
    {
      body: JSON.stringify({
        clientIdempotencyKey: crypto.randomUUID(),
        content: draft.content,
        kind: draft.kind,
        link: draft.link ?? null,
        mediaDataUrl: draft.mediaDataUrl ?? null,
        originUrl: draft.originUrl,
        projectId,
      }),
      method: "POST",
    },
    token,
  );
  const savedAt = new Date().toISOString();
  const stored = await getStoredWebCaptureLink();
  if (stored) {
    await browser.storage.local.set({
      [STORAGE_KEY]: { ...stored, lastSuccessfulSave: savedAt },
    });
  }
  return { ...response, savedAt };
}

export function getWebCaptureBrowser(): WebCaptureBrowser | null {
  const { userAgent } = navigator;
  if (BROWSER_FIREFOX_PATTERN.test(userAgent)) {
    return "Firefox";
  }
  if (BROWSER_EDGE_PATTERN.test(userAgent)) {
    return "Edge";
  }
  if ("brave" in navigator) {
    return "Brave";
  }
  if (BROWSER_ARC_PATTERN.test(userAgent)) {
    return "Arc";
  }
  if (BROWSER_CHROME_PATTERN.test(userAgent)) {
    return "Chrome";
  }
  return null;
}

export interface ActiveTabCapture {
  selectedImageUrl: string | null;
  selectedText: string;
  title: string;
  url: string;
}

export async function readActiveTab(readSelection = false) {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!(tab?.id && tab.url && HTTP_URL_PATTERN.test(tab.url))) {
    throw new Error("This page cannot be captured.");
  }
  const selection = readSelection
    ? (
        await browser.scripting.executeScript({
          func: () => {
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim() ?? "";
            const selectedImage =
              selection?.anchorNode?.parentElement?.closest("img") ??
              (document.activeElement instanceof HTMLImageElement
                ? document.activeElement
                : null);
            return {
              selectedImageUrl:
                selectedImage?.currentSrc || selectedImage?.src || null,
              selectedText,
            };
          },
          target: { tabId: tab.id },
        })
      )[0]?.result
    : undefined;
  return {
    selectedImageUrl: selection?.selectedImageUrl ?? null,
    selectedText: selection?.selectedText ?? "",
    title: tab.title ?? "",
    url: tab.url,
  } satisfies ActiveTabCapture;
}

export async function captureActiveTabScreenshot() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (typeof tab?.windowId !== "number") {
    throw new Error("This page cannot be captured.");
  }
  return browser.tabs.captureVisibleTab(tab.windowId, { format: "png" });
}
