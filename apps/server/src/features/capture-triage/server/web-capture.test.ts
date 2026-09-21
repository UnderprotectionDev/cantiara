import type {
  CaptureInboxAccess,
  CaptureInboxItem,
  CaptureInput,
} from "@cantiara/api/capture-triage";
import { captureInputSchema } from "@cantiara/api/capture-triage";
import {
  WEB_CAPTURE_PAIRING_CODE_LIFETIME_MS,
  WEB_CAPTURE_STALE_LINK_AFTER_MS,
  type WebCaptureAccess,
  type WebCaptureLinkSummary,
  type WebCapturePairingInput,
  type WebCaptureSendInput,
  type WebCaptureSendReceipt,
  type WebCaptureTarget,
} from "@cantiara/api/web-capture";
import { describe, expect, test, vi } from "vitest";
import { CaptureInboxError } from "./capture-inbox";
import { createWebCapture, type WebCaptureStagingStore } from "./web-capture";

const NOW = new Date("2026-09-18T09:00:00.000Z");

function createMemoryWebCaptureStore() {
  const pairingCodes = new Map<
    string,
    { accountId: string; expiresAt: Date; consumedAt: Date | null }
  >();
  const links = new Map<
    string,
    {
      accountId: string;
      browser: WebCaptureLinkSummary["browser"];
      createdAt: Date;
      device: string;
      lastUse: Date | null;
      revokedAt: Date | null;
      tokenHash: string;
    }
  >();
  const completed = new Map<
    string,
    { fingerprint: string; receipt: WebCaptureSendReceipt }
  >();
  let pairingCode = "CANTIARA-AB12-CD34";
  let token = "extension-token-1";
  let failLinkCreation = false;

  return {
    store: {
      authorizeFinalization: vi.fn((id: string, now: Date) => {
        const link = links.get(id);
        if (!link || link.revokedAt) {
          return Promise.resolve(false);
        }
        const lastActivity = link.lastUse ?? link.createdAt;
        if (
          now.getTime() - lastActivity.getTime() >=
          WEB_CAPTURE_STALE_LINK_AFTER_MS
        ) {
          return Promise.resolve(false);
        }
        link.lastUse = now;
        return Promise.resolve(true);
      }),
      consumePairingCodeAndCreateLink: vi.fn(
        (input: {
          browser: WebCaptureLinkSummary["browser"];
          codeHash: string;
          createdAt: Date;
          device: string;
          tokenHash: string;
        }) => {
          const record = pairingCodes.get(input.codeHash);
          if (
            !record ||
            record.consumedAt ||
            record.expiresAt <= input.createdAt
          ) {
            return Promise.resolve(null);
          }
          if (failLinkCreation) {
            return Promise.reject(new Error("link creation failed"));
          }
          record.consumedAt = input.createdAt;
          const id = `link-${links.size + 1}`;
          links.set(id, {
            accountId: record.accountId,
            browser: input.browser,
            createdAt: input.createdAt,
            device: input.device,
            lastUse: null,
            revokedAt: null,
            tokenHash: input.tokenHash,
          });
          return Promise.resolve({
            accountId: record.accountId,
            browser: input.browser,
            createdAt: input.createdAt.toISOString(),
            device: input.device,
            id,
            lastUse: null,
            revokedAt: null,
            tokenHash: input.tokenHash,
          });
        },
      ),
      createPairingCode: vi.fn(
        (input: { accountId: string; codeHash: string; expiresAt: Date }) => {
          pairingCodes.set(input.codeHash, {
            accountId: input.accountId,
            expiresAt: input.expiresAt,
            consumedAt: null,
          });
          return Promise.resolve();
        },
      ),
      findLinkByToken: vi.fn((tokenHash: string) => {
        for (const [id, link] of links) {
          if (link.tokenHash === tokenHash) {
            return Promise.resolve({
              ...link,
              createdAt: link.createdAt.toISOString(),
              id,
              lastUse: link.lastUse?.toISOString() ?? null,
            });
          }
        }
        return Promise.resolve(null);
      }),
      findCompleted: vi.fn((accountId: string, key: string) =>
        Promise.resolve(completed.get(`${accountId}:${key}`) ?? null),
      ),
      listLinks: vi.fn((accountId: string) =>
        Promise.resolve(
          [...links.entries()]
            .filter(([, link]) => link.accountId === accountId)
            .map(([id, link]) => ({
              ...link,
              createdAt: link.createdAt.toISOString(),
              id,
              lastUse: link.lastUse?.toISOString() ?? null,
            })),
        ),
      ),
      markCompleted: vi.fn(
        (
          accountId: string,
          key: string,
          value: { fingerprint: string; receipt: WebCaptureSendReceipt },
        ) => {
          completed.set(`${accountId}:${key}`, value);
          return Promise.resolve();
        },
      ),
      revokeLink: vi.fn((accountId: string, id: string) => {
        const link = links.get(id);
        if (link?.accountId === accountId) {
          link.revokedAt = NOW;
        }
        return Promise.resolve();
      }),
      touchLink: vi.fn((id: string, now: Date) => {
        const link = links.get(id);
        if (link) {
          link.lastUse = now;
        }
        return Promise.resolve();
      }),
      nextPairingCode: () => pairingCode,
      nextToken: () => token,
      setPairingCode: (value: string) => {
        pairingCode = value;
      },
      setFailLinkCreation: (value: boolean) => {
        failLinkCreation = value;
      },
      setToken: (value: string) => {
        token = value;
      },
      targets: [
        {
          id: "workspace",
          label: "Workspace Capture Inbox",
          name: "Workspace",
          projectId: null,
        },
        {
          id: "project-1",
          label: "Project Capture Inbox",
          name: "Cantiara",
          projectId: "project-1",
        },
        {
          id: "project-2",
          label: "Project Capture Inbox",
          name: "Other Project",
          projectId: "project-2",
        },
      ] satisfies WebCaptureTarget[],
    },
    pairingCodes,
    links,
  };
}

function createCaptureInbox() {
  const captures: CaptureInboxItem[] = [];
  const captureInbox = {
    create: vi.fn((_accountId: string, input: CaptureInput) => {
      const normalized = captureInputSchema.parse(input);
      const capture: CaptureInboxItem = {
        attachment: normalized.attachment ?? null,
        content: normalized.content,
        createdAt: NOW.toISOString(),
        fields: normalized.fields,
        id: `capture-${captures.length + 1}`,
        link: normalized.link ?? null,
        origin: normalized.origin ?? null,
        projectId: normalized.projectId,
        template: normalized.template,
      };
      captures.push(capture);
      return Promise.resolve(capture);
    }),
  } as unknown as Pick<CaptureInboxAccess, "create">;
  return { captureInbox, captures };
}

const pairingInput: WebCapturePairingInput = {
  browser: "Firefox",
  code: "CANTIARA-AB12-CD34",
  device: "Founder Mac",
};

const sendInput: WebCaptureSendInput = {
  clientIdempotencyKey: "capture-key-1",
  content: "Selected text",
  kind: "selected-text",
  link: "https://example.com/article",
  originUrl: "https://example.com/article",
  projectId: "project-1",
};

function createSubject(staging?: WebCaptureStagingStore) {
  const memory = createMemoryWebCaptureStore();
  const { captureInbox, captures } = createCaptureInbox();
  const access = createWebCapture({
    captureInbox,
    now: () => NOW,
    projects: {
      find: vi.fn(async (_accountId, projectId) =>
        memory.store.targets.find((target) => target.projectId === projectId)
          ? { id: projectId, name: projectId }
          : null,
      ),
      list: vi.fn(async () => memory.store.targets),
    },
    randomPairingCode: memory.store.nextPairingCode,
    randomToken: memory.store.nextToken,
    staging,
    store: memory.store,
  });
  return { access, captureInbox, captures, memory };
}

async function pair(access: WebCaptureAccess) {
  await access.createPairingCode("account-1");
  return access.pair(pairingInput, NOW);
}

describe("Web Capture seam", () => {
  test("creates a five-minute pairing code", async () => {
    const { access } = createSubject();
    const code = await access.createPairingCode("account-1");

    expect(code.expiresAt).toBe(
      new Date(
        NOW.getTime() + WEB_CAPTURE_PAIRING_CODE_LIFETIME_MS,
      ).toISOString(),
    );
  });

  test("does not consume a pairing code when atomic link creation fails", async () => {
    const { access, memory } = createSubject();
    await access.createPairingCode("account-1");
    memory.store.setFailLinkCreation(true);

    await expect(access.pair(pairingInput, NOW)).rejects.toThrow(
      "link creation failed",
    );

    memory.store.setFailLinkCreation(false);
    await expect(access.pair(pairingInput, NOW)).resolves.toMatchObject({
      link: { id: "link-1" },
    });
  });

  test("uses a pairing code once and never exposes the code in the capture payload", async () => {
    const { access, captures } = createSubject();
    const paired = await pair(access);

    await expect(access.pair(pairingInput, NOW)).rejects.toMatchObject({
      code: "WEB_CAPTURE_PAIRING_INVALID",
    });
    await access.send(paired.token, sendInput, NOW);

    expect(captures[0]).toMatchObject({
      content: "Selected text",
      link: "https://example.com/article",
      origin: { kind: "Web Capture", url: "https://example.com/article" },
      projectId: "project-1",
    });
    expect(JSON.stringify(captures[0])).not.toContain(pairingInput.code);
    expect(JSON.stringify(captures[0])).not.toContain(paired.token);
  });

  test("requires re-authorization after 30 days without use and rejects revoked links", async () => {
    const { access, memory } = createSubject();
    const paired = await pair(access);
    const staleAt = new Date(
      NOW.getTime() + WEB_CAPTURE_STALE_LINK_AFTER_MS + 1,
    );

    await expect(
      access.send(paired.token, sendInput, staleAt),
    ).rejects.toMatchObject({ code: "WEB_CAPTURE_REAUTH_REQUIRED" });

    await access.revokeLink("account-1", "link-1");
    await expect(
      access.send(paired.token, sendInput, NOW),
    ).rejects.toMatchObject({ code: "WEB_CAPTURE_LINK_REVOKED" });
    expect(memory.store.touchLink).not.toHaveBeenCalled();
  });

  test("returns the previous result for an idempotent retry and conflicts on changed content", async () => {
    const { access, captures } = createSubject();
    const paired = await pair(access);

    const first = await access.send(paired.token, sendInput, NOW);
    const retry = await access.send(paired.token, sendInput, NOW);
    expect(retry).toEqual(first);
    expect(captures).toHaveLength(1);

    await expect(
      access.send(
        paired.token,
        { ...sendInput, content: "Changed selected text" },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "WEB_CAPTURE_IDEMPOTENCY_CONFLICT" });
  });

  test("stages a user-started screenshot without putting its data URL in the Inbox payload", async () => {
    const staging = {
      delete: vi.fn(),
      put: vi.fn(),
    } satisfies WebCaptureStagingStore;
    const { access, captures } = createSubject(staging);
    const paired = await pair(access);

    await access.send(
      paired.token,
      {
        clientIdempotencyKey: "screenshot-key",
        content: "Screenshot of the active tab",
        kind: "screenshot",
        mediaDataUrl: "data:image/png;base64,AA==",
        originUrl: "https://example.com/article",
        projectId: null,
      },
      NOW,
    );

    expect(staging.put).toHaveBeenCalledWith({
      accountId: "account-1",
      attachmentId:
        "web-capture-840eebf06cddb084fa2e868bb90a1f8627005282aa378fb31ba398a2cc372151",
      dataUrl: "data:image/png;base64,AA==",
    });
    expect(JSON.stringify(captures[0])).not.toContain("data:image/png");
    expect(captures[0]?.attachment).toMatchObject({
      id: "web-capture-840eebf06cddb084fa2e868bb90a1f8627005282aa378fb31ba398a2cc372151",
      mimeType: "image/png",
    });
  });

  test("keeps selected-image metadata compatible with File Attachment validation", async () => {
    const staging = {
      delete: vi.fn(),
      put: vi.fn(),
    } satisfies WebCaptureStagingStore;
    const { access, captures } = createSubject(staging);
    const paired = await pair(access);

    await access.send(
      paired.token,
      {
        clientIdempotencyKey: "selected-image-key",
        content: "Selected image",
        kind: "selected-image",
        link: "https://example.com/article",
        mediaDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgAB",
        originUrl: "https://example.com/article",
        projectId: "project-1",
      },
      NOW,
    );

    expect(captures[0]?.attachment).toMatchObject({
      mimeType: "image/jpeg",
      name: "Selected image.jpg",
    });
    expect(captures[0]?.attachment).not.toHaveProperty("sourceUrl");
  });

  test("does not create an Inbox item when the link is revoked before finalization", async () => {
    let access!: WebCaptureAccess;
    const staging = {
      delete: vi.fn(),
      put: vi.fn(async () => {
        await access.revokeLink("account-1", "link-1");
      }),
    } satisfies WebCaptureStagingStore;
    const subject = createSubject(staging);
    ({ access } = subject);
    const paired = await pair(access);

    await expect(
      access.send(
        paired.token,
        {
          ...sendInput,
          clientIdempotencyKey: "revoked-before-finalize",
          kind: "screenshot",
          mediaDataUrl: "data:image/png;base64,AA==",
          projectId: null,
        },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "WEB_CAPTURE_LINK_REVOKED" });
    expect(subject.captures).toHaveLength(0);
    expect(staging.delete).toHaveBeenCalledWith({
      accountId: "account-1",
      attachmentId:
        "web-capture-c52350c6627d7d2dd4e381311faf9f43fa0103b1d8b2b36c0c100414b1b7bae5",
    });
  });

  test("keeps a committed attachment when completion bookkeeping fails", async () => {
    const staging = {
      delete: vi.fn(),
      put: vi.fn(),
    } satisfies WebCaptureStagingStore;
    const { access, captures, memory } = createSubject(staging);
    const paired = await pair(access);
    memory.store.touchLink.mockRejectedValueOnce(
      new Error("link activity unavailable"),
    );

    await expect(
      access.send(
        paired.token,
        {
          ...sendInput,
          clientIdempotencyKey: "bookkeeping-failure",
          kind: "screenshot",
          mediaDataUrl: "data:image/png;base64,AA==",
          projectId: null,
        },
        NOW,
      ),
    ).rejects.toThrow("link activity unavailable");
    expect(captures).toHaveLength(1);
    expect(staging.delete).not.toHaveBeenCalled();
  });

  test("does not delete an existing attachment after an idempotency conflict", async () => {
    const staging = {
      delete: vi.fn(),
      put: vi.fn(),
    } satisfies WebCaptureStagingStore;
    const subject = createSubject(staging);
    const paired = await pair(subject.access);
    vi.mocked(subject.captureInbox.create).mockRejectedValueOnce(
      new CaptureInboxError(
        "CAPTURE_IDEMPOTENCY_CONFLICT",
        "The capture key was already used for different content.",
      ),
    );

    await expect(
      subject.access.send(
        paired.token,
        {
          ...sendInput,
          clientIdempotencyKey: "existing-attachment",
          kind: "screenshot",
          mediaDataUrl: "data:image/png;base64,AA==",
          projectId: null,
        },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "WEB_CAPTURE_IDEMPOTENCY_CONFLICT" });
    expect(staging.delete).not.toHaveBeenCalled();
  });

  test("searches every authorized Project Inbox instead of only recent Projects", async () => {
    const { access } = createSubject();
    const paired = await pair(access);

    await expect(access.listTargets(paired.token, "Other")).resolves.toEqual([
      {
        id: "project-2",
        label: "Project Capture Inbox",
        name: "Other Project",
        projectId: "project-2",
      },
    ]);
  });
});
