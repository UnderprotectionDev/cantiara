import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createReleaseEvidence } from "../release-evidence";
import { createMemoryReleaseEvidence } from "./release-evidence-memory-store";

const ACCOUNT = "account-1";
const RELEASE_PROCEDURE = /release(evidence|checklist|openscope)/i;
const ok = <T>(value: T) => ({ available: true as const, value });

function setup(authenticated = true) {
  const harness = createMemoryReleaseEvidence({
    accountId: ACCOUNT,
    projectIds: ["project-1"],
    releases: [
      {
        id: "release-1",
        name: "tidekit 1.0",
        projectId: "project-1",
        status: "Published",
        versionLabel: null,
      },
    ],
    sources: new Map([
      [
        "release-1",
        {
          assessment: ok(null),
          decisions: ok([]),
          gaps: ok([]),
          inconsistencies: ok([]),
          publishDiff: ok({ changelogPrepared: true, snapshotApproved: true }),
          pullRequests: ok([]),
          risks: ok([]),
          scope: ok([
            {
              expectedOutcome: "x",
              id: "work-1",
              key: "TID-1",
              status: "In Progress",
              title: "Open",
            },
          ]),
          tests: ok({
            cases: [],
            contextChanges: [],
            handoffs: [],
            sessionTests: [],
          }),
        },
      ],
    ]),
  });
  const context = {
    releaseEvidence: createReleaseEvidence(harness.store, harness.sources),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

const target = { projectId: "project-1", releaseId: "release-1" };

describe("Release Evidence Pack RPC seam", () => {
  test("serves the pack, the checklist and the open-scope signal to the signed-in account", async () => {
    const client = setup();
    const pack = await client.projectReleaseEvidencePack(target);
    expect(pack.release.name).toBe("tidekit 1.0");
    const item = await client.addReleaseChecklistItem({
      ...target,
      text: "Tag the repo",
    });
    await client.setReleaseChecklistItem({
      ...target,
      checked: true,
      itemId: item.id,
    });
    expect((await client.projectReleaseEvidencePack(target)).checklist).toEqual(
      [{ ...item, checked: true }],
    );
    const { signal } = await client.projectReleaseOpenScopeSignal(target);
    expect(signal).toMatchObject({ blocksPublish: false, closed: false });
    await client.closeReleaseOpenScopeSignal(target);
    expect(
      (await client.projectReleaseOpenScopeSignal(target)).signal?.closed,
    ).toBe(true);
    expect(
      (await client.projectReleaseEvidencePack(target)).release.status,
    ).toBe("Published");
  });

  test("requires a signed-in account and maps refusals to defined errors", async () => {
    await expect(
      setup(false).projectReleaseEvidencePack(target),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().projectReleaseEvidencePack({ ...target, releaseId: "nope" }),
    ).rejects.toMatchObject({
      data: { code: "RELEASE_EVIDENCE_RELEASE_NOT_FOUND" },
    });
    await expect(
      setup().projectReleaseEvidencePack({
        ...target,
        projectId: "project-2",
      }),
    ).rejects.toMatchObject({
      data: { code: "RELEASE_EVIDENCE_PROJECT_NOT_FOUND" },
    });
  });

  test("refuses a pack call that carries a domain write, status or score", async () => {
    const client = setup();
    await expect(
      client.projectReleaseEvidencePack({
        ...target,
        status: "Published",
      } as never),
    ).rejects.toBeDefined();
    await expect(
      client.addReleaseChecklistItem({
        ...target,
        text: "x",
        workStatus: "Done",
      } as never),
    ).rejects.toBeDefined();
  });

  test("exposes no publish, score, gate or domain-write procedure", () => {
    const names = Object.keys(appRouter).filter((name) =>
      RELEASE_PROCEDURE.test(name),
    );
    expect(names.sort()).toEqual([
      "addReleaseChecklistItem",
      "closeReleaseOpenScopeSignal",
      "projectReleaseEvidencePack",
      "projectReleaseOpenScopeSignal",
      "removeReleaseChecklistItem",
      "setReleaseChecklistItem",
    ]);
  });
});
