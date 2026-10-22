import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
} from "../github-integration-memory-store";

function setup(authenticated = true) {
  const harness = createMemoryHarness();
  harness.app.install(900, "acme", [{ id: 11, name: "web", owner: "acme" }]);
  const context = {
    gitHubIntegration: harness.github,
    session: authenticated
      ? { session: { id: "session" }, user: { id: accountId } }
      : null,
  } as Context;
  return { client: createRouterClient(appRouter, { context }), harness };
}

// Login procedures (Account Access, spec 01) share the prefix and are not this seam.
const GITHUB_PROCEDURE = /^(?!.*(Identity|Availability)).*github/i;

describe("GitHub Integration RPC seam", () => {
  test("installs, links and skips triage for the authenticated account", async () => {
    const { client } = setup();
    const { installUrl } = await client.startGitHubAppInstall({ projectId });
    const state = new URL(installUrl).searchParams.get("state") ?? "";
    const installed = await client.completeGitHubAppInstall({
      installationId: 900,
      state,
    });
    expect(
      installed.repositories.map(({ repositoryId }) => repositoryId),
    ).toEqual([11]);
    const link = await client.linkGitHubRepository({
      installationId: 900,
      projectId,
      repositoryId: 11,
    });
    expect(link.connection).toBe("Connected");
    const preview = await client.gitHubTriagePreview({
      linkId: link.id,
      projectId,
    });
    expect(preview.writesWork).toBe(false);
    const skipped = await client.skipGitHubTriage({
      linkId: link.id,
      projectId,
    });
    expect(skipped.triage).toBe("Skipped");
    const overview = await client.projectGitHubOverview({ projectId });
    expect(overview.links).toHaveLength(1);
    await expect(
      client.searchGitHubRecords({ projectId, query: "" }),
    ).resolves.toEqual({ records: [] });
  });

  test("the product session keeps working after the App is uninstalled", async () => {
    const { client, harness } = setup();
    const { installUrl } = await client.startGitHubAppInstall({ projectId });
    await client.completeGitHubAppInstall({
      installationId: 900,
      state: new URL(installUrl).searchParams.get("state") ?? "",
    });
    await client.linkGitHubRepository({
      installationId: 900,
      projectId,
      repositoryId: 11,
    });
    harness.app.uninstall(900);
    await harness.github.recordInstallationRemoved(900);
    const overview = await client.projectGitHubOverview({ projectId });
    expect(overview.links[0]).toMatchObject({
      connection: "Disconnected",
      stopReason: "App uninstalled",
    });
  });

  test("requires a signed-in account and maps refusals to defined errors", async () => {
    await expect(
      setup(false).client.projectGitHubOverview({ projectId }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().client.projectGitHubOverview({ projectId: "unknown" }),
    ).rejects.toMatchObject({ data: { code: "GITHUB_PROJECT_NOT_FOUND" } });
    await expect(
      setup().client.completeGitHubAppInstall({
        installationId: 900,
        state: "forged",
      }),
    ).rejects.toMatchObject({ data: { code: "GITHUB_INSTALL_STATE_INVALID" } });
  });

  test("exposes no login, session, Work status or GitHub write procedure", () => {
    const names = Object.keys(appRouter).filter((name) =>
      GITHUB_PROCEDURE.test(name),
    );
    expect(names.sort()).toEqual([
      "completeGitHubAppInstall",
      // Ticket 03: the only Work-side writes are a link row and the one
      // previewed `Create work and link`; no Work status or close procedure.
      "createGitHubWorkAndLink",
      "disconnectGitHubRepository",
      "dismissGitHubAttentionSignal",
      "gitHubAppRepositories",
      "gitHubTriagePreview",
      "linkGitHubRepository",
      "linkGitHubWork",
      "previewGitHubCreateWork",
      "previewGitHubDisconnect",
      "previewGitHubReconnect",
      "projectGitHubAttentionSignals",
      // Ticket 04: the read-only PR check summary; no run, re-run or log procedure.
      "projectGitHubChecks",
      "projectGitHubOverview",
      "projectGitHubWorkLinks",
      "reconnectGitHubRepository",
      "searchGitHubRecords",
      "skipGitHubTriage",
      "startGitHubAppInstall",
      "syncGitHubNow",
      "unlinkGitHubWork",
    ]);
  });
});
