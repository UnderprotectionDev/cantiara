import { z } from "zod";

import { type CaptureInboxItem, captureUrlSchema } from "./capture-triage";

export const WEB_CAPTURE_BROWSERS = [
  "Chrome",
  "Edge",
  "Brave",
  "Arc",
  "Firefox",
] as const;

export type WebCaptureBrowser = (typeof WEB_CAPTURE_BROWSERS)[number];

export const WEB_CAPTURE_KINDS = [
  "url",
  "selected-text",
  "selected-image",
  "screenshot",
] as const;

export type WebCaptureKind = (typeof WEB_CAPTURE_KINDS)[number];

export const WEB_CAPTURE_PAIRING_CODE_LIFETIME_MS = 5 * 60 * 1000;
export const WEB_CAPTURE_STALE_LINK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const identifierSchema = z.string().trim().min(1).max(255);
const webCaptureBrowserSchema = z.enum(WEB_CAPTURE_BROWSERS);
const webCaptureKindSchema = z.enum(WEB_CAPTURE_KINDS);

export const webCapturePairingCodeSchema = z
  .string()
  .trim()
  .regex(/^CANTIARA-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

export const webCapturePairingInputSchema = z
  .object({
    browser: webCaptureBrowserSchema,
    code: webCapturePairingCodeSchema,
    device: z.string().trim().min(1).max(255),
  })
  .strict();

export type WebCapturePairingInput = z.infer<
  typeof webCapturePairingInputSchema
>;

export const webCaptureSendInputSchema = z
  .object({
    clientIdempotencyKey: identifierSchema,
    content: z.string().max(100_000),
    kind: webCaptureKindSchema,
    link: captureUrlSchema.nullable().optional(),
    mediaDataUrl: z
      .string()
      .trim()
      .max(8_000_000)
      .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
      .nullable()
      .optional(),
    originUrl: captureUrlSchema,
    projectId: identifierSchema.nullable().default(null),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.kind === "screenshot" && !input.mediaDataUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Screenshots require a staged image.",
        path: ["mediaDataUrl"],
      });
    }
  });

export type WebCaptureSendInput = z.input<typeof webCaptureSendInputSchema>;
export type NormalizedWebCaptureSendInput = z.output<
  typeof webCaptureSendInputSchema
>;

export interface WebCapturePairingCode {
  code: string;
  expiresAt: string;
}

export interface WebCaptureLinkSummary {
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

export interface WebCaptureSendReceipt {
  capture: CaptureInboxItem;
  itemId: string;
  sent: true;
  targetInbox: WebCaptureTarget;
}

export interface WebCaptureAccess {
  createPairingCode: (accountId: string) => Promise<WebCapturePairingCode>;
  listLinks: (accountId: string) => Promise<WebCaptureLinkSummary[]>;
  listTargets: (token: string, search?: string) => Promise<WebCaptureTarget[]>;
  pair: (
    input: WebCapturePairingInput,
    now?: Date,
  ) => Promise<{ link: WebCaptureLinkSummary; token: string }>;
  revokeLink: (accountId: string, linkId: string) => Promise<void>;
  send: (
    token: string,
    input: WebCaptureSendInput,
    now?: Date,
  ) => Promise<WebCaptureSendReceipt>;
}
