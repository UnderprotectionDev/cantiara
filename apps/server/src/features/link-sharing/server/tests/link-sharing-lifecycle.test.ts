// biome-ignore-all lint/performance/useTopLevelRegex: Inline patterns assert one rendered string each.
// biome-ignore-all lint/suspicious/noMisplacedAssertion: expectGone is the shared 410 assertion helper.
// biome-ignore-all lint/performance/noAwaitInLoops: Each share must reach the audit count before the next one.
import {
  LinkSharingEventLogError,
  LinkSharingRateLimitError,
} from "@cantiara/api/link-sharing";
import { describe, expect, test } from "vitest";

import { createLinkSharing, type ShareSource } from "../link-sharing";
import {
  createLinkSharingAssets,
  type LinkSharingAssetCache,
  parseByteRange,
} from "../link-sharing-assets";
import {
  SHARE_CHANGE_LIMIT,
  SHARE_CHANGE_WINDOW_MS,
} from "../link-sharing-audit";
import { sha256Hex } from "../link-sharing-credentials";
import { createLinkSharingVisitorRoutes } from "../link-sharing-http";
import { createMemoryLinkSharing } from "../link-sharing-memory-store";
import { createLinkSharingReplay } from "../link-sharing-replay";
import { createLinkSharingVisitor } from "../link-sharing-visitor";

/**
 * Spec 73 #484 at the Link Sharing seam: expiry is not revoke, a revoked or
 * unpublished URL answers an empty-body `410 Gone` + `noindex`, and neither a
 * cache nor the object store is read before the current surface, session and
 * exact file version are authorized. Object storage and the cache are test
 * doubles that fail the test when they are read after a refusal.
 */

const ACCOUNT = "account-1";
const ORIGIN = "https://api.cantiara.example";
const START = new Date("2026-10-29T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const FILE_BYTES = new TextEncoder().encode("0123456789abcdefghij");

const root = { id: "d1", kind: "Document" as const };
const source: ShareSource = {
  blockers: [],
  members: [],
  projectId: "project-1",
  record: {
    fields: [
      { key: "body", kind: "markdown", label: "Body", value: "Plan body" },
    ],
    id: "d1",
    kind: "Document",
    parts: [
      {
        detail: "Version 1 · spec.pdf · application/pdf",
        id: "attachment:att1:ver1",
        kind: "Attachment",
        label: "File Attachment: Spec",
      },
    ],
    title: "Plan",
  },
};
const approvedItemIds = [
  "record:Document:d1",
  "field:Document:d1:title",
  "field:Document:d1:body",
  "part:Document:d1:attachment:att1:ver1",
];

const fastHasher = {
  hash: (password: string) => Promise.resolve(`fast$${password}`),
  verify: (password: string, stored: string | null) =>
    Promise.resolve(stored === `fast$${password}`),
};

async function sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function setup() {
  let current = START;
  const clock = {
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
    now: () => current,
  };
  const harness = createMemoryLinkSharing({
    accountId: ACCOUNT,
    sources: [{ root, source }],
  });
  harness.files.set("att1:ver1", {
    byteSize: FILE_BYTES.byteLength,
    contentHash: await sha256Bytes(FILE_BYTES),
    fileName: "spec.pdf",
    mimeType: "application/pdf",
    objectKey: "objects/att1-ver1",
  });
  const founder = createLinkSharing(harness.store, {
    audit: harness.audit,
    events: harness.securityEvents,
    hasher: fastHasher,
    now: clock.now,
  });
  const visitor = createLinkSharingVisitor(harness.visitorStore, {
    audit: harness.audit,
    hasher: fastHasher,
    now: clock.now,
    rateSecret: "rate-secret-for-tests",
  });
  // Storage and cache doubles record every read; a refused request must show none.
  const reads: string[] = [];
  const cacheReads: string[] = [];
  const cacheStore = new Map<string, Uint8Array>();
  const cache: LinkSharingAssetCache = {
    get(key) {
      cacheReads.push(key);
      return Promise.resolve(cacheStore.get(key));
    },
    set(key, bytes) {
      cacheStore.set(key, bytes);
      return Promise.resolve();
    },
  };
  const assets = createLinkSharingAssets({
    cache,
    objects: {
      read(key) {
        reads.push(key);
        return Promise.resolve(key === "objects/att1-ver1" ? FILE_BYTES : null);
      },
    },
    visitor,
  });
  const routes = createLinkSharingVisitorRoutes({
    assets,
    networkOf: () => "203.0.113.7",
    visitor,
  });
  return {
    assets,
    cache,
    cacheReads,
    cacheStore,
    clock,
    founder,
    harness,
    reads,
    routes,
    visitor,
  };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function share(founder: Setup["founder"], id = "approval-1") {
  const approved = await founder.approve(ACCOUNT, {
    approvalId: id,
    approvedItemIds,
    liveItemIds: [],
    publishAnyway: false,
    root,
  });
  if (!approved?.accessToken) {
    throw new Error("no token minted");
  }
  return { surfaceId: approved.surfaceId, token: approved.accessToken };
}

const cookieOf = (response: Response) =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

async function enter(routes: Setup["routes"], token: string) {
  const response = await routes.request(`${ORIGIN}/s/${token}`);
  return { cookie: cookieOf(response), response };
}

const filePath = (surfaceId: string) => `/shared/${surfaceId}/files/att1/ver1`;

const getPath = (
  routes: Setup["routes"],
  path: string,
  cookie?: string,
  range?: string,
) =>
  routes.request(`${ORIGIN}${path}`, {
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(range ? { range } : {}),
    },
  });

function expectGone(response: Response, body: string) {
  expect(response.status).toBe(410);
  expect(body).toBe("");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("cache-control")).toBe("no-store");
}

const future = (clock: Setup["clock"], ms: number) =>
  new Date(clock.now().getTime() + ms).toISOString();

describe("expiry is not revoke", () => {
  test("there is no default expiry and a founder can extend before it passes", async () => {
    const { clock, founder } = await setup();
    const { surfaceId } = await share(founder);
    const preview = await founder.preview(ACCOUNT, { root });
    expect(preview?.surface).toMatchObject({
      expiresAt: null,
      state: "Active",
    });

    const first = future(clock, DAY);
    expect(
      await founder.setExpiry(ACCOUNT, { expiresAt: first, surfaceId }),
    ).toMatchObject({ expiresAt: first, state: "Active" });
    const extended = future(clock, 3 * DAY);
    expect(
      await founder.setExpiry(ACCOUNT, { expiresAt: extended, surfaceId }),
    ).toMatchObject({ expiresAt: extended });
    expect(
      await founder.setExpiry(ACCOUNT, { expiresAt: null, surfaceId }),
    ).toMatchObject({ expiresAt: null, state: "Active" });
    await expect(
      founder.setExpiry(ACCOUNT, {
        expiresAt: new Date(clock.now().getTime() - 1000).toISOString(),
        surfaceId,
      }),
    ).rejects.toThrow("future");
  });

  test("expiry stops new and existing visitor sessions but deletes nothing and is not a 410", async () => {
    const { clock, founder, harness, routes, visitor } = await setup();
    const { surfaceId, token } = await share(founder);
    await founder.setPassword(ACCOUNT, {
      password: "correct horse",
      surfaceId,
    });
    await founder.setExpiry(ACCOUNT, {
      expiresAt: future(clock, DAY),
      surfaceId,
    });
    const granted = await visitor.exchange({
      password: "correct horse",
      signals: { device: "d", network: "n" },
      token,
    });
    if (granted.status !== "granted") {
      throw new Error("not granted");
    }
    const cookie = `__Secure-cantiara-share=${granted.cookieValue}`;
    expect((await getPath(routes, `/shared/${surfaceId}`, cookie)).status).toBe(
      200,
    );

    clock.advance(DAY + 1000);
    const expiredPage = await getPath(routes, `/shared/${surfaceId}`, cookie);
    expect(expiredPage.status).toBe(404);
    expect(
      await visitor.exchange({
        password: "correct horse",
        signals: { device: "d", network: "n" },
        token,
      }),
    ).toEqual({ status: "denied" });
    // Not revoked: the snapshot, the password and the surface are all still there.
    const [surface] = harness.surfaces;
    expect(surface?.cancelledAt).toBeNull();
    expect(surface?.passwordHash).toBe("fast$correct horse");
    expect(surface?.manifest.items.length).toBeGreaterThan(0);
    const summary = (await founder.preview(ACCOUNT, { root }))?.surface;
    expect(summary).toMatchObject({
      passwordProtected: true,
      state: "Expired",
    });
    // An expired link cannot be extended; it is reopened or reshared.
    await expect(
      founder.setExpiry(ACCOUNT, { expiresAt: null, surfaceId }),
    ).rejects.toThrow("expired");
  });

  test("opening, changing expiry and reactivating never write the source record", async () => {
    const { clock, founder, harness } = await setup();
    const before = JSON.stringify(await harness.store.source(ACCOUNT, root));
    const { surfaceId } = await share(founder);
    await founder.setExpiry(ACCOUNT, {
      expiresAt: future(clock, DAY),
      surfaceId,
    });
    clock.advance(2 * DAY);
    await founder.reopen(ACCOUNT, {
      confirmOldHoldersRegainAccess: true,
      expiresAt: null,
      surfaceId,
    });
    expect(JSON.stringify(await harness.store.source(ACCOUNT, root))).toBe(
      before,
    );
    // The manifest is the approved one; no new revision was approved.
    expect(harness.revisions).toHaveLength(1);
  });
});

describe("after expiry: Reshare with a new link versus Reopen the same link", () => {
  async function expired() {
    const context = await setup();
    const { surfaceId, token } = await share(context.founder);
    await context.founder.setPassword(ACCOUNT, {
      password: "correct horse",
      surfaceId,
    });
    await context.founder.setExpiry(ACCOUNT, {
      expiresAt: future(context.clock, DAY),
      surfaceId,
    });
    context.clock.advance(DAY + 1000);
    return { ...context, surfaceId, token };
  }

  test("reshare mints a new Dış yüzey and token; the old holders stay out and a retry makes no second surface", async () => {
    const { clock, founder, harness, surfaceId, token, visitor } =
      await expired();
    const newSurfaceId = "new-surface";
    const input = {
      expiresAt: future(clock, 7 * DAY),
      newSurfaceId,
      surfaceId,
    };
    const reshared = await founder.reshare(ACCOUNT, input);
    expect(reshared?.surfaceId).toBe(newSurfaceId);
    expect(reshared?.accessToken).toBeTruthy();
    expect(reshared?.accessToken).not.toBe(token);
    expect(harness.surfaces).toHaveLength(2);
    // The old link keeps being expired: no silent re-admission.
    expect(
      await visitor.exchange({
        password: "correct horse",
        signals: { device: "d", network: "n" },
        token,
      }),
    ).toEqual({ status: "denied" });
    expect(
      await visitor.exchange({
        password: "correct horse",
        signals: { device: "d", network: "n" },
        token: reshared?.accessToken ?? "",
      }),
    ).toMatchObject({ status: "granted", surfaceId: newSurfaceId });
    const retry = await founder.reshare(ACCOUNT, input);
    expect(retry?.accessToken).toBeNull();
    expect(harness.surfaces).toHaveLength(2);
    // The founder's surface is now the new one.
    expect((await founder.preview(ACCOUNT, { root }))?.surface?.surfaceId).toBe(
      newSurfaceId,
    );
  });

  test("reshare is only for an expired link", async () => {
    const { founder } = await setup();
    const { surfaceId } = await share(founder);
    await expect(
      founder.reshare(ACCOUNT, {
        expiresAt: null,
        newSurfaceId: "n",
        surfaceId,
      }),
    ).rejects.toThrow("expired");
  });

  test("reopen needs the extra confirmation, readmits the old link and keeps old sessions dead", async () => {
    const { clock, founder, surfaceId, token, visitor } = await expired();
    await expect(
      founder.reopen(ACCOUNT, {
        confirmOldHoldersRegainAccess: false,
        expiresAt: null,
        surfaceId,
      } as never),
    ).rejects.toThrow();
    expect(
      await visitor.exchange({
        password: "correct horse",
        signals: { device: "d", network: "n" },
        token,
      }),
    ).toEqual({ status: "denied" });

    const reopened = await founder.reopen(ACCOUNT, {
      confirmOldHoldersRegainAccess: true,
      expiresAt: future(clock, DAY),
      surfaceId,
    });
    expect(reopened).toMatchObject({ state: "Active", surfaceId });
    expect(
      await visitor.exchange({
        password: "correct horse",
        signals: { device: "d", network: "n" },
        token,
      }),
    ).toMatchObject({ status: "granted" });
    await expect(
      founder.reopen(ACCOUNT, {
        confirmOldHoldersRegainAccess: true,
        expiresAt: null,
        surfaceId,
      }),
    ).rejects.toThrow("expired");
  });

  test("a session minted before the expiry stays dead after a reopen", async () => {
    const { clock, founder, harness, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    await founder.setExpiry(ACCOUNT, {
      expiresAt: future(clock, DAY),
      surfaceId,
    });
    const { cookie } = await enter(routes, token);
    clock.advance(DAY + 1000);
    await founder.reopen(ACCOUNT, {
      confirmOldHoldersRegainAccess: true,
      expiresAt: null,
      surfaceId,
    });
    expect((await getPath(routes, `/shared/${surfaceId}`, cookie)).status).toBe(
      404,
    );
    expect(harness.surfaces[0]?.accessEpoch).toBe(1);
  });
});

describe("Revoke is terminal", () => {
  test("the URL, the token and every page, asset and range request answer an empty-body 410 with noindex and no redirect", async () => {
    const { cacheReads, founder, reads, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const { cookie } = await enter(routes, token);
    const range = await getPath(
      routes,
      filePath(surfaceId),
      cookie,
      "bytes=0-4",
    );
    expect(range.status).toBe(206);

    await founder.revoke(ACCOUNT, { surfaceId });
    reads.length = 0;
    cacheReads.length = 0;

    for (const [path, rangeHeader] of [
      [`/shared/${surfaceId}`, undefined],
      [filePath(surfaceId), undefined],
      [filePath(surfaceId), "bytes=0-4"],
      [filePath(surfaceId), "bytes=-3"],
      [`/s/${token}`, undefined],
    ] as const) {
      const response = await getPath(routes, path, cookie, rangeHeader);
      expectGone(response, await response.text());
    }
    // Revoke and expiry beat the cache: neither the cache nor storage was asked.
    expect(cacheReads).toEqual([]);
    expect(reads).toEqual([]);
    // Also for a visitor who never had a session.
    const anonymous = await getPath(routes, `/shared/${surfaceId}`);
    expectGone(anonymous, await anonymous.text());
  });

  test("the URL and token are never reused: the next share is a new surface", async () => {
    const { founder, harness, routes, visitor } = await setup();
    const first = await share(founder);
    await founder.revoke(ACCOUNT, { surfaceId: first.surfaceId });
    const second = await share(founder, "approval-2");
    expect(second.surfaceId).not.toBe(first.surfaceId);
    expect(second.token).not.toBe(first.token);
    expect(harness.surfaces).toHaveLength(2);
    expect(
      await visitor.exchange({
        password: null,
        signals: { device: "d", network: "n" },
        token: first.token,
      }),
    ).toEqual({ status: "gone" });
    expect((await enter(routes, second.token)).response.status).toBe(303);
    // No lifecycle action touches a revoked surface.
    const id = first.surfaceId;
    expect(
      await founder.setPassword(ACCOUNT, {
        password: "abcdefgh",
        surfaceId: id,
      }),
    ).toBeNull();
    expect(await founder.rotateToken(ACCOUNT, { surfaceId: id })).toBeNull();
    expect(
      await founder.setExpiry(ACCOUNT, { expiresAt: null, surfaceId: id }),
    ).toBeNull();
    expect(
      await founder.reopen(ACCOUNT, {
        confirmOldHoldersRegainAccess: true,
        expiresAt: null,
        surfaceId: id,
      }),
    ).toBeNull();
    expect(await founder.revoke(ACCOUNT, { surfaceId: id })).toBeNull();
  });

  test("an unpublished surface (cancelled by a Document) answers the same 410", async () => {
    const { founder, harness, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const { cookie } = await enter(routes, token);
    const [surface] = harness.surfaces;
    if (surface) {
      surface.cancelledAt = START;
    }
    const response = await getPath(routes, `/shared/${surfaceId}`, cookie);
    expectGone(response, await response.text());
  });

  test("revoke ends the sessions and appends secret-free events and Denetim kaydı entries", async () => {
    const { founder, harness, visitor } = await setup();
    const { surfaceId, token } = await share(founder);
    const granted = await visitor.exchange({
      password: null,
      signals: { device: "d", network: "n" },
      token,
    });
    if (granted.status !== "granted") {
      throw new Error("not granted");
    }
    await founder.revoke(ACCOUNT, { surfaceId });
    expect(
      (await visitor.authorize(surfaceId, granted.cookieValue)).status,
    ).toBe("gone");
    expect(harness.sessions).toHaveLength(0);
    expect(harness.events.map((event) => event.type)).toEqual([
      "link-sharing.surface-revoked",
      "link-sharing.sessions-revoked",
    ]);
    const serialized = JSON.stringify([harness.events, harness.auditRecords]);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(ACCOUNT);
    expect(harness.auditRecords.map((record) => record.type)).toEqual([
      "link-sharing.share-created",
      "link-sharing.share-revoked",
    ]);
    expect(harness.auditRecords.map((record) => record.targetAlias)).toEqual([
      surfaceId,
      surfaceId,
    ]);
  });
});

describe("assets and ranges authorize before any cache", () => {
  test("a product-controlled URL serves the exact file version with no raw storage URL and restrictive headers", async () => {
    const { cacheStore, founder, reads, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const { cookie } = await enter(routes, token);

    const page = await getPath(routes, `/shared/${surfaceId}`, cookie);
    const html = await page.text();
    expect(html).toContain(`href="${filePath(surfaceId)}"`);
    expect(html).toContain('rel="noreferrer"');
    expect(html).not.toContain("objects/att1-ver1");
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    expect(page.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );

    const whole = await getPath(routes, filePath(surfaceId), cookie);
    expect(whole.status).toBe(200);
    expect(new Uint8Array(await whole.arrayBuffer())).toEqual(FILE_BYTES);
    expect(whole.headers.get("referrer-policy")).toBe("no-referrer");
    expect(whole.headers.get("x-content-type-options")).toBe("nosniff");
    expect(whole.headers.get("x-robots-tag")).toContain("noindex");
    expect(whole.headers.get("content-disposition")).toContain("attachment");
    expect(whole.headers.get("content-security-policy")).toContain("sandbox");
    expect(whole.headers.get("cache-control")).toBe("private, no-store");
    expect(whole.headers.get("accept-ranges")).toBe("bytes");
    expect(reads).toEqual(["objects/att1-ver1"]);
    expect(cacheStore.size).toBe(1);

    const part = await getPath(
      routes,
      filePath(surfaceId),
      cookie,
      "bytes=2-5",
    );
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-5/20");
    expect(new TextDecoder().decode(await part.arrayBuffer())).toBe("2345");
    const suffix = await getPath(
      routes,
      filePath(surfaceId),
      cookie,
      "bytes=-3",
    );
    expect(new TextDecoder().decode(await suffix.arrayBuffer())).toBe("hij");
    const open = await getPath(
      routes,
      filePath(surfaceId),
      cookie,
      "bytes=17-",
    );
    expect(new TextDecoder().decode(await open.arrayBuffer())).toBe("hij");
    const outside = await getPath(
      routes,
      filePath(surfaceId),
      cookie,
      "bytes=99-",
    );
    expect(outside.status).toBe(416);
    expect(outside.headers.get("content-range")).toBe("bytes */20");
  });

  test("no session, another surface's cookie, an unlisted file and a wrong version are refused before any read", async () => {
    const { cacheReads, founder, reads, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const { cookie } = await enter(routes, token);
    const refused = [
      await getPath(routes, filePath(surfaceId)),
      await getPath(routes, filePath(surfaceId), "__Secure-cantiara-share=x.y"),
      await getPath(routes, `/shared/${surfaceId}/files/att1/ver2`, cookie),
      await getPath(routes, `/shared/${surfaceId}/files/att2/ver1`, cookie),
      await getPath(routes, "/shared/other/files/att1/ver1", cookie),
    ];
    expect(refused.map((response) => response.status)).toEqual([
      404, 404, 404, 404, 404,
    ]);
    expect(reads).toEqual([]);
    expect(cacheReads).toEqual([]);
  });

  test("cache injection: an entry planted after revoke is never delivered, and a planted entry that is not the exact version is ignored", async () => {
    const { cacheStore, founder, harness, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const { cookie } = await enter(routes, token);
    const key = `objects/att1-ver1:${harness.files.get("att1:ver1")?.contentHash}`;

    // A poisoned entry (right key, wrong bytes) is not the exact version.
    cacheStore.set(key, new TextEncoder().encode("0123456789abcdefghiX"));
    const exact = await getPath(routes, filePath(surfaceId), cookie);
    expect(new Uint8Array(await exact.arrayBuffer())).toEqual(FILE_BYTES);

    // A good entry is in the cache, then the surface is revoked.
    cacheStore.set(key, FILE_BYTES);
    await founder.revoke(ACCOUNT, { surfaceId });
    const after = await getPath(routes, filePath(surfaceId), cookie);
    expectGone(after, await after.text());
    const afterRange = await getPath(
      routes,
      filePath(surfaceId),
      cookie,
      "bytes=0-1",
    );
    expectGone(afterRange, await afterRange.text());
  });

  test("expiry denies a file request without touching the cache", async () => {
    const { cacheReads, clock, founder, reads, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    await founder.setExpiry(ACCOUNT, {
      expiresAt: future(clock, DAY),
      surfaceId,
    });
    const { cookie } = await enter(routes, token);
    expect((await getPath(routes, filePath(surfaceId), cookie)).status).toBe(
      200,
    );
    cacheReads.length = 0;
    reads.length = 0;
    clock.advance(DAY + 1000);
    const range = await getPath(
      routes,
      filePath(surfaceId),
      cookie,
      "bytes=0-3",
    );
    expect(range.status).toBe(404);
    expect(await range.text()).toBe("");
    expect(cacheReads).toEqual([]);
    expect(reads).toEqual([]);
  });

  test("a removed or redacted file is a 410 and bytes that are not the approved version are never served", async () => {
    const { assets, founder, harness, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const { cookie } = await enter(routes, token);
    const stored = harness.files.get("att1:ver1");
    if (!stored) {
      throw new Error("missing file");
    }
    // Storage holds other bytes than the approved version: fail closed.
    harness.files.set("att1:ver1", { ...stored, contentHash: "0".repeat(64) });
    expect((await getPath(routes, filePath(surfaceId), cookie)).status).toBe(
      503,
    );
    expect(
      await assets.deliver({
        attachmentId: "att1",
        cookieValue: cookie.replace("__Secure-cantiara-share=", ""),
        range: null,
        surfaceId,
        versionId: "ver1",
      }),
    ).toEqual({ status: "unavailable" });
    harness.files.delete("att1:ver1");
    const redacted = await getPath(routes, filePath(surfaceId), cookie);
    expectGone(redacted, await redacted.text());
  });

  test("byte ranges: one range only, malformed and multi ranges are ignored", () => {
    expect(parseByteRange("bytes=0-4", 20)).toEqual({ end: 4, start: 0 });
    expect(parseByteRange("bytes=5-", 20)).toEqual({ end: 19, start: 5 });
    expect(parseByteRange("bytes=-5", 20)).toEqual({ end: 19, start: 15 });
    expect(parseByteRange("bytes=0-99", 20)).toEqual({ end: 19, start: 0 });
    expect(parseByteRange("bytes=20-30", 20)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 20)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=0-1,4-5", 20)).toBeNull();
    expect(parseByteRange("items=0-1", 20)).toBeNull();
    expect(parseByteRange(null, 20)).toBeNull();
  });
});

describe("restore replay from the irreversible security event log", () => {
  /** A restored database holds the row as it was before the logged change. */
  function restore(
    harness: Setup["harness"],
    surfaceId: string,
    row: {
      accessEpoch: number;
      cancelledAt: Date | null;
      tokenHash: string | null;
    },
  ) {
    const surface = harness.surfaces.find(
      (entry) => entry.surfaceId === surfaceId,
    );
    if (!surface) {
      throw new Error("missing surface");
    }
    Object.assign(surface, row);
  }

  test("a restored row that is still live stays unauthorized after a revoke", async () => {
    const { founder, harness, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const live = { ...harness.surfaces[0] };
    await founder.revoke(ACCOUNT, { surfaceId });
    restore(harness, surfaceId, {
      accessEpoch: live.accessEpoch ?? 0,
      cancelledAt: null,
      tokenHash: live.tokenHash ?? null,
    });
    expect((await enter(routes, token)).response.status).toBe(303);

    await createLinkSharingReplay(
      harness.securityEvents,
      harness.replayStore,
    ).replay();
    const gone = await routes.request(`${ORIGIN}/s/${token}`);
    expectGone(gone, await gone.text());
    // Replay is idempotent.
    await createLinkSharingReplay(
      harness.securityEvents,
      harness.replayStore,
    ).replay();
    expect(harness.surfaces[0]?.cancelledAt).not.toBeNull();
  });

  test("a restored row that predates a token or password change cannot be repaired, so it fails closed; a current row is left alone", async () => {
    const { founder, harness, routes } = await setup();
    const { surfaceId, token } = await share(founder);
    const restoredRow = {
      accessEpoch: 0,
      cancelledAt: null,
      tokenHash: harness.surfaces[0]?.tokenHash ?? null,
    };
    const rotated = await founder.rotateToken(ACCOUNT, { surfaceId });
    const replay = createLinkSharingReplay(
      harness.securityEvents,
      harness.replayStore,
    );

    // The current row (epoch 1, new token) already reflects the event.
    await replay.replay();
    expect(harness.surfaces[0]?.cancelledAt).toBeNull();
    expect((await enter(routes, rotated?.token ?? "")).response.status).toBe(
      303,
    );

    restore(harness, surfaceId, restoredRow);
    await replay.replay();
    const oldLink = await routes.request(`${ORIGIN}/s/${token}`);
    expectGone(oldLink, await oldLink.text());
  });

  test("a logged visitor-session revoke raises the epoch of a restored row without cancelling it", async () => {
    const { founder, harness, routes, visitor } = await setup();
    const { surfaceId, token } = await share(founder);
    const { cookie } = await enter(routes, token);
    await harness.securityEvents.append({
      accessEpoch: 4,
      actor: "account:abc",
      occurredAt: START,
      surfaceId,
      type: "link-sharing.sessions-revoked",
    });
    expect((await getPath(routes, `/shared/${surfaceId}`, cookie)).status).toBe(
      200,
    );
    await createLinkSharingReplay(
      harness.securityEvents,
      harness.replayStore,
    ).replay();
    expect((await getPath(routes, `/shared/${surfaceId}`, cookie)).status).toBe(
      404,
    );
    expect(harness.surfaces[0]?.cancelledAt).toBeNull();
    expect(
      await visitor.exchange({
        password: null,
        signals: { device: "d", network: "n" },
        token,
      }),
    ).toMatchObject({ status: "granted" });
  });

  test("token and password change events carry no secret", async () => {
    const { founder, harness } = await setup();
    const { surfaceId, token } = await share(founder);
    const rotated = await founder.rotateToken(ACCOUNT, { surfaceId });
    await founder.setPassword(ACCOUNT, {
      password: "correct horse battery",
      surfaceId,
    });
    const serialized = JSON.stringify(harness.events);
    for (const secret of [
      token,
      rotated?.token ?? "missing",
      "correct horse battery",
      sha256Hex("correct horse battery"),
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});

describe("Denetim kaydı and rate limits", () => {
  test("share create, password and token rotate, expiry change, reopen, reshare and revoke are audited aliased and secret-free", async () => {
    const { clock, founder, harness } = await setup();
    const { surfaceId, token } = await share(founder);
    await founder.setPassword(ACCOUNT, {
      password: "correct horse",
      surfaceId,
    });
    const rotated = await founder.rotateToken(ACCOUNT, { surfaceId });
    await founder.setExpiry(ACCOUNT, {
      expiresAt: future(clock, DAY),
      surfaceId,
    });
    clock.advance(DAY + 1000);
    await founder.reopen(ACCOUNT, {
      confirmOldHoldersRegainAccess: true,
      expiresAt: future(clock, DAY),
      surfaceId,
    });
    clock.advance(DAY + 1000);
    const reshared = await founder.reshare(ACCOUNT, {
      expiresAt: null,
      newSurfaceId: "new-surface",
      surfaceId,
    });
    await founder.revoke(ACCOUNT, { surfaceId: "new-surface" });
    expect(harness.auditRecords.map((record) => record.type)).toEqual([
      "link-sharing.share-created",
      "link-sharing.password-rotated",
      "link-sharing.token-rotated",
      "link-sharing.expiry-changed",
      "link-sharing.share-reopened",
      "link-sharing.share-reshared",
      "link-sharing.share-revoked",
    ]);
    const serialized = JSON.stringify(harness.auditRecords);
    for (const secret of [
      token,
      rotated?.token ?? "missing",
      reshared?.accessToken ?? "missing",
      "correct horse",
      ACCOUNT,
      "Plan body",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    for (const record of harness.auditRecords) {
      expect(record.actorAlias).toMatch(/^account:[0-9a-f]{16}$/);
    }
  });

  test("visitor-gate failures are audited with a rotating alias and no token or password", async () => {
    const { clock, founder, harness, visitor } = await setup();
    const { surfaceId, token } = await share(founder);
    await founder.setPassword(ACCOUNT, {
      password: "correct horse",
      surfaceId,
    });
    const signals = { device: "Browser/1", network: "203.0.113.7" };
    await visitor.exchange({ password: "wrong guess one", signals, token });
    await visitor.exchange({
      password: "wrong guess two",
      signals,
      token: "unknown-token",
    });
    const failures = harness.auditRecords.filter(
      (record) => record.type === "link-sharing.gate-failed",
    );
    expect(failures.map((record) => record.targetAlias)).toEqual([
      surfaceId,
      "unknown-surface",
    ]);
    const serialized = JSON.stringify(failures);
    for (const secret of [
      token,
      "unknown-token",
      "wrong guess",
      "203.0.113.7",
      "Browser/1",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(failures[0]?.actorAlias).toMatch(/^visitor:[0-9a-f]{16}$/);
    // The alias rotates daily: the same client is not linkable across days.
    clock.advance(DAY);
    await visitor.exchange({ password: "wrong guess three", signals, token });
    const [first, , third] = harness.auditRecords.filter(
      (record) => record.type === "link-sharing.gate-failed",
    );
    expect(third?.actorAlias).not.toBe(first?.actorAlias);
  });

  test("starting shares is rate-limited per founder and per hour", async () => {
    const { clock, founder } = await setup();
    for (let index = 0; index < SHARE_CHANGE_LIMIT; index += 1) {
      const { surfaceId } = await share(founder, `approval-${index}`);
      // Revoking is a separate limit, so make room for it by spreading the clock.
      await founder.revoke(ACCOUNT, { surfaceId });
    }
    await expect(share(founder, "approval-over")).rejects.toBeInstanceOf(
      LinkSharingRateLimitError,
    );
    clock.advance(SHARE_CHANGE_WINDOW_MS + 1000);
    expect((await share(founder, "approval-later")).token).toBeTruthy();
  });

  test("revoking is rate-limited per founder and per hour", async () => {
    const { clock, founder, harness } = await setup();
    const { surfaceId } = await share(founder);
    const actorAlias = `account:${sha256Hex(ACCOUNT).slice(0, 16)}`;
    for (let index = 0; index < SHARE_CHANGE_LIMIT; index += 1) {
      await harness.audit.append({
        actorAlias,
        id: `seed-${index}`,
        occurredAt: clock.now(),
        targetAlias: "other",
        type: "link-sharing.share-revoked",
      });
    }
    await expect(founder.revoke(ACCOUNT, { surfaceId })).rejects.toBeInstanceOf(
      LinkSharingRateLimitError,
    );
    // A refused revoke changed nothing.
    expect(harness.surfaces[0]?.cancelledAt).toBeNull();
    clock.advance(SHARE_CHANGE_WINDOW_MS + 1000);
    expect(await founder.revoke(ACCOUNT, { surfaceId })).toMatchObject({
      surfaceId,
    });
  });
});

describe("access changes and their security events stay consistent", () => {
  /** An event log that fails its first `failures` appends, then recovers. */
  function failingFounder(setupResult: Setup, failures: number) {
    let remaining = failures;
    return createLinkSharing(setupResult.harness.store, {
      audit: setupResult.harness.audit,
      events: {
        append(event) {
          if (remaining > 0) {
            remaining -= 1;
            return Promise.reject(new Error("security log unavailable"));
          }
          return setupResult.harness.securityEvents.append(event);
        },
        list: () => setupResult.harness.securityEvents.list(),
      },
      hasher: fastHasher,
      now: setupResult.clock.now,
    });
  }

  async function granted(setupResult: Setup, token: string) {
    const result = await setupResult.visitor.exchange({
      password: null,
      signals: { device: "d", network: "n" },
      token,
    });
    if (result.status !== "granted") {
      throw new Error("not granted");
    }
    return result;
  }

  test("revoke still ends access when the log is down, and reports the unlogged change", async () => {
    const context = await setup();
    const { surfaceId, token } = await share(context.founder);
    const session = await granted(context, token);
    const broken = failingFounder(context, Number.POSITIVE_INFINITY);
    await expect(broken.revoke(ACCOUNT, { surfaceId })).rejects.toBeInstanceOf(
      LinkSharingEventLogError,
    );
    expect(
      (await context.visitor.authorize(surfaceId, session.cookieValue)).status,
    ).toBe("gone");
  });

  test("revoke retries a failed append with the real epoch and then succeeds", async () => {
    const context = await setup();
    const { surfaceId } = await share(context.founder);
    const flaky = failingFounder(context, 2);
    await expect(flaky.revoke(ACCOUNT, { surfaceId })).resolves.toMatchObject({
      surfaceId,
    });
    const types = context.harness.events.map((event) => event.type);
    expect(types).toContain("link-sharing.surface-revoked");
    expect(types).toContain("link-sharing.sessions-revoked");
  });

  test("token and password changes take effect but are never reported as clean when unlogged", async () => {
    const context = await setup();
    const { surfaceId, token } = await share(context.founder);
    const broken = failingFounder(context, Number.POSITIVE_INFINITY);
    await expect(
      broken.rotateToken(ACCOUNT, { surfaceId }),
    ).rejects.toBeInstanceOf(LinkSharingEventLogError);
    expect(
      (
        await context.visitor.exchange({
          password: null,
          signals: { device: "d", network: "n" },
          token,
        })
      ).status,
    ).not.toBe("granted");
    await expect(
      broken.setPassword(ACCOUNT, { password: "correct horse", surfaceId }),
    ).rejects.toBeInstanceOf(LinkSharingEventLogError);
  });
});
