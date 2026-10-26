import {
  WEB_CAPTURE_BROWSERS,
  type WebCaptureBrowser,
  type WebCaptureKind,
} from "@cantiara/api/web-capture";
import { browser } from "wxt/browser";
import { z } from "zod";

export const WEB_CAPTURE_SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

const BROWSER_ARC_PATTERN = /Arc\//;
const BROWSER_CHROME_PATTERN = /Chrome\//;
const BROWSER_EDGE_PATTERN = /Edg\//;
const BROWSER_FIREFOX_PATTERN = /Firefox\//;
const HTTP_URL_PATTERN = /^https?:\/\//;
const SERVER_URL_TRAILING_SLASH_PATTERN = /\/$/;

const webCaptureBrowserSchema = z.enum(WEB_CAPTURE_BROWSERS);

const webCaptureLinkSchema = z.object({
  browser: webCaptureBrowserSchema,
  createdAt: z.string(),
  device: z.string(),
  id: z.string(),
  lastUse: z.string().nullable(),
});

export type WebCaptureLink = z.infer<typeof webCaptureLinkSchema>;

const webCaptureTargetSchema = z.object({
  id: z.string(),
  label: z.enum(["Project Capture Inbox", "Workspace Capture Inbox"]),
  name: z.string(),
  projectId: z.string().nullable(),
});

export type WebCaptureTarget = z.infer<typeof webCaptureTargetSchema>;

export interface WebCaptureDraft {
  clientIdempotencyKey: string;
  content: string;
  kind: WebCaptureKind;
  link?: string;
  mediaDataUrl?: string;
  originUrl: string;
}

const storedWebCaptureLinkSchema = z.object({
  browser: webCaptureBrowserSchema,
  device: z.string(),
  id: z.string(),
  lastSuccessfulSave: z.string().nullable(),
  token: z.string(),
});

export type StoredWebCaptureLink = z.infer<typeof storedWebCaptureLinkSchema>;

const webCapturePairResponseSchema = z.object({
  link: webCaptureLinkSchema,
  token: z.string(),
});

const webCaptureTargetsResponseSchema = z.object({
  targets: z.array(webCaptureTargetSchema),
});

const webCaptureSendResponseSchema = z.object({ sent: z.literal(true) });

const webCaptureErrorPayloadSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});

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

async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  init: RequestInit = {},
  token?: string,
): Promise<z.output<T>> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const response = await fetch(endpoint(path), {
    ...init,
    headers,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = webCaptureErrorPayloadSchema.safeParse(payload);
    throw new WebCaptureApiError(
      (failure.success && failure.data.code) || "WEB_CAPTURE_UNAVAILABLE",
      response.status,
      failure.success ? failure.data.message : undefined,
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new WebCaptureApiError(
      "WEB_CAPTURE_UNAVAILABLE",
      response.status,
      "Web Capture returned an unexpected response.",
    );
  }
  return parsed.data;
}

export async function getStoredWebCaptureLink() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const parsed = storedWebCaptureLinkSchema.safeParse(result[STORAGE_KEY]);
  return parsed.success ? parsed.data : null;
}

export async function clearStoredWebCaptureLink() {
  await browser.storage.local.remove(STORAGE_KEY);
}

export async function pairWebCapture(input: {
  browser: WebCaptureBrowser;
  code: string;
  device: string;
}) {
  const response = await request(
    "/api/web-capture/pair",
    webCapturePairResponseSchema,
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
  const response = await request(
    `/api/web-capture/inboxes${suffix}`,
    webCaptureTargetsResponseSchema,
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
  const response = await request(
    "/api/web-capture/send",
    webCaptureSendResponseSchema,
    {
      body: JSON.stringify({
        clientIdempotencyKey: draft.clientIdempotencyKey,
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
