import { describe, expect, test } from "vitest";

import {
  createReleaseEvidence,
  ReleaseEvidenceChecklistItemNotFoundError,
  ReleaseEvidenceProjectNotFoundError,
  ReleaseEvidenceProjectReadOnlyError,
  ReleaseEvidenceReleaseNotFoundError,
  type ReleaseEvidenceSourceFacts,
} from "../release-evidence";
import { createMemoryReleaseEvidence } from "./release-evidence-memory-store";

const ACCOUNT = "account-1";
const ok = <T>(value: T) => ({ available: true as const, value });

const completeSources = (): ReleaseEvidenceSourceFacts => ({
  assessment: ok(null),
  decisions: ok([]),
  gaps: ok([]),
  inconsistencies: ok([]),
  publishDiff: ok({ changelogPrepared: true, snapshotApproved: true }),
  pullRequests: ok([]),
  risks: ok([]),
  scope: ok([
    {
      expectedOutcome: "Ship",
      id: "work-1",
      key: "TID-1",
      status: "In Progress",
      title: "Ship",
    },
  ]),
  tests: ok({ cases: [], contextChanges: [], handoffs: [], sessionTests: [] }),
});

function setup(
  status: "Draft" | "Preparing" | "Published" = "Preparing",
  sources = completeSources(),
  archived = false,
) {
  const harness = createMemoryReleaseEvidence({
    accountId: ACCOUNT,
    archivedProjectIds: archived ? ["project-1"] : [],
    projectIds: ["project-1"],
    releases: [
      {
        id: "release-1",
        name: "tidekit 1.0",
        projectId: "project-1",
        status,
        versionLabel: null,
      },
    ],
    sources: new Map([["release-1", sources]]),
  });
  return createReleaseEvidence(harness.store, harness.sources);
}

const target = { projectId: "project-1", releaseId: "release-1" };

describe("Release Evidence Pack access", () => {
  test("derives the pack from sources on every read and writes nothing", async () => {
    const access = setup();
    const first = await access.pack(ACCOUNT, target);
    const second = await access.pack(ACCOUNT, target);
    expect(second).toEqual(first);
    expect(first.release.name).toBe("tidekit 1.0");
  });

  test("exposes only checklist and signal-close writes: no domain, status or publish command", () => {
    const access = setup();
    expect(Object.keys(access).sort()).toEqual([
      "addChecklistItem",
      "closeOpenScopeSignal",
      "openScopeSignal",
      "pack",
      "removeChecklistItem",
      "setChecklistItem",
    ]);
  });

  test("a checklist is the founder's, and checking a line neither gates nor changes anything else", async () => {
    const access = setup();
    const before = await access.pack(ACCOUNT, target);
    const item = await access.addChecklistItem(ACCOUNT, {
      ...target,
      text: "Tag the repo",
    });
    expect(item).toMatchObject({ checked: false, text: "Tag the repo" });
    await access.setChecklistItem(ACCOUNT, {
      ...target,
      checked: true,
      itemId: item.id,
    });
    const after = await access.pack(ACCOUNT, target);
    expect(after.checklist).toEqual([{ ...item, checked: true }]);
    expect(after.attention).toEqual(before.attention);
    expect(after.release).toEqual(before.release);
    await access.removeChecklistItem(ACCOUNT, { ...target, itemId: item.id });
    expect((await access.pack(ACCOUNT, target)).checklist).toEqual([]);
    await expect(
      access.setChecklistItem(ACCOUNT, {
        ...target,
        checked: true,
        itemId: "missing",
      }),
    ).rejects.toBeInstanceOf(ReleaseEvidenceChecklistItemNotFoundError);
  });

  test("a write that tries to carry a domain field is refused at the contract", async () => {
    const access = setup();
    await expect(
      access.addChecklistItem(ACCOUNT, {
        ...target,
        status: "Published",
        text: "x",
      } as never),
    ).rejects.toThrow();
    await expect(
      access.pack(ACCOUNT, { ...target, score: 1 } as never),
    ).rejects.toThrow();
  });

  test("another account, an unknown release and an archived Project are refused", async () => {
    const access = setup();
    await expect(access.pack("someone-else", target)).rejects.toBeInstanceOf(
      ReleaseEvidenceProjectNotFoundError,
    );
    await expect(
      access.pack(ACCOUNT, { ...target, releaseId: "nope" }),
    ).rejects.toBeInstanceOf(ReleaseEvidenceReleaseNotFoundError);
    const archived = setup("Draft", completeSources(), true);
    expect((await archived.pack(ACCOUNT, target)).readOnly).toBe(true);
    await expect(
      archived.addChecklistItem(ACCOUNT, { ...target, text: "x" }),
    ).rejects.toBeInstanceOf(ReleaseEvidenceProjectReadOnlyError);
  });

  test("a missing source stays a visible attention row, not an omission", async () => {
    const access = setup("Draft", {
      ...completeSources(),
      publishDiff: { available: false, reason: "Changelog is not available." },
      scope: { available: false, reason: "Scope is not available." },
    });
    const pack = await access.pack(ACCOUNT, target);
    expect(pack.sections).toHaveLength(6);
    expect(
      pack.attention.filter((row) => row.reason === "source-unavailable"),
    ).toHaveLength(2);
  });

  test("Published with open Work gives one deduped, closeable signal that blocks nothing", async () => {
    const access = setup("Published");
    const signal = await access.openScopeSignal(ACCOUNT, target);
    expect(signal).toMatchObject({
      blocksPublish: false,
      closed: false,
      openWork: [{ key: "TID-1" }],
      signalId: "published-release-open-scope:release-1",
    });
    expect((await access.openScopeSignal(ACCOUNT, target))?.signalId).toBe(
      signal?.signalId,
    );
    await access.closeOpenScopeSignal(ACCOUNT, target);
    await access.closeOpenScopeSignal(ACCOUNT, target);
    expect((await access.openScopeSignal(ACCOUNT, target))?.closed).toBe(true);
    // Closing the signal leaves the release and its scope untouched.
    const pack = await access.pack(ACCOUNT, target);
    expect(pack.release.status).toBe("Published");
    expect(
      pack.attention.some(
        (row) => row.reason === "published-release-open-scope",
      ),
    ).toBe(true);
  });

  test("a Preparing release has no open-scope signal", async () => {
    expect(await setup().openScopeSignal(ACCOUNT, target)).toBeNull();
  });
});
