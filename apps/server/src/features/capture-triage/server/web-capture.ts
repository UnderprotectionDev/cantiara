import {
  type CaptureInboxAccess,
  captureInboxItemSchema,
} from "@cantiara/api/capture-triage";
import {
  type NormalizedWebCaptureSendInput,
  WEB_CAPTURE_PAIRING_CODE_LIFETIME_MS,
  WEB_CAPTURE_STALE_LINK_AFTER_MS,
  type WebCaptureAccess,
  type WebCaptureBrowser,
  type WebCaptureLinkSummary,
  type WebCapturePairingCode,
  type WebCapturePairingInput,
  type WebCaptureSendInput,
  type WebCaptureSendReceipt,
  type WebCaptureTarget,
  webCapturePairingCodeSchema,
  webCapturePairingInputSchema,
  webCaptureSendInputSchema,
} from "@cantiara/api/web-capture";
import { CaptureInboxError } from "./capture-inbox";

const WEB_CAPTURE_PAIRING_CODE_PREFIX = "CANTIARA-";
const WEB_CAPTURE_TOKEN_BYTE_LENGTH = 32;
const IMAGE_DATA_URL_MIME_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,/u;

export interface WebCaptureLinkRecord extends WebCaptureLinkSummary {
  accountId: string;
  revokedAt: Date | null;
  tokenHash: string;
}

export interface WebCaptureStore {
  authorizeFinalization: (linkId: string, now: Date) => Promise<boolean>;
  consumePairingCodeAndCreateLink: (input: {
    browser: WebCaptureBrowser;
    codeHash: string;
    createdAt: Date;
    device: string;
    tokenHash: string;
  }) => Promise<WebCaptureLinkRecord | null>;
  createPairingCode: (input: {
    accountId: string;
    codeHash: string;
    createdAt: Date;
    expiresAt: Date;
  }) => Promise<void>;
  findCompleted: (
    accountId: string,
    clientIdempotencyKey: string,
  ) => Promise<{ fingerprint: string; receipt: WebCaptureSendReceipt } | null>;
  findLinkByToken: (tokenHash: string) => Promise<WebCaptureLinkRecord | null>;
  listLinks: (accountId: string) => Promise<WebCaptureLinkRecord[]>;
  markCompleted: (
    accountId: string,
    clientIdempotencyKey: string,
    value: { fingerprint: string; receipt: WebCaptureSendReceipt },
  ) => Promise<void>;
  revokeLink: (
    accountId: string,
    linkId: string,
    now: Date,
    actorAlias?: string,
  ) => Promise<void>;
  touchLink: (linkId: string, now: Date) => Promise<void>;
}

export interface WebCaptureProject {
  id: string;
  name: string;
  shortCode?: string;
}

export interface WebCaptureProjects {
  find: (
    accountId: string,
    projectId: string,
  ) => Promise<WebCaptureProject | null>;
  list: (accountId: string) => Promise<WebCaptureProject[]>;
}

export interface WebCaptureStagingStore {
  delete: (input: { accountId: string; attachmentId: string }) => Promise<void>;
  put: (input: {
    accountId: string;
    attachmentId: string;
    dataUrl: string;
  }) => Promise<void>;
}

export class WebCaptureError extends Error {
  readonly code: WebCaptureErrorCode;

  constructor(
    code: WebCaptureErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WebCaptureError";
    this.code = code;
  }
}

export type WebCaptureErrorCode =
  | "WEB_CAPTURE_IDEMPOTENCY_CONFLICT"
  | "WEB_CAPTURE_LINK_NOT_FOUND"
  | "WEB_CAPTURE_LINK_REVOKED"
  | "WEB_CAPTURE_PAIRING_INVALID"
  | "WEB_CAPTURE_REAUTH_REQUIRED"
  | "WEB_CAPTURE_STAGING_UNAVAILABLE"
  | "WEB_CAPTURE_TARGET_NOT_FOUND";

function createRandomToken() {
  return Buffer.from(
    crypto.getRandomValues(new Uint8Array(WEB_CAPTURE_TOKEN_BYTE_LENGTH)),
  ).toString("base64url");
}

function createPairingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const value = Buffer.from(bytes).toString("hex").toUpperCase();
  return `${WEB_CAPTURE_PAIRING_CODE_PREFIX}${value.slice(0, 4)}-${value.slice(4, 8)}`;
}

async function digest(value: string) {
  const result = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Buffer.from(result).toString("hex");
}

function operationFingerprint(value: unknown) {
  return digest(JSON.stringify(value));
}

function toLinkSummary(link: WebCaptureLinkRecord): WebCaptureLinkSummary {
  return {
    browser: link.browser,
    createdAt: link.createdAt,
    device: link.device,
    id: link.id,
    lastUse: link.lastUse,
  };
}

function captureAttachmentFor(
  input: NormalizedWebCaptureSendInput,
  attachmentId: string,
) {
  if (input.kind === "screenshot") {
    const mimeType = input.mediaDataUrl?.match(
      IMAGE_DATA_URL_MIME_PATTERN,
    )?.[1];
    if (!mimeType) {
      return;
    }
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice(6);
    return {
      id: attachmentId,
      mimeType,
      name: `Screenshot.${extension}`,
    };
  }
  if (input.kind === "selected-image" && input.mediaDataUrl) {
    const mimeType = input.mediaDataUrl.match(IMAGE_DATA_URL_MIME_PATTERN)?.[1];
    if (!mimeType) {
      return;
    }
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice(6);
    return {
      id: attachmentId,
      mimeType,
      name: `Selected image.${extension}`,
    };
  }
}

async function stageMedia(
  staging: WebCaptureStagingStore | undefined,
  accountId: string,
  attachmentId: string,
  dataUrl: string | null | undefined,
) {
  if (!dataUrl) {
    return;
  }
  if (!staging) {
    throw new WebCaptureError(
      "WEB_CAPTURE_STAGING_UNAVAILABLE",
      "Screenshot staging is not available.",
    );
  }
  try {
    await staging.put({ accountId, attachmentId, dataUrl });
  } catch (error) {
    // biome-ignore lint/style/useErrorCause: WebCaptureError forwards ErrorOptions to Error.
    throw new WebCaptureError(
      "WEB_CAPTURE_STAGING_UNAVAILABLE",
      "Screenshot staging is not available.",
      { cause: error },
    );
  }
}

function mapCaptureInboxError(error: unknown) {
  if (!(error instanceof CaptureInboxError)) {
    return null;
  }
  if (error.code === "CAPTURE_IDEMPOTENCY_CONFLICT") {
    return new WebCaptureError(
      "WEB_CAPTURE_IDEMPOTENCY_CONFLICT",
      "The Web Capture key was already used for different content.",
      { cause: error },
    );
  }
  if (error.code === "CAPTURE_STAGING_UNAVAILABLE") {
    return new WebCaptureError(
      "WEB_CAPTURE_STAGING_UNAVAILABLE",
      "Screenshot staging is not available.",
      { cause: error },
    );
  }
  return null;
}

export function createWebCapture({
  captureInbox,
  now = () => new Date(),
  projects,
  randomPairingCode = createPairingCode,
  randomToken = createRandomToken,
  staging,
  store,
}: {
  captureInbox: Pick<CaptureInboxAccess, "create">;
  now?: () => Date;
  projects: WebCaptureProjects;
  randomPairingCode?: () => string;
  randomToken?: () => string;
  staging?: WebCaptureStagingStore;
  store: WebCaptureStore;
}): WebCaptureAccess {
  async function requireLink(token: string, currentTime: Date) {
    const tokenHash = await digest(token);
    const link = await store.findLinkByToken(tokenHash);
    if (!link) {
      throw new WebCaptureError(
        "WEB_CAPTURE_LINK_NOT_FOUND",
        "This Web Capture link is not available.",
      );
    }
    if (link.revokedAt) {
      throw new WebCaptureError(
        "WEB_CAPTURE_LINK_REVOKED",
        "This Web Capture link was revoked.",
      );
    }
    const lastActivity = link.lastUse
      ? new Date(link.lastUse)
      : new Date(link.createdAt);
    if (
      currentTime.getTime() - lastActivity.getTime() >=
      WEB_CAPTURE_STALE_LINK_AFTER_MS
    ) {
      throw new WebCaptureError(
        "WEB_CAPTURE_REAUTH_REQUIRED",
        "This Web Capture link needs re-authorization before it can write.",
      );
    }
    return link;
  }

  async function targetFor(accountId: string, projectId: string | null) {
    if (!projectId) {
      return {
        id: "workspace",
        label: "Workspace Capture Inbox" as const,
        name: "Workspace",
        projectId: null,
      } satisfies WebCaptureTarget;
    }
    const project = await projects.find(accountId, projectId);
    if (!project) {
      throw new WebCaptureError(
        "WEB_CAPTURE_TARGET_NOT_FOUND",
        "The selected Target Inbox is not available.",
      );
    }
    return {
      id: project.id,
      label: "Project Capture Inbox" as const,
      name: project.name,
      projectId: project.id,
    } satisfies WebCaptureTarget;
  }

  return {
    async createPairingCode(accountId: string): Promise<WebCapturePairingCode> {
      const createdAt = now();
      const expiresAt = new Date(
        createdAt.getTime() + WEB_CAPTURE_PAIRING_CODE_LIFETIME_MS,
      );
      const code = webCapturePairingCodeSchema.parse(randomPairingCode());
      await store.createPairingCode({
        accountId,
        codeHash: await digest(code),
        createdAt,
        expiresAt,
      });
      return { code, expiresAt: expiresAt.toISOString() };
    },

    async listLinks(accountId: string) {
      const links = await store.listLinks(accountId);
      return links.map(toLinkSummary);
    },

    async listTargets(token: string, search = "") {
      const link = await requireLink(token, now());
      const normalizedSearch = search.trim().toLocaleLowerCase("en-US");
      const targets: WebCaptureTarget[] = [
        {
          id: "workspace",
          label: "Workspace Capture Inbox",
          name: "Workspace",
          projectId: null,
        },
        ...(await projects.list(link.accountId)).map((project) => ({
          id: project.id,
          label: "Project Capture Inbox" as const,
          name: project.name,
          projectId: project.id,
        })),
      ];
      if (!normalizedSearch) {
        return targets;
      }
      return targets.filter((target) =>
        `${target.name} ${target.id}`
          .toLocaleLowerCase("en-US")
          .includes(normalizedSearch),
      );
    },

    async pair(input: WebCapturePairingInput, currentTime = now()) {
      const parsed = webCapturePairingInputSchema.parse(input);
      const token = randomToken();
      const link = await store.consumePairingCodeAndCreateLink({
        browser: parsed.browser,
        codeHash: await digest(parsed.code),
        createdAt: currentTime,
        device: parsed.device,
        tokenHash: await digest(token),
      });
      if (!link) {
        throw new WebCaptureError(
          "WEB_CAPTURE_PAIRING_INVALID",
          "This Pairing code is invalid, expired, or already used.",
        );
      }
      return { link: toLinkSummary(link), token };
    },

    async revokeLink(accountId: string, linkId: string, actorAlias?: string) {
      await store.revokeLink(accountId, linkId, now(), actorAlias);
    },

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Web Capture send coordinates authorization, idempotency, staging, commit, and cleanup boundaries.
    async send(
      token: string,
      input: WebCaptureSendInput,
      currentTime = now(),
    ): Promise<WebCaptureSendReceipt> {
      const link = await requireLink(token, currentTime);
      const parsed = webCaptureSendInputSchema.parse(input);
      const fingerprint = await operationFingerprint(parsed);
      const existing = await store.findCompleted(
        link.accountId,
        parsed.clientIdempotencyKey,
      );
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new WebCaptureError(
            "WEB_CAPTURE_IDEMPOTENCY_CONFLICT",
            "The Web Capture key was already used for different content.",
          );
        }
        await store.touchLink(link.id, currentTime);
        return existing.receipt;
      }

      const targetInbox = await targetFor(link.accountId, parsed.projectId);
      const attachmentId = `web-capture-${await digest(`${link.id}:${parsed.clientIdempotencyKey}`)}`;
      const attachment = captureAttachmentFor(parsed, attachmentId);
      await stageMedia(
        staging,
        link.accountId,
        attachmentId,
        parsed.mediaDataUrl,
      );

      if (!(await store.authorizeFinalization(link.id, currentTime))) {
        if (parsed.mediaDataUrl && staging) {
          await staging.delete({
            accountId: link.accountId,
            attachmentId,
          });
        }
        throw new WebCaptureError(
          "WEB_CAPTURE_LINK_REVOKED",
          "This Web Capture link was revoked.",
        );
      }

      let captureCommitted = false;
      try {
        const createdCapture = await captureInbox.create(link.accountId, {
          attachment,
          clientIdempotencyKey: parsed.clientIdempotencyKey,
          content: parsed.content,
          fields: {},
          link: parsed.link ?? parsed.originUrl,
          origin: { kind: "Web Capture", url: parsed.originUrl },
          projectId: parsed.projectId,
          template: null,
        });
        captureCommitted = true;
        const capture = captureInboxItemSchema.parse(createdCapture);
        const receipt: WebCaptureSendReceipt = {
          capture,
          itemId: capture.id,
          sent: true,
          targetInbox,
        };
        await store.markCompleted(link.accountId, parsed.clientIdempotencyKey, {
          fingerprint,
          receipt,
        });
        await store.touchLink(link.id, currentTime);
        return receipt;
      } catch (error) {
        const preservesExistingCapture =
          error instanceof CaptureInboxError &&
          error.code === "CAPTURE_IDEMPOTENCY_CONFLICT";
        if (
          !(captureCommitted || preservesExistingCapture) &&
          parsed.mediaDataUrl &&
          staging
        ) {
          await staging.delete({
            accountId: link.accountId,
            attachmentId,
          });
        }
        const mappedError = mapCaptureInboxError(error);
        if (mappedError) {
          throw mappedError;
        }
        throw error;
      }
    },
  } satisfies WebCaptureAccess;
}
