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
} from "../github-integration-memory-store";

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
});
