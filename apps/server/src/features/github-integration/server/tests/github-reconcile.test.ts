import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
} from "../github-integration-memory-store";

const INSTALLATION = 900;
const REPOSITORY = 11;
const MINUTE = 60_000;

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
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    id: 5003,
    number: 3,
    pullRequest: true,
    title: "Fix checkout retry",
    updatedAt: "2026-09-30T11:00:00.000Z",
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

function advance(harness: Harness, ms: number) {
  harness.clock.current = new Date(harness.clock.current.getTime() + ms);
}

async function overviewLink(harness: Harness) {
  const overview = await harness.github.overview(accountId, projectId);
  const [link] = overview.links;
  if (!link) {
    throw new Error("no link");
  }
  return link;
}

async function records(harness: Harness) {
  return (
    await harness.github.searchRecords(accountId, { projectId, query: "" })
  ).records;
}

function issueEvent(title: string, updatedAt: string) {
  return JSON.stringify({
    action: "edited",
    installation: { id: INSTALLATION },
    issue: {
      html_url: "https://github.com/acme/web/issues/1",
      id: 5001,
      labels: [],
      number: 1,
      state: "open",
      title,
      updated_at: updatedAt,
    },
    repository: { id: REPOSITORY, name: "web", owner: { login: "acme" } },
  });
}

async function deliver(harness: Harness, id: string, body: string) {
  await harness.inbox.receive({
    deliveryId: id,
    event: "issues",
    rawBody: body,
    signature: harness.sign(body),
  });
  return await harness.inbox.process(id, { final: false });
}

async function syncLink(harness: Harness) {
  const link = await overviewLink(harness);
  return await harness.github.syncNow(accountId, {
    linkId: link.id,
    projectId,
  });
}

describe("GitHub Integration: incremental read-only reconcile", () => {
  test("the first link sync records its success and stays within the 30 minute budget", async () => {
    const harness = seeded();
    const link = await connect(harness);
    expect(link.sync).toMatchObject({
      firstSyncOverdue: false,
      lastError: null,
      lastSuccessAt: "2026-10-01T09:00:00.000Z",
      outOfDate: false,
      rateLimitedUntil: null,
    });
    expect(link.externalRecordCount).toBe(2);
  });

  test("a scheduled reconcile asks GitHub only for what changed since the last read and never writes", async () => {
    const harness = seeded();
    await connect(harness);
    advance(harness, 15 * MINUTE);
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 1, {
      title: "Checkout fails on retry (confirmed)",
      updatedAt: "2026-10-01T09:10:00.000Z",
    });
    expect(await harness.github.reconcileDue()).toEqual({
      failed: 0,
      ran: 1,
      skipped: 0,
    });
    expect(harness.app.sinceFilters[0]).toBeUndefined();
    expect(harness.app.sinceFilters[1]).toBe("2026-10-01T08:55:00.000Z");
    expect((await records(harness)).map((record) => record.title)).toContain(
      "Checkout fails on retry (confirmed)",
    );
    const link = await overviewLink(harness);
    expect(link.sync.lastSuccessAt).toBe("2026-10-01T09:15:00.000Z");
    // Read-only: every GitHub call is a GET, plus the App's own token exchange.
    for (const { route } of harness.app.requests) {
      expect(
        route.startsWith("GET ") ||
          route === "POST /app/installations/{installation_id}/access_tokens",
      ).toBe(true);
    }
  });

  test("a link not synced for 30 minutes is Out of date, never silently current", async () => {
    const harness = seeded();
    await connect(harness);
    advance(harness, 29 * MINUTE);
    expect((await overviewLink(harness)).sync.outOfDate).toBe(false);
    advance(harness, 2 * MINUTE);
    const stale = await overviewLink(harness);
    expect(stale.connection).toBe("Connected");
    expect(stale.sync.outOfDate).toBe(true);
    await harness.github.reconcileDue();
    expect((await overviewLink(harness)).sync.outOfDate).toBe(false);
  });

  test("a first sync that never succeeded is flagged overdue after 30 minutes with its last error", async () => {
    const harness = seeded();
    harness.app.failIssueReads(true);
    const link = await connect(harness);
    expect(link.sync.lastSuccessAt).toBeNull();
    expect(link.sync.lastError).toContain("500");
    advance(harness, 31 * MINUTE);
    const overdue = await overviewLink(harness);
    expect(overdue.sync).toMatchObject({
      firstSyncOverdue: true,
      outOfDate: true,
    });
    harness.app.failIssueReads(false);
    await harness.github.reconcileDue();
    expect((await overviewLink(harness)).sync).toMatchObject({
      firstSyncOverdue: false,
      lastError: null,
      outOfDate: false,
    });
  });

  test("Sync now runs a reconcile on demand", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 1, {
      title: "Changed at the source",
      updatedAt: "2026-10-01T09:05:00.000Z",
    });
    advance(harness, MINUTE);
    const result = await harness.github.syncNow(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(result).toMatchObject({ applied: 1, outcome: "ran" });
    expect(result.link.sync.lastSuccessAt).toBe("2026-10-01T09:01:00.000Z");
  });
});

describe("GitHub Integration: rate limits", () => {
  test("Retry-After is respected: no read until the wait ends, and the wait is shown", async () => {
    const harness = seeded();
    const link = await connect(harness);
    advance(harness, MINUTE);
    harness.app.rateLimitUntil(
      new Date(harness.clock.current.getTime() + 120_000),
    );
    const limited = await harness.github.syncNow(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(limited.outcome).toBe("rate-limited");
    expect(limited.link.sync.rateLimitedUntil).toBe("2026-10-01T09:03:00.000Z");
    expect(limited.link.sync.lastError).toContain("rate limit");
    expect(limited.link.sync.lastSuccessAt).toBe("2026-10-01T09:00:00.000Z");
    const requests = harness.app.requests.length;
    advance(harness, 60_000);
    expect(
      (await harness.github.syncNow(accountId, { linkId: link.id, projectId }))
        .outcome,
    ).toBe("rate-limited");
    expect((await harness.github.reconcileDue()).skipped).toBe(1);
    expect(harness.app.requests).toHaveLength(requests);
    advance(harness, 61_000);
    const resumed = await harness.github.syncNow(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(resumed.outcome).toBe("ran");
    expect(resumed.link.sync).toMatchObject({
      lastError: null,
      rateLimitedUntil: null,
    });
  });
});

describe("GitHub Integration: connection life and stop reasons", () => {
  test("access withdrawn from the Repository stops sync with that reason", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.app.forbidRepository(INSTALLATION, REPOSITORY);
    const result = await harness.github.syncNow(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(result.outcome).toBe("disconnected");
    expect(result.link).toMatchObject({
      connection: "Disconnected",
      stopReason: "Access revoked",
    });
    const requests = harness.app.requests.length;
    expect((await harness.github.reconcileDue()).skipped).toBe(1);
    expect(harness.app.requests).toHaveLength(requests);
    expect(harness.account.hasSession(accountId)).toBe(true);
  });

  test("a missing Repository stops sync with Repository not found", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.app.removeRepositoryAccess(INSTALLATION, REPOSITORY);
    const result = await harness.github.syncNow(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(result.link).toMatchObject({
      connection: "Disconnected",
      stopReason: "Repository not found",
    });
  });

  test("Reconnect and Disconnect previews list the affected records and change nothing", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const before = await overviewLink(harness);
    const reconnect = await harness.github.previewReconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    const disconnect = await harness.github.previewDisconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(reconnect).toMatchObject({
      action: "Reconnect",
      affected: { issues: 1, pullRequests: 1, repository: "acme/web" },
    });
    expect(disconnect).toMatchObject({
      action: "Disconnect",
      affected: { issues: 1, pullRequests: 1, repository: "acme/web" },
    });
    expect(disconnect.effects.join(" ")).toContain("historical");
    expect(await overviewLink(harness)).toEqual(before);
  });

  test("Disconnect stops sync, keeps captured records and revokes the stored credential", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const done = await harness.github.disconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(done.keptExternalRecords).toBe(2);
    expect(harness.stored().credentials.size).toBe(0);
    expect(
      (await harness.github.syncNow(accountId, { linkId: link.id, projectId }))
        .outcome,
    ).toBe("disconnected");
    expect(await records(harness)).toHaveLength(2);
  });

  test("a Project archive pauses the link, invents no events and unarchive does not resume it", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.archiveProject(projectId);
    expect(await overviewLink(harness)).toMatchObject({
      connection: "Paused",
      pauseReason: "Project archived",
    });
    const requests = harness.app.requests.length;
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 1, {
      title: "Changed while archived",
      updatedAt: "2026-10-01T09:05:00.000Z",
    });
    expect(
      await deliver(
        harness,
        "d-archived",
        issueEvent("Changed while archived", "2026-10-01T09:05:00.000Z"),
      ),
    ).toBe("paused");
    advance(harness, 20 * MINUTE);
    await harness.github.reconcileDue();
    expect(harness.app.requests).toHaveLength(requests);
    expect((await records(harness)).map((r) => r.title)).not.toContain(
      "Changed while archived",
    );
    harness.unarchiveProject(projectId);
    const unarchived = await overviewLink(harness);
    expect(unarchived.connection).toBe("Paused");
    expect((await harness.github.reconcileDue()).skipped).toBe(1);
    expect((await records(harness)).map((r) => r.title)).not.toContain(
      "Changed while archived",
    );
    // Only an explicit Reconnect resumes it and reads the current source.
    const resumed = await harness.github.reconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(resumed.connection).toBe("Connected");
    expect((await records(harness)).map((r) => r.title)).toContain(
      "Changed while archived",
    );
  });
});

describe("GitHub Integration: one identity per Pull request", () => {
  test("a pull_request webhook with GitHub's pull-request id updates the record the reconcile found, never a second one", async () => {
    const harness = seeded();
    await connect(harness);
    const [pull] = (await records(harness)).filter(
      (r) => r.kind === "Pull request",
    );
    if (!pull) {
      throw new Error("no pull request");
    }
    // GitHub names a Pull request with two id sequences: the Issues list
    // answered 5003, the webhook payload carries the pull request id 7003.
    const body = JSON.stringify({
      action: "synchronize",
      installation: { id: INSTALLATION },
      pull_request: {
        html_url: "https://github.com/acme/web/pull/3",
        id: 7003,
        issue_url: "https://api.github.com/repos/acme/web/issues/5003",
        labels: [],
        number: 3,
        state: "open",
        title: "Fix checkout retry (rebased)",
        updated_at: "2026-10-01T09:31:00.000Z",
      },
      repository: { id: REPOSITORY, name: "web", owner: { login: "acme" } },
    });
    await harness.inbox.receive({
      deliveryId: "d-pr",
      event: "pull_request",
      rawBody: body,
      signature: harness.sign(body),
    });
    expect(await harness.inbox.process("d-pr", { final: false })).toBe(
      "applied",
    );
    const stored = harness.stored().records;
    expect(stored).toHaveLength(2);
    expect(stored.find((r) => r.id === pull.id)).toMatchObject({
      githubId: 5003,
      title: "Fix checkout retry (rebased)",
    });
  });
});

describe("GitHub Integration: GitHub dış kaydı life", () => {
  test("Archive keeps source updates flowing and closing it on GitHub does not archive it locally", async () => {
    const harness = seeded();
    await connect(harness);
    const [issue] = (await records(harness)).filter((r) => r.kind === "Issue");
    if (!issue) {
      throw new Error("no issue");
    }
    await harness.github.archiveRecord(accountId, {
      projectId,
      recordId: issue.id,
    });
    expect((await records(harness)).map((r) => r.id)).not.toContain(issue.id);
    expect(
      await deliver(
        harness,
        "d-closed",
        issueEvent("Updated while archived", "2026-10-01T09:30:00.000Z"),
      ),
    ).toBe("applied");
    const [stored] = (await harness.stored()).records.filter(
      (r) => r.id === issue.id,
    );
    expect(stored).toMatchObject({
      lifecycle: "Archived",
      title: "Updated while archived",
    });
  });

  test("Trash stops writes; restore waits for an explicit Sync now that shows the difference", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const [issue] = (await records(harness)).filter((r) => r.kind === "Issue");
    if (!issue) {
      throw new Error("no issue");
    }
    await harness.github.trashRecord(accountId, {
      projectId,
      recordId: issue.id,
    });
    expect((await records(harness)).map((r) => r.id)).not.toContain(issue.id);
    expect(
      await deliver(
        harness,
        "d-trash",
        issueEvent("Changed while in Trash", "2026-10-01T09:30:00.000Z"),
      ),
    ).toBe("trashed");
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 1, {
      title: "Changed while in Trash",
      updatedAt: "2026-10-01T09:30:00.000Z",
    });
    advance(harness, 20 * MINUTE);
    await harness.github.reconcileDue();
    const inTrash = harness.stored().records.find((r) => r.id === issue.id);
    expect(inTrash).toMatchObject({
      lifecycle: "Trash",
      title: "Checkout fails on retry",
    });
    const restored = await harness.github.restoreRecord(accountId, {
      projectId,
      recordId: issue.id,
    });
    expect(restored).toMatchObject({
      id: issue.id,
      lifecycle: "Active",
      needsReconcile: true,
      title: "Checkout fails on retry",
    });
    // Neither a webhook nor the scheduled reconcile applies the missed state.
    expect(
      await deliver(
        harness,
        "d-after",
        issueEvent("Changed while in Trash", "2026-10-01T09:30:00.000Z"),
      ),
    ).toBe("awaiting-reconcile");
    await harness.github.reconcileDue();
    expect(harness.stored().records.find((r) => r.id === issue.id)?.title).toBe(
      "Checkout fails on retry",
    );
    const explicit = await harness.github.syncNow(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(explicit.restoredDiffs).toEqual([
      {
        from: { sourceState: "open", title: "Checkout fails on retry" },
        recordId: issue.id,
        to: { sourceState: "open", title: "Changed while in Trash" },
      },
    ]);
    expect(
      harness.stored().records.find((r) => r.id === issue.id),
    ).toMatchObject({
      needsReconcile: false,
      title: "Changed while in Trash",
    });
  });

  test("permanent delete tombstones the source: no webhook or reconcile resurrects it", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const [issue] = (await records(harness)).filter((r) => r.kind === "Issue");
    if (!issue) {
      throw new Error("no issue");
    }
    await expect(
      harness.github.deleteRecordPermanently(accountId, {
        projectId,
        recordId: issue.id,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_RECORD_NOT_IN_TRASH" });
    await harness.github.trashRecord(accountId, {
      projectId,
      recordId: issue.id,
    });
    await harness.github.deleteRecordPermanently(accountId, {
      projectId,
      recordId: issue.id,
    });
    expect(harness.stored().records.some((r) => r.githubId === 5001)).toBe(
      false,
    );
    expect(
      await deliver(
        harness,
        "d-tomb",
        issueEvent("Back from the dead", "2026-10-01T09:45:00.000Z"),
      ),
    ).toBe("tombstoned");
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 1, {
      title: "Back from the dead",
      updatedAt: "2026-10-01T09:45:00.000Z",
    });
    await harness.github.syncNow(accountId, { linkId: link.id, projectId });
    expect(harness.stored().records.some((r) => r.githubId === 5001)).toBe(
      false,
    );
  });

  test("explicit re-include mints a new product identity with the deleted one as visible origin", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const [issue] = (await records(harness)).filter((r) => r.kind === "Issue");
    if (!issue) {
      throw new Error("no issue");
    }
    await harness.github.trashRecord(accountId, {
      projectId,
      recordId: issue.id,
    });
    await harness.github.deleteRecordPermanently(accountId, {
      projectId,
      recordId: issue.id,
    });
    const included = await harness.github.reincludeRecord(accountId, {
      githubId: 5001,
      kind: "Issue",
      linkId: link.id,
      projectId,
    });
    expect(included.id).not.toBe(issue.id);
    expect(included.origin).toMatchObject({ recordId: issue.id });
    expect(included.origin?.deletedAt).toBe("2026-10-01T09:00:00.000Z");
    // Later source updates now apply to the new identity.
    expect(
      await deliver(
        harness,
        "d-new-id",
        issueEvent("Updated after re-include", "2026-10-01T09:50:00.000Z"),
      ),
    ).toBe("applied");
    expect(
      harness.stored().records.find((r) => r.id === included.id)?.title,
    ).toBe("Updated after re-include");
    await expect(
      harness.github.reincludeRecord(accountId, {
        githubId: 5001,
        kind: "Issue",
        linkId: link.id,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_REINCLUDE_UNAVAILABLE" });
  });
});

describe("GitHub Integration: no GitHub write and no Work", () => {
  test("the whole sync surface issues no write request and creates no Work", async () => {
    const harness = seeded();
    const link = await connect(harness);
    await syncLink(harness);
    await deliver(
      harness,
      "d-1",
      issueEvent("Webhook edit", "2026-10-01T09:30:00.000Z"),
    );
    await harness.github.reconcileDue();
    await harness.github.reconnect(accountId, { linkId: link.id, projectId });
    const writes = harness.app.requests.filter(
      ({ route }) =>
        !(
          route.startsWith("GET ") ||
          route === "POST /app/installations/{installation_id}/access_tokens"
        ),
    );
    expect(writes).toEqual([]);
  });
});
