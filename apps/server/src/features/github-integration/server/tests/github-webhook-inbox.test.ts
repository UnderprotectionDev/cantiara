import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
  WEBHOOK_SECRET,
} from "../github-integration-memory-store";
import { createGitHubWebhookInbox } from "../github-webhook-inbox";
import { createMemoryInboxStore } from "../github-webhook-inbox-memory-store";

const INSTALLATION = 900;
const REPOSITORY = 11;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function seeded() {
  const harness = createMemoryHarness();
  harness.app.install(INSTALLATION, "acme", [
    { id: REPOSITORY, name: "web", owner: "acme" },
  ]);
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    id: 5001,
    number: 1,
    title: "Checkout fails on retry",
    updatedAt: "2026-09-30T10:00:00.000Z",
  });
  return harness;
}

type Harness = ReturnType<typeof seeded>;

async function connect(harness: Harness) {
  const { installUrl } = await harness.github.startInstall(accountId, {
    projectId,
  });
  await harness.github.completeInstall(accountId, {
    installationId: INSTALLATION,
    state: new URL(installUrl).searchParams.get("state") ?? "",
  });
  return await harness.github.linkRepository(accountId, {
    installationId: INSTALLATION,
    projectId,
    repositoryId: REPOSITORY,
  });
}

function repositoryPayload() {
  return {
    html_url: "https://github.com/acme/web",
    id: REPOSITORY,
    name: "web",
    owner: { login: "acme" },
  };
}

function issuePayload(change: {
  closed?: boolean;
  title: string;
  updatedAt: string;
}) {
  return JSON.stringify({
    action: "edited",
    installation: { id: INSTALLATION },
    issue: {
      html_url: "https://github.com/acme/web/issues/1",
      id: 5001,
      labels: [],
      number: 1,
      state: change.closed ? "closed" : "open",
      title: change.title,
      updated_at: change.updatedAt,
    },
    repository: repositoryPayload(),
  });
}

async function deliver(
  harness: Harness,
  id: string,
  event: string,
  body: string,
  options: { final?: boolean } = {},
) {
  const ack = await harness.inbox.receive({
    deliveryId: id,
    event,
    rawBody: body,
    signature: harness.sign(body),
  });
  const result = await harness.inbox.process(id, {
    final: options.final ?? false,
  });
  return { ack, result };
}

async function recordTitle(harness: Harness) {
  const { records } = await harness.github.searchRecords(accountId, {
    projectId,
    query: "",
  });
  return records[0]?.title;
}

describe("GitHub Integration: webhook signature and durable inbox", () => {
  test("a missing, forged or tampered signature writes nothing to the inbox", async () => {
    const harness = seeded();
    await connect(harness);
    const body = issuePayload({
      title: "Forged",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    const attempts = [
      null,
      "sha256=deadbeef",
      harness.sign(body, "another-secret-value-0123"),
      harness.sign(`${body} `),
    ];
    for (const signature of attempts) {
      // biome-ignore lint/performance/noAwaitInLoops: Each forged signature is checked in turn.
      const result = await harness.inbox.receive({
        deliveryId: "d-forged",
        event: "issues",
        rawBody: body,
        signature,
      });
      expect(result).toMatchObject({
        body: { error: "invalid-signature" },
        status: 401,
      });
    }
    expect(harness.inboxRows.deliveries.size).toBe(0);
    expect(harness.inboxRows.payloads.size).toBe(0);
    expect(harness.enqueued).toEqual([]);
  });

  test("a signed delivery is stored once, encrypted, and acknowledged without syncing fields", async () => {
    const harness = seeded();
    await connect(harness);
    const requestsBefore = harness.app.requests.length;
    const body = issuePayload({
      title: "Secret title in payload",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    const ack = await harness.inbox.receive({
      deliveryId: "d-1",
      event: "issues",
      rawBody: body,
      signature: harness.sign(body),
    });
    expect(ack).toMatchObject({
      body: { deliveryId: "d-1", duplicate: false, status: "received" },
      status: 202,
    });
    // The HTTP side neither reads GitHub nor touches a record.
    expect(harness.app.requests).toHaveLength(requestsBefore);
    expect(await recordTitle(harness)).toBe("Checkout fails on retry");
    expect(harness.enqueued).toEqual(["d-1"]);
    const stored = harness.inboxRows.deliveries.get("d-1");
    expect(stored).toMatchObject({ event: "issues", status: "received" });
    // biome-ignore lint/performance/useTopLevelRegex: One-off assertion on a hash shape.
    expect(stored?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    const payload = harness.inboxRows.payloads.get("d-1");
    expect(JSON.stringify(payload)).not.toContain("Secret title in payload");
  });

  test("the acknowledgement does not wait for the queue", async () => {
    const harness = seeded();
    const memory = createMemoryInboxStore();
    const inbox = createGitHubWebhookInbox({
      alarm: () => undefined,
      bootstrapSecret: WEBHOOK_SECRET,
      enqueue: () => new Promise<void>(() => undefined),
      integration: harness.github,
      now: () => harness.clock.current,
      secrets: harness.secrets,
      store: memory.store,
    });
    const body = issuePayload({
      title: "Queue is down",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    const ack = await inbox.receive({
      deliveryId: "d-slow",
      event: "issues",
      rawBody: body,
      signature: harness.sign(body),
    });
    expect(ack.status).toBe(202);
    expect(memory.deliveries.get("d-slow")?.status).toBe("received");
  });

  test("a failing enqueue still acknowledges and raises an operator alarm; redrive recovers it", async () => {
    const harness = seeded();
    await connect(harness);
    const memory = createMemoryInboxStore();
    const alarms: string[] = [];
    const queued: string[] = [];
    let queueDown = true;
    const inbox = createGitHubWebhookInbox({
      alarm: ({ action }) => alarms.push(action),
      bootstrapSecret: WEBHOOK_SECRET,
      enqueue: (id) => {
        // biome-ignore lint/suspicious/noUnnecessaryConditions: The queue flips between awaits; the type narrows it wrongly.
        if (queueDown) {
          return Promise.reject(new Error("queue down"));
        }
        queued.push(id);
        return Promise.resolve();
      },
      integration: harness.github,
      now: () => harness.clock.current,
      secrets: harness.secrets,
      store: memory.store,
    });
    const body = issuePayload({
      title: "Lost enqueue",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    const ack = await inbox.receive({
      deliveryId: "d-lost",
      event: "issues",
      rawBody: body,
      signature: harness.sign(body),
    });
    expect(ack.status).toBe(202);
    await Promise.resolve();
    expect(alarms).toContain("github.webhook.enqueue-failed");
    queueDown = false;
    harness.clock.current = new Date(
      harness.clock.current.getTime() + 2 * MINUTE,
    );
    expect(await inbox.redrivePending()).toBe(1);
    await Promise.resolve();
    expect(queued).toEqual(["d-lost"]);
  });

  test("a duplicate delivery returns the earlier result and creates no second event", async () => {
    const harness = seeded();
    await connect(harness);
    const body = issuePayload({
      title: "Retitled once",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    const first = await deliver(harness, "d-dup", "issues", body);
    expect(first.result).toBe("applied");
    const enqueuedBefore = harness.enqueued.length;
    const again = await harness.inbox.receive({
      deliveryId: "d-dup",
      event: "issues",
      rawBody: body,
      signature: harness.sign(body),
    });
    expect(again).toMatchObject({
      body: {
        deliveryId: "d-dup",
        duplicate: true,
        result: "applied",
        status: "processed",
      },
      status: 200,
    });
    expect(harness.enqueued).toHaveLength(enqueuedBefore);
    expect(harness.inboxRows.deliveries.size).toBe(1);
    // Processing the same delivery again does nothing either.
    await expect(
      harness.inbox.process("d-dup", { final: false }),
    ).resolves.toBe("applied");
    expect(harness.inboxRows.deliveries.get("d-dup")?.attempts).toBe(1);
  });

  test("events apply by updated_at, so an older event never rewinds a newer state", async () => {
    const harness = seeded();
    await connect(harness);
    await deliver(
      harness,
      "d-new",
      "issues",
      issuePayload({
        title: "Newest title",
        updatedAt: "2026-10-01T09:30:00.000Z",
      }),
    );
    const older = await deliver(
      harness,
      "d-old",
      "issues",
      issuePayload({
        title: "Older title arriving late",
        updatedAt: "2026-10-01T09:10:00.000Z",
      }),
    );
    expect(older.result).toBe("stale");
    expect(await recordTitle(harness)).toBe("Newest title");
  });

  test("at the same updated_at a webhook does not override the reconcile snapshot", async () => {
    const harness = seeded();
    await connect(harness);
    const result = await deliver(
      harness,
      "d-equal",
      "issues",
      issuePayload({
        title: "Webhook version",
        updatedAt: "2026-09-30T10:00:00.000Z",
      }),
    );
    expect(result.result).toBe("stale");
    expect(await recordTitle(harness)).toBe("Checkout fails on retry");
  });

  test("at the same updated_at the reconcile snapshot wins and the conflict is recorded in the link history", async () => {
    const harness = seeded();
    const link = await connect(harness);
    await deliver(
      harness,
      "d-w",
      "issues",
      issuePayload({
        title: "Webhook version",
        updatedAt: "2026-10-01T09:20:00.000Z",
      }),
    );
    expect(await recordTitle(harness)).toBe("Webhook version");
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 1, {
      title: "Reconcile version",
      updatedAt: "2026-10-01T09:20:00.000Z",
    });
    await harness.github.syncNow(accountId, { linkId: link.id, projectId });
    expect(await recordTitle(harness)).toBe("Reconcile version");
    const history = harness.stored().linkHistory.get(link.id) ?? [];
    expect(history.map(({ kind }) => kind)).toContain("conflict");
  });

  test("a failed delivery is retried, then dead-lettered with a visible operator alarm and no loss", async () => {
    const harness = seeded();
    await connect(harness);
    const body = JSON.stringify({
      installation: { id: INSTALLATION },
      issue: { id: "not-a-number" },
      repository: repositoryPayload(),
    });
    await harness.inbox.receive({
      deliveryId: "d-bad",
      event: "issues",
      rawBody: body,
      signature: harness.sign(body),
    });
    await expect(
      harness.inbox.process("d-bad", { final: false }),
    ).rejects.toThrow();
    expect(harness.inboxRows.deliveries.get("d-bad")?.status).toBe("failed");
    expect(harness.alarms).toEqual([]);
    await expect(
      harness.inbox.process("d-bad", { final: true }),
    ).rejects.toThrow();
    expect(harness.inboxRows.deliveries.get("d-bad")).toMatchObject({
      attempts: 2,
      status: "dead-letter",
    });
    expect(harness.alarms).toMatchObject([
      { action: "github.webhook.dead-letter", deliveryId: "d-bad" },
    ]);
    // Not lost: the row and its payload are still there for recovery.
    expect(harness.inboxRows.payloads.has("d-bad")).toBe(true);
  });

  test("webhook events for the App and Repository stop sync with a reason and keep the product session", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const removed = JSON.stringify({
      action: "removed",
      installation: { id: INSTALLATION },
      repositories_removed: [repositoryPayload()],
    });
    await deliver(harness, "d-access", "installation_repositories", removed);
    let overview = await harness.github.overview(accountId, projectId);
    expect(overview.links[0]).toMatchObject({
      connection: "Disconnected",
      stopReason: "Access revoked",
    });
    // Reconnect clears the stop; then the repository is deleted.
    await harness.github.reconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    await deliver(
      harness,
      "d-gone",
      "repository",
      JSON.stringify({
        action: "deleted",
        installation: { id: INSTALLATION },
        repository: repositoryPayload(),
      }),
    );
    overview = await harness.github.overview(accountId, projectId);
    expect(overview.links[0]).toMatchObject({
      connection: "Disconnected",
      stopReason: "Repository not found",
    });
    await harness.github.reconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    await deliver(
      harness,
      "d-uninstall",
      "installation",
      JSON.stringify({
        action: "deleted",
        installation: { id: INSTALLATION },
      }),
    );
    overview = await harness.github.overview(accountId, projectId);
    expect(overview.links[0]).toMatchObject({
      connection: "Disconnected",
      stopReason: "App uninstalled",
    });
    expect(harness.account.hasSession(accountId)).toBe(true);
    expect(harness.account.hasLoginIdentity(accountId)).toBe(true);
  });

  test("ping and unused events are acknowledged and ignored", async () => {
    const harness = seeded();
    await connect(harness);
    const ping = await deliver(harness, "d-ping", "ping", '{"zen":"ok"}');
    expect(ping.ack.status).toBe(202);
    expect(ping.result).toBe("ignored");
    const other = await deliver(
      harness,
      "d-star",
      "star",
      JSON.stringify({ installation: { id: INSTALLATION } }),
    );
    expect(other.result).toBe("ignored");
  });
});

describe("GitHub Integration: payload and delivery retention", () => {
  test("a processed payload is physically deleted after 24 hours, its id, hash and result after 30 days", async () => {
    const harness = seeded();
    await connect(harness);
    await deliver(
      harness,
      "d-ok",
      "issues",
      issuePayload({
        title: "Kept briefly",
        updatedAt: "2026-10-01T09:30:00.000Z",
      }),
    );
    const start = harness.clock.current.getTime();
    harness.clock.current = new Date(start + 23 * HOUR);
    await harness.inbox.sweepRetention();
    expect(harness.inboxRows.payloads.has("d-ok")).toBe(true);
    harness.clock.current = new Date(start + 25 * HOUR);
    await harness.inbox.sweepRetention();
    expect(harness.inboxRows.payloads.has("d-ok")).toBe(false);
    expect(harness.inboxRows.deliveries.get("d-ok")).toMatchObject({
      payloadHash: expect.any(String),
      result: "applied",
    });
    harness.clock.current = new Date(start + 29 * DAY);
    await harness.inbox.sweepRetention();
    expect(harness.inboxRows.deliveries.has("d-ok")).toBe(true);
    harness.clock.current = new Date(start + 31 * DAY);
    await harness.inbox.sweepRetention();
    expect(harness.inboxRows.deliveries.has("d-ok")).toBe(false);
  });

  test("a failed payload is kept up to 7 days and then physically deleted", async () => {
    const harness = seeded();
    await connect(harness);
    const body = JSON.stringify({
      installation: { id: INSTALLATION },
      issue: { id: "x" },
      repository: repositoryPayload(),
    });
    await harness.inbox.receive({
      deliveryId: "d-failed",
      event: "issues",
      rawBody: body,
      signature: harness.sign(body),
    });
    await expect(
      harness.inbox.process("d-failed", { final: true }),
    ).rejects.toThrow();
    const start = harness.clock.current.getTime();
    harness.clock.current = new Date(start + 6 * DAY);
    await harness.inbox.sweepRetention();
    expect(harness.inboxRows.payloads.has("d-failed")).toBe(true);
    harness.clock.current = new Date(start + 8 * DAY);
    const swept = await harness.inbox.sweepRetention();
    expect(swept.payloads).toBe(1);
    expect(harness.inboxRows.payloads.has("d-failed")).toBe(false);
    expect(harness.inboxRows.deliveries.has("d-failed")).toBe(true);
  });
});

describe("GitHub Integration: webhook secret rotation", () => {
  const NEW_SECRET = "whsec_rotated_secret_9876543210";

  test("old and new secrets verify together for 15 minutes, then the old one is rejected", async () => {
    const harness = seeded();
    await connect(harness);
    const body = issuePayload({
      title: "Signed",
      updatedAt: "2026-10-01T09:30:00.000Z",
    });
    const receive = (id: string, secret: string) =>
      harness.inbox.receive({
        deliveryId: id,
        event: "issues",
        rawBody: body,
        signature: harness.sign(body, secret),
      });
    expect((await receive("d-a", WEBHOOK_SECRET)).status).toBe(202);
    const rotated = await harness.inbox.rotateSecret(NEW_SECRET);
    const rotatedAt = harness.clock.current.getTime();
    expect(rotated.previousValidUntil).toBe(
      new Date(rotatedAt + 15 * MINUTE).toISOString(),
    );
    harness.clock.current = new Date(rotatedAt + 14 * MINUTE);
    expect((await receive("d-b", WEBHOOK_SECRET)).status).toBe(202);
    expect((await receive("d-c", NEW_SECRET)).status).toBe(202);
    harness.clock.current = new Date(rotatedAt + 16 * MINUTE);
    expect((await receive("d-d", WEBHOOK_SECRET)).status).toBe(401);
    expect((await receive("d-e", NEW_SECRET)).status).toBe(202);
    expect(harness.inboxRows.deliveries.has("d-d")).toBe(false);
  });

  test("the webhook secrets are stored encrypted", async () => {
    const harness = seeded();
    await harness.inbox.rotateSecret(NEW_SECRET);
    const stored = JSON.stringify(harness.inboxRows.secretRows);
    expect(stored).not.toContain(NEW_SECRET);
    expect(stored).not.toContain(WEBHOOK_SECRET);
    await expect(harness.inbox.rotateSecret("short")).rejects.toMatchObject({
      code: "GITHUB_WEBHOOK_SECRET_TOO_SHORT",
    });
  });

  test("an operator alarm is raised once the active secret is 90 days old", async () => {
    const harness = seeded();
    await harness.inbox.rotateSecret(NEW_SECRET);
    const start = harness.clock.current.getTime();
    harness.clock.current = new Date(start + 89 * DAY);
    expect((await harness.inbox.checkSecretAge()).due).toBe(false);
    expect(harness.alarms).toEqual([]);
    harness.clock.current = new Date(start + 91 * DAY);
    expect((await harness.inbox.checkSecretAge()).due).toBe(true);
    expect(harness.alarms.map(({ action }) => action)).toEqual([
      "github.webhook.secret-rotation-due",
    ]);
  });

  test("without a configured secret the endpoint accepts nothing", async () => {
    const harness = seeded();
    const memory = createMemoryInboxStore();
    const inbox = createGitHubWebhookInbox({
      alarm: () => undefined,
      enqueue: () => Promise.resolve(),
      integration: harness.github,
      secrets: harness.secrets,
      store: memory.store,
    });
    const result = await inbox.receive({
      deliveryId: "d-x",
      event: "ping",
      rawBody: "{}",
      signature: harness.sign("{}"),
    });
    expect(result.status).toBe(503);
    expect(memory.deliveries.size).toBe(0);
  });
});
