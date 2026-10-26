import {
  GITHUB_ALLOWED_ENDPOINTS,
  GITHUB_APP_PERMISSIONS,
  GitHubEndpointRefusedError,
} from "@cantiara/api/github-integration";
import { describe, expect, test } from "vitest";
import { createAllowListedTransport } from "../github-app-gateway";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  otherAccountId,
  otherProjectId,
  projectId,
} from "./github-integration-memory-store";

const RELEASE_WORD = /release/;
const NEVER_READS = /never reads file contents/;
const DOUBLE_TOKEN = /^ghs_double_900_/;
const INSTALLATION = 900;
const REPOSITORY = 11;

function seeded() {
  const harness = createMemoryHarness();
  harness.app.install(INSTALLATION, "acme", [
    { id: REPOSITORY, name: "web", owner: "acme" },
    { id: 12, name: "api", owner: "acme" },
  ]);
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    id: 5001,
    labels: ["bug"],
    milestone: "v1",
    number: 1,
    title: "Checkout fails on retry",
    updatedAt: "2026-09-30T10:00:00.000Z",
  });
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    closed: true,
    id: 5002,
    number: 2,
    title: "Old layout glitch",
    updatedAt: "2026-08-01T10:00:00.000Z",
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

async function install(
  harness: Harness,
  account = accountId,
  project = projectId,
) {
  const { installUrl } = await harness.github.startInstall(account, {
    projectId: project,
  });
  const state = new URL(installUrl).searchParams.get("state") ?? "";
  return await harness.github.completeInstall(account, {
    installationId: INSTALLATION,
    state,
  });
}

async function connect(harness: Harness) {
  await install(harness);
  return await harness.github.linkRepository(accountId, {
    installationId: INSTALLATION,
    projectId,
    repositoryId: REPOSITORY,
  });
}

describe("GitHub Integration: repository link by stable id", () => {
  test("installs the App, lists selectable Repositories and links one by numeric id", async () => {
    const harness = seeded();
    const installed = await install(harness);
    expect(installed.repositories.map((repo) => repo.repositoryId)).toEqual([
      11, 12,
    ]);
    const link = await harness.github.linkRepository(accountId, {
      installationId: INSTALLATION,
      projectId,
      repositoryId: REPOSITORY,
    });
    expect(link).toMatchObject({
      connection: "Connected",
      name: "web",
      owner: "acme",
      repositoryId: 11,
      stopReason: null,
      triage: "Pending",
    });
    const available = await harness.github.availableRepositories(accountId, {
      installationId: INSTALLATION,
      projectId,
    });
    expect(
      available.repositories.map(({ linked, repositoryId }) => [
        repositoryId,
        linked,
      ]),
    ).toEqual([
      [11, true],
      [12, false],
    ]);
  });

  test("a rename or owner change is the same link and keeps the earlier names", async () => {
    const harness = seeded();
    const first = await connect(harness);
    harness.app.renameRepository(INSTALLATION, REPOSITORY, {
      name: "site",
      owner: "new-co",
    });
    const again = await harness.github.linkRepository(accountId, {
      installationId: INSTALLATION,
      projectId,
      repositoryId: REPOSITORY,
    });
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({ name: "site", owner: "new-co" });
    expect(again.previousNames).toMatchObject([{ name: "web", owner: "acme" }]);
    const overview = await harness.github.overview(accountId, projectId);
    expect(overview.links).toHaveLength(1);
  });

  test("a different repository id with a reused name is a new link", async () => {
    const harness = seeded();
    const first = await connect(harness);
    harness.app.renameRepository(INSTALLATION, REPOSITORY, { name: "old-web" });
    harness.app.renameRepository(INSTALLATION, 12, { name: "web" });
    const second = await harness.github.linkRepository(accountId, {
      installationId: INSTALLATION,
      projectId,
      repositoryId: 12,
    });
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({
      name: "web",
      owner: "acme",
      repositoryId: 12,
    });
    expect(
      (await harness.github.overview(accountId, projectId)).links,
    ).toHaveLength(2);
  });

  test("a Project is not bound to a Repository by name and other accounts cannot see the link", async () => {
    const harness = seeded();
    await connect(harness);
    await expect(
      harness.github.overview(otherAccountId, projectId),
    ).rejects.toMatchObject({ code: "GITHUB_PROJECT_NOT_FOUND" });
    expect(
      (await harness.github.overview(otherAccountId, otherProjectId)).links,
    ).toEqual([]);
  });

  test("refuses a Repository the installation does not expose", async () => {
    const harness = seeded();
    await install(harness);
    await expect(
      harness.github.linkRepository(accountId, {
        installationId: INSTALLATION,
        projectId,
        repositoryId: 999,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_REPOSITORY_UNAVAILABLE" });
    expect((await harness.github.overview(accountId, projectId)).links).toEqual(
      [],
    );
  });
});

describe("GitHub Integration: permissions and the Contents allow-list", () => {
  test("requests the read-only set with no write and shows why Contents is asked", async () => {
    const harness = seeded();
    const { app } = await harness.github.overview(accountId, projectId);
    expect(app.permissions).toEqual(
      GITHUB_APP_PERMISSIONS.map(({ access, permission }) => ({
        access,
        permission,
      })),
    );
    expect(app.permissions.map((entry) => entry.permission)).toEqual([
      "Metadata",
      "Contents",
      "Issues",
      "Pull requests",
      "Checks",
      "Commit statuses",
    ]);
    expect(app.permissions.every((entry) => entry.access === "read")).toBe(
      true,
    );
    expect(app.contentsReason).toMatch(RELEASE_WORD);
    expect(app.contentsReason).toMatch(NEVER_READS);
  });

  test("Contents authorizes only versioned release, tag and commit endpoints", () => {
    const contents = GITHUB_ALLOWED_ENDPOINTS.filter(
      (endpoint) => endpoint.permission === "Contents",
    ).map((endpoint) => endpoint.route);
    expect(contents).toEqual([
      "GET /repos/{owner}/{repo}/releases/tags/{tag}",
      "GET /repos/{owner}/{repo}/git/ref/tags/{tag}",
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
    ]);
    expect(
      GITHUB_ALLOWED_ENDPOINTS.filter(
        (endpoint) => !endpoint.route.startsWith("GET "),
      ).map((endpoint) => endpoint.route),
    ).toEqual(["POST /app/installations/{installation_id}/access_tokens"]);
  });

  test("every call the integration makes is on the allow-list", async () => {
    const harness = seeded();
    await connect(harness);
    const allowed = new Set(
      GITHUB_ALLOWED_ENDPOINTS.map((entry) => entry.route),
    );
    expect(harness.app.requests.length).toBeGreaterThan(0);
    for (const request of harness.app.requests) {
      expect(allowed.has(request.route)).toBe(true);
    }
  });

  test.each([
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    "GET /repos/acme/web/git/trees/abc?recursive=1",
    "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
    "GET /repos/{owner}/{repo}/tarball/{ref}",
    "GET /repos/{owner}/{repo}/zipball/{ref}",
    "GET /repos/{owner}/{repo}/compare/{basehead}",
    "GET /repos/{owner}/{repo}/commits/{ref}",
    "GET /repos/{owner}/{repo}/contents/{path}",
    "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
    "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations",
    "POST /repos/{owner}/{repo}/issues",
    "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
    "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
    "GET /repos/{owner}/{repo}/git/commits/{commit_sha}/extra",
  ])("refuses %s before it reaches GitHub", async (route) => {
    const harness = seeded();
    const transport = createAllowListedTransport(harness.app.transport);
    await expect(
      Promise.resolve().then(() =>
        transport.request({ auth: { kind: "app" }, params: {}, route }),
      ),
    ).rejects.toBeInstanceOf(GitHubEndpointRefusedError);
    expect(harness.app.requests).toEqual([]);
  });
});

describe("GitHub Integration: first triage never writes Work", () => {
  test("captures Issues as GitHub external records and previews explainable groups", async () => {
    const harness = seeded();
    const link = await connect(harness);
    expect(link.externalRecordCount).toBe(3);
    const preview = await harness.github.triagePreview(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(preview.writesWork).toBe(false);
    expect(preview.groups.map((group) => group.label)).toEqual([
      "Open, milestone v1",
      "Closed",
    ]);
    expect(
      preview.groups.flatMap((group) =>
        group.records.map((record) => record.number),
      ),
    ).toEqual([1, 2]);
  });

  test("skipping keeps the records searchable as GitHub external records", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const skipped = await harness.github.skipTriage(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(skipped.triage).toBe("Skipped");
    const byTitle = await harness.github.searchRecords(accountId, {
      projectId,
      query: "checkout",
    });
    expect(
      byTitle.records.map((record) => [record.kind, record.number]),
    ).toEqual([
      ["Pull request", 3],
      ["Issue", 1],
    ]);
    const byNumber = await harness.github.searchRecords(accountId, {
      projectId,
      query: "#2",
    });
    expect(byNumber.records.map((record) => record.title)).toEqual([
      "Old layout glitch",
    ]);
    expect(
      (
        await harness.github.searchRecords(accountId, {
          projectId,
          query: "bug",
        })
      ).records,
    ).toHaveLength(1);
  });

  test("the seam has no Work status or close operation, and triage creates no Work", () => {
    const { github } = seeded();
    // No operation writes a Work status, GitHub or a login; the record
    // lifecycle is local. `createWorkAndLink` is the one previewed Work draft
    // of ticket 03 and the first triage never calls it.
    expect(Object.keys(github).sort()).toEqual([
      "applyWebhookEvent",
      "archiveRecord",
      "attentionSignals",
      "availableRepositories",
      // Ticket 04: the read-only PR check summary.
      "checks",
      "completeInstall",
      "createWorkAndLink",
      "deleteRecordPermanently",
      "disconnect",
      "dismissSignal",
      "linkRepository",
      "linkWork",
      "overview",
      "prContext",
      "previewCreateWork",
      "previewDisconnect",
      "previewReconnect",
      "reconcileDue",
      "reconnect",
      "recordInstallationRemoved",
      "reincludeRecord",
      "restoreRecord",
      "searchRecords",
      "skipTriage",
      "startInstall",
      "syncNow",
      "trashRecord",
      "triagePreview",
      "unlinkWork",
      "workLinks",
    ]);
  });
});

describe("GitHub Integration: login OAuth and the App are independent", () => {
  test("revoking the GitHub login leaves the installation, links and records", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.account.revokeLoginIdentity(accountId);
    expect(harness.account.hasLoginIdentity(accountId)).toBe(false);
    const overview = await harness.github.overview(accountId, projectId);
    expect(overview.installations).toMatchObject([
      { installationId: INSTALLATION, removedAt: null },
    ]);
    expect(overview.links).toMatchObject([
      { connection: "Connected", id: link.id, stopReason: null },
    ]);
    expect(
      (await harness.github.searchRecords(accountId, { projectId, query: "" }))
        .records,
    ).toHaveLength(3);
  });

  test("uninstalling the App stops the link with a reason and keeps identity and session", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.app.uninstall(INSTALLATION);
    await harness.github.recordInstallationRemoved(INSTALLATION);
    const overview = await harness.github.overview(accountId, projectId);
    expect(overview.installations[0]?.removedAt).not.toBeNull();
    expect(overview.links).toMatchObject([
      {
        connection: "Disconnected",
        externalRecordCount: 3,
        id: link.id,
        stopReason: "App uninstalled",
      },
    ]);
    expect(harness.account.hasSession(accountId)).toBe(true);
    expect(harness.account.hasLoginIdentity(accountId)).toBe(true);
    await expect(
      harness.github.reconnect(accountId, { linkId: link.id, projectId }),
    ).rejects.toMatchObject({ code: "GITHUB_INSTALLATION_REMOVED" });
  });

  test("a later install and the same stable id restore the same link", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.app.uninstall(INSTALLATION);
    await harness.github.recordInstallationRemoved(INSTALLATION);
    harness.app.install(INSTALLATION, "acme", [
      { id: REPOSITORY, name: "web", owner: "acme" },
    ]);
    await install(harness);
    const restored = await harness.github.linkRepository(accountId, {
      installationId: INSTALLATION,
      projectId,
      repositoryId: REPOSITORY,
    });
    expect(restored).toMatchObject({
      connection: "Connected",
      id: link.id,
      stopReason: null,
    });
  });
});

describe("GitHub Integration: Reconnect and Disconnect", () => {
  test("Disconnect keeps captured records and Reconnect resumes the same link", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const disconnected = await harness.github.disconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(disconnected.keptExternalRecords).toBe(3);
    expect(disconnected.link.connection).toBe("Disconnected");
    const resumed = await harness.github.reconnect(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(resumed).toMatchObject({ connection: "Connected", id: link.id });
  });

  test("Reconnect rotates the sealed credential", async () => {
    const harness = seeded();
    const link = await connect(harness);
    const rowId = harness.stored().installations[0]?.id ?? "";
    const before = harness.stored().credentials.get(rowId);
    await harness.github.reconnect(accountId, { linkId: link.id, projectId });
    const after = harness.stored().credentials.get(rowId);
    expect(after?.sealed.ciphertext).not.toBe(before?.sealed.ciphertext);
  });

  test("Reconnect keeps the stop reason when the Repository is gone from the installation", async () => {
    const harness = seeded();
    const link = await connect(harness);
    harness.app.removeRepositoryAccess(INSTALLATION, REPOSITORY);
    await expect(
      harness.github.reconnect(accountId, { linkId: link.id, projectId }),
    ).rejects.toMatchObject({ code: "GITHUB_REPOSITORY_UNAVAILABLE" });
    const [stopped] = (await harness.github.overview(accountId, projectId))
      .links;
    expect(stopped).toMatchObject({
      connection: "Disconnected",
      stopReason: "Repository not found",
    });
    expect(stopped?.externalRecordCount).toBe(3);
  });
});

describe("GitHub Integration: App tokens are envelope encrypted", () => {
  test("stores ciphertext bound to its row, never the token", async () => {
    const harness = seeded();
    await connect(harness);
    const rowId = harness.stored().installations[0]?.id ?? "";
    const stored = harness.stored().credentials.get(rowId);
    const minted = harness.app.requests.filter((request) =>
      request.route.includes("access_tokens"),
    );
    expect(minted.length).toBeGreaterThan(0);
    expect(stored).toBeDefined();
    const sealed = stored?.sealed;
    if (!sealed) {
      throw new Error("expected a sealed credential");
    }
    const token = harness.secrets.open(sealed, rowId);
    expect(token).toMatch(DOUBLE_TOKEN);
    expect(
      JSON.stringify(harness.stored().credentials.get(rowId)),
    ).not.toContain(token);
    expect(() => harness.secrets.open(sealed, "another-row")).toThrow();
    expect(sealed.keyVersion).toBe(1);
  });

  test("reuses a valid token and mints again after it expires", async () => {
    const harness = seeded();
    await connect(harness);
    const mints = () =>
      harness.app.requests.filter((request) =>
        request.route.includes("access_tokens"),
      ).length;
    const afterConnect = mints();
    await harness.github.availableRepositories(accountId, {
      installationId: INSTALLATION,
      projectId,
    });
    expect(mints()).toBe(afterConnect);
    harness.clock.current = new Date(
      harness.clock.current.getTime() + 2 * 60 * 60 * 1000,
    );
    await harness.github.availableRepositories(accountId, {
      installationId: INSTALLATION,
      projectId,
    });
    expect(mints()).toBe(afterConnect + 1);
  });
});

describe("GitHub Integration: install safety", () => {
  test("refuses a forged, foreign or expired install state", async () => {
    const harness = seeded();
    const { installUrl } = await harness.github.startInstall(accountId, {
      projectId,
    });
    const state = new URL(installUrl).searchParams.get("state") ?? "";
    await expect(
      harness.github.completeInstall(accountId, {
        installationId: INSTALLATION,
        state: `${state}x`,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_INSTALL_STATE_INVALID" });
    await expect(
      harness.github.completeInstall(otherAccountId, {
        installationId: INSTALLATION,
        state,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_INSTALL_STATE_INVALID" });
    harness.clock.current = new Date(
      harness.clock.current.getTime() + 11 * 60 * 1000,
    );
    await expect(
      harness.github.completeInstall(accountId, {
        installationId: INSTALLATION,
        state,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_INSTALL_STATE_INVALID" });
  });

  test("another account cannot claim an installation already connected", async () => {
    const harness = seeded();
    await install(harness);
    await expect(
      install(harness, otherAccountId, otherProjectId),
    ).rejects.toMatchObject({ code: "GITHUB_INSTALLATION_CLAIMED" });
  });

  test("an installation created long before this install attempt cannot be claimed by its id", async () => {
    const harness = seeded();
    harness.app.install(
      INSTALLATION,
      "other-owner",
      [{ id: REPOSITORY, name: "web", owner: "other-owner" }],
      "2026-01-01T00:00:00.000Z",
    );
    const { installUrl } = await harness.github.startInstall(accountId, {
      projectId,
    });
    await expect(
      harness.github.completeInstall(accountId, {
        installationId: INSTALLATION,
        state: new URL(installUrl).searchParams.get("state") ?? "",
      }),
    ).rejects.toMatchObject({ code: "GITHUB_INSTALLATION_UNCLAIMABLE" });
  });

  test("an installation GitHub does not know is refused", async () => {
    const harness = createMemoryHarness();
    const { installUrl } = await harness.github.startInstall(accountId, {
      projectId,
    });
    await expect(
      harness.github.completeInstall(accountId, {
        installationId: 404,
        state: new URL(installUrl).searchParams.get("state") ?? "",
      }),
    ).rejects.toMatchObject({ code: "GITHUB_INSTALLATION_NOT_FOUND" });
  });

  test("an unconfigured App reports it and refuses to start", async () => {
    const harness = createMemoryHarness({ configured: false });
    expect(
      (await harness.github.overview(accountId, projectId)).app.configured,
    ).toBe(false);
    await expect(
      harness.github.startInstall(accountId, { projectId }),
    ).rejects.toMatchObject({ code: "GITHUB_APP_NOT_CONFIGURED" });
  });

  test("an archived Project is read-only", async () => {
    const harness = seeded();
    await expect(
      harness.github.startInstall(accountId, { projectId: archivedProjectId }),
    ).rejects.toMatchObject({ code: "GITHUB_PROJECT_READ_ONLY" });
    expect(
      (await harness.github.overview(accountId, archivedProjectId)).readOnly,
    ).toBe(true);
  });

  test("repositories beyond GitHub's first 100 answer on the next page", async () => {
    const harness = createMemoryHarness();
    harness.app.install(
      901,
      "big",
      Array.from({ length: 105 }, (_, index) => ({
        id: 1000 + index,
        name: `repo-${index}`,
        owner: "big",
      })),
    );
    const { installUrl } = await harness.github.startInstall(accountId, {
      projectId,
    });
    const installed = await harness.github.completeInstall(accountId, {
      installationId: 901,
      state: new URL(installUrl).searchParams.get("state") ?? "",
    });
    expect(installed.repositories).toHaveLength(105);
  });
});

describe("GitHub Integration: sync resilience", () => {
  test("a transient credential mint failure asks to retry instead of marking the App uninstalled", async () => {
    const harness = seeded();
    const link = await connect(harness);
    // Advance past the minted token's lifetime so a reconcile has to mint again.
    harness.app.failTokenMints(true);
    harness.clock.current = new Date(
      harness.clock.current.getTime() + 61 * 60_000,
    );
    const result = await harness.github.syncNow(accountId, {
      linkId: link.id,
      projectId,
    });
    expect(result.outcome).toBe("failed");
    const [mid] = (await harness.github.overview(accountId, projectId)).links;
    expect(mid).toMatchObject({
      connection: "Connected",
      stopReason: null,
      sync: { lastError: expect.any(String) },
    });
    harness.app.failTokenMints(false);
    harness.clock.current = new Date(harness.clock.current.getTime() + 60_000);
    expect(
      (
        await harness.github.syncNow(accountId, {
          linkId: link.id,
          projectId,
        })
      ).outcome,
    ).toBe("ran");
    const [recovered] = (await harness.github.overview(accountId, projectId))
      .links;
    expect(recovered).toMatchObject({
      connection: "Connected",
      stopReason: null,
      sync: { lastError: null },
    });
  });
});

const MINUTE = 60_000;

function seededGithubReconcile() {
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

type HarnessGithubReconcile = ReturnType<typeof seededGithubReconcile>;

async function connectGithubReconcile(harness: HarnessGithubReconcile) {
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

function advance(harness: HarnessGithubReconcile, ms: number) {
  harness.clock.current = new Date(harness.clock.current.getTime() + ms);
}

async function overviewLink(harness: HarnessGithubReconcile) {
  const overview = await harness.github.overview(accountId, projectId);
  const [link] = overview.links;
  if (!link) {
    throw new Error("no link");
  }
  return link;
}

async function records(harness: HarnessGithubReconcile) {
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

async function deliver(
  harness: HarnessGithubReconcile,
  id: string,
  body: string,
) {
  await harness.inbox.receive({
    deliveryId: id,
    event: "issues",
    rawBody: body,
    signature: harness.sign(body),
  });
  return await harness.inbox.process(id, { final: false });
}

async function syncLink(harness: HarnessGithubReconcile) {
  const link = await overviewLink(harness);
  return await harness.github.syncNow(accountId, {
    linkId: link.id,
    projectId,
  });
}

describe("GitHub Integration: incremental read-only reconcile", () => {
  test("the first link sync records its success and stays within the 30 minute budget", async () => {
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    harness.app.failIssueReads(true);
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
    const harness = seededGithubReconcile();
    const link = await connectGithubReconcile(harness);
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
