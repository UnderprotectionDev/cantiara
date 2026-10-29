// biome-ignore-all lint/performance/useTopLevelRegex: Inline patterns assert one rendered string each.
// biome-ignore-all lint/performance/noAwaitInLoops: Each guess must reach the store before the next one is counted.
import { SHARE_VISITOR_SESSION_LIFETIME_MS } from "@cantiara/api/link-sharing";
import { describe, expect, test } from "vitest";

import { createLinkSharing, type ShareSource } from "../link-sharing";
import type { LinkPasswordHasher } from "../link-sharing-credentials";
import { scryptLinkPasswordHasher } from "../link-sharing-credentials";
import { createMemoryLinkSharing } from "../link-sharing-memory-store";
import {
  cooldownSeconds,
  createLinkSharingVisitor,
  FREE_ATTEMPTS,
} from "../link-sharing-visitor";

const ACCOUNT = "account-1";
const START = new Date("2026-10-29T10:00:00.000Z");
const HEX_KEY = /^[0-9a-f]{64}$/;

const root = { id: "d1", kind: "Document" as const };
const source: ShareSource = {
  blockers: [],
  members: [],
  projectId: "project-1",
  record: {
    fields: [
      { key: "body", kind: "markdown", label: "Body", value: "Plan body" },
      { key: "key", kind: "secret", label: "Key", value: "sk-live-9" },
    ],
    id: "d1",
    kind: "Document",
    parts: [],
    title: "Plan",
  },
};
const approvedItemIds = [
  "record:Document:d1",
  "field:Document:d1:title",
  "field:Document:d1:body",
];

// A fast stand-in for scrypt; one test below uses the real hasher.
const fastHasher: LinkPasswordHasher = {
  hash: (password) =>
    Promise.resolve(`fast$${[...password].reverse().join("")}`),
  verify: (password, stored) =>
    Promise.resolve(
      stored !== null && stored === `fast$${[...password].reverse().join("")}`,
    ),
};

const signals = { device: "Browser/1", network: "203.0.113.7" };

function setup(hasher: LinkPasswordHasher = fastHasher) {
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
  const founder = createLinkSharing(harness.store, {
    events: harness.securityEvents,
    hasher,
    now: clock.now,
  });
  const visitor = createLinkSharingVisitor(harness.visitorStore, {
    hasher,
    now: clock.now,
    rateSecret: "rate-secret-for-tests",
  });
  return { clock, founder, harness, visitor };
}

async function share(founder: ReturnType<typeof setup>["founder"]) {
  const approved = await founder.approve(ACCOUNT, {
    approvalId: crypto.randomUUID(),
    approvedItemIds,
    liveItemIds: [],
    publishAnyway: false,
    root,
  });
  if (!approved?.accessToken) {
    throw new Error("approval did not mint a token");
  }
  return { surfaceId: approved.surfaceId, token: approved.accessToken };
}

async function open(
  visitor: ReturnType<typeof setup>["visitor"],
  token: string,
  password: string | null = null,
) {
  return await visitor.exchange({ password, signals, token });
}

describe("Link Sharing visitor session seam", () => {
  test("approval mints the Share token once and stores only its hash", async () => {
    const { founder, harness } = setup();
    const approvalId = crypto.randomUUID();
    const input = {
      approvalId,
      approvedItemIds,
      liveItemIds: [],
      publishAnyway: false,
      root,
    };
    const first = await founder.approve(ACCOUNT, input);
    expect(first?.accessToken).toMatch(/^[\w-]{43}$/);
    expect(JSON.stringify(harness.surfaces)).not.toContain(
      first?.accessToken ?? "missing",
    );
    expect(harness.surfaces[0]?.tokenHash).toMatch(HEX_KEY);
    const replay = await founder.approve(ACCOUNT, input);
    expect(replay?.accessToken).toBeNull();
    // A later revision of the same surface keeps the token and mints none.
    const next = await founder.approve(ACCOUNT, {
      ...input,
      approvalId: crypto.randomUUID(),
      surfaceId: first?.surfaceId,
    });
    expect(next?.accessToken).toBeNull();
  });

  test("a token without a password opens a surface-bound session that is not a Hesap oturumu", async () => {
    const { founder, harness, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    const result = await open(visitor, token);
    expect(result).toMatchObject({ status: "granted", surfaceId });
    if (result.status !== "granted") {
      return;
    }
    const snapshot = await visitor.authorize(surfaceId, result.cookieValue);
    expect(snapshot?.manifest.items.map((item) => item.label)).toContain(
      "Body",
    );
    // The cookie secret is stored only as a hash and carries no account id.
    expect(JSON.stringify(harness.sessions)).not.toContain(
      result.cookieValue.split(".")[1] ?? "missing",
    );
    expect(JSON.stringify(harness.sessions)).not.toContain(ACCOUNT);
    // Another surface, a missing cookie and a tampered secret all fail alike.
    expect(await visitor.authorize("other", result.cookieValue)).toBeNull();
    expect(await visitor.authorize(surfaceId, undefined)).toBeNull();
    expect(
      await visitor.authorize(
        surfaceId,
        `${result.cookieValue.split(".")[0]}.tampered`,
      ),
    ).toBeNull();
  });

  test("the session ends 12 hours after creation and activity never extends it", async () => {
    const { clock, founder, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    const result = await open(visitor, token);
    if (result.status !== "granted") {
      throw new Error("not granted");
    }
    clock.advance(SHARE_VISITOR_SESSION_LIFETIME_MS - 60_000);
    expect(
      await visitor.authorize(surfaceId, result.cookieValue),
    ).not.toBeNull();
    clock.advance(30_000);
    expect(
      await visitor.authorize(surfaceId, result.cookieValue),
    ).not.toBeNull();
    clock.advance(30_000);
    expect(await visitor.authorize(surfaceId, result.cookieValue)).toBeNull();
  });

  test("a password is required, and a wrong password, a missing password and an unknown token answer the same", async () => {
    const { founder, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    await founder.setPassword(ACCOUNT, {
      password: "correct horse",
      surfaceId,
    });
    expect(await open(visitor, token)).toEqual({ status: "denied" });
    const wrong = await open(visitor, token, "wrong password");
    const unknown = await open(visitor, "no-such-token", "wrong password");
    const unknownNoPassword = await open(visitor, "no-such-token");
    expect(wrong).toEqual({ status: "denied" });
    expect(unknown).toEqual(wrong);
    expect(unknownNoPassword).toEqual(wrong);
    expect(await open(visitor, token, "correct horse")).toMatchObject({
      status: "granted",
    });
  });

  test("the Link password is stored as a salted scrypt hash, never reversible", async () => {
    const { founder, harness, visitor } = setup(scryptLinkPasswordHasher);
    const { surfaceId, token } = await share(founder);
    await founder.setPassword(ACCOUNT, {
      password: "correct horse battery",
      surfaceId,
    });
    const stored = harness.surfaces[0]?.passwordHash ?? "";
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("correct horse battery");
    expect(await open(visitor, token, "correct horse battery")).toMatchObject({
      status: "granted",
    });
    expect(await open(visitor, token, "correct horse batterY")).toEqual({
      status: "denied",
    });
    // The same password hashes differently each time.
    expect(await scryptLinkPasswordHasher.hash("same")).not.toEqual(
      await scryptLinkPasswordHasher.hash("same"),
    );
  });

  test("adding, changing and removing the password end every session at once, with secret-free events", async () => {
    const { founder, harness, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    const live = async () => {
      const result = await open(visitor, token, "pass-one-1");
      return result.status === "granted" ? result.cookieValue : null;
    };
    const first = await open(visitor, token);
    if (first.status !== "granted") {
      throw new Error("not granted");
    }
    await founder.setPassword(ACCOUNT, { password: "pass-one-1", surfaceId });
    expect(await visitor.authorize(surfaceId, first.cookieValue)).toBeNull();

    const second = await live();
    expect(
      await visitor.authorize(surfaceId, second ?? undefined),
    ).not.toBeNull();
    await founder.setPassword(ACCOUNT, { password: "pass-two-2", surfaceId });
    expect(await visitor.authorize(surfaceId, second ?? undefined)).toBeNull();
    expect(await open(visitor, token, "pass-one-1")).toEqual({
      status: "denied",
    });

    const third = await open(visitor, token, "pass-two-2");
    if (third.status !== "granted") {
      throw new Error("not granted");
    }
    const removed = await founder.setPassword(ACCOUNT, {
      password: null,
      surfaceId,
    });
    expect(removed).toMatchObject({ passwordProtected: false });
    expect(await visitor.authorize(surfaceId, third.cookieValue)).toBeNull();
    expect(await open(visitor, token)).toMatchObject({ status: "granted" });

    expect(harness.events.map((event) => event.type)).toEqual([
      "link-sharing.password-changed",
      "link-sharing.sessions-revoked",
      "link-sharing.password-changed",
      "link-sharing.sessions-revoked",
      "link-sharing.password-changed",
      "link-sharing.sessions-revoked",
    ]);
    const log = JSON.stringify(harness.events);
    for (const secret of [token, "pass-one-1", "pass-two-2", ACCOUNT]) {
      expect(log).not.toContain(secret);
    }
  });

  test("rotating the token ends sessions and the old token stops working", async () => {
    const { founder, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    const session = await open(visitor, token);
    if (session.status !== "granted") {
      throw new Error("not granted");
    }
    const rotated = await founder.rotateToken(ACCOUNT, { surfaceId });
    expect(rotated?.token).toBeTruthy();
    expect(await visitor.authorize(surfaceId, session.cookieValue)).toBeNull();
    expect(await open(visitor, token)).toEqual({ status: "denied" });
    expect(await open(visitor, rotated?.token ?? "")).toMatchObject({
      status: "granted",
    });
    expect(
      await founder.rotateToken("another-account", { surfaceId }),
    ).toBeNull();
  });

  test("another account cannot change the password", async () => {
    const { founder } = setup();
    const { surfaceId } = await share(founder);
    expect(
      await founder.setPassword("another-account", {
        password: "intruder-pass",
        surfaceId,
      }),
    ).toBeNull();
  });

  test("failed passwords start an increasing cooldown that even the right password waits out", async () => {
    const { clock, founder, harness, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    await founder.setPassword(ACCOUNT, { password: "right-pass-1", surfaceId });
    for (let attempt = 0; attempt < FREE_ATTEMPTS; attempt += 1) {
      expect(await open(visitor, token, "bad-guess")).toEqual({
        status: "denied",
      });
    }
    const locked = await open(visitor, token, "right-pass-1");
    expect(locked).toMatchObject({ status: "cooldown" });
    expect(cooldownSeconds(FREE_ATTEMPTS + 1)).toBeGreaterThan(
      cooldownSeconds(FREE_ATTEMPTS),
    );
    // Unknown surfaces are limited the same way, so the limit reveals nothing.
    for (let attempt = 0; attempt < FREE_ATTEMPTS; attempt += 1) {
      await open(visitor, "no-such-token", "bad-guess");
    }
    expect(await open(visitor, "no-such-token", "bad-guess")).toMatchObject({
      status: "cooldown",
    });
    clock.advance(cooldownSeconds(FREE_ATTEMPTS) * 1000 + 1000);
    expect(await open(visitor, token, "bad-guess")).toEqual({
      status: "denied",
    });
    const second = await open(visitor, token, "right-pass-1");
    expect(second).toMatchObject({ status: "cooldown" });
    if (second.status === "cooldown") {
      expect(second.retryAfterSeconds).toBeGreaterThan(
        cooldownSeconds(FREE_ATTEMPTS),
      );
    }
    expect(harness.attempts.size).toBeGreaterThan(0);
  });

  test("attempt keys hold no raw network or device value, rotate daily and vanish within 24 hours", async () => {
    const { clock, founder, harness, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    await founder.setPassword(ACCOUNT, { password: "right-pass-1", surfaceId });
    await open(visitor, token, "bad-guess");
    const today = [...harness.attempts.keys()];
    expect(today.length).toBeGreaterThan(0);
    for (const key of today) {
      expect(key).toMatch(HEX_KEY);
    }
    const stored = JSON.stringify([...harness.attempts.entries()]);
    expect(stored).not.toContain(signals.network);
    expect(stored).not.toContain(signals.device);

    clock.advance(24 * 60 * 60 * 1000);
    await open(visitor, token, "bad-guess");
    const tomorrow = [...harness.attempts.keys()];
    // The same client gets entirely new keys: no key links two days.
    expect(new Set([...today, ...tomorrow]).size).toBe(today.length * 2);

    clock.advance(24 * 60 * 60 * 1000 + 1000);
    await open(visitor, token);
    expect(harness.attempts.size).toBe(0);
  });

  test("the visitor snapshot holds no Secret", async () => {
    const { founder, visitor } = setup();
    const { surfaceId, token } = await share(founder);
    const session = await open(visitor, token);
    if (session.status !== "granted") {
      throw new Error("not granted");
    }
    const snapshot = await visitor.authorize(surfaceId, session.cookieValue);
    expect(JSON.stringify(snapshot)).not.toContain("sk-live-9");
  });
});
