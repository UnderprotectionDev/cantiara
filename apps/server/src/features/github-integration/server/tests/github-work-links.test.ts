// biome-ignore-all lint/performance/noAwaitInLoops: The role refusals are checked one target after another.
import {
  GITHUB_ROLE_CONTEXTUAL_LABEL,
  GITHUB_ROLE_REQUIRED_LABEL,
  GITHUB_WORK_LINK_ROLES,
  matchWorkKeys,
} from "@cantiara/api/github-work-links";
import { describe, expect, test } from "vitest";

import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  otherAccountId,
  projectId,
} from "../github-integration-memory-store";

const INSTALLATION = 900;
const REPOSITORY = 11;
const OPEN_PR_SIGNAL = /^unlinked-open-pr:/;
const NEUTRAL_SUMMARY = /is Completed and Pull request #3 is open/;

type Harness = ReturnType<typeof createMemoryHarness>;

function seeded() {
  const harness = createMemoryHarness();
  harness.app.install(INSTALLATION, "acme", [
    { id: REPOSITORY, name: "web", owner: "acme" },
  ]);
  harness.work.add(projectId, { key: "CAN-1", title: "Checkout retry" });
  harness.work.add(projectId, { key: "CAN-2", title: "Fix layout" });
  harness.work.add(projectId, {
    key: "CAN-12",
    previousKeys: ["CAN-7"],
    title: "Renumbered work",
  });
  harness.work.add("project-2", { key: "OTH-1", title: "Other project" });
  return harness;
}

async function connect(harness: Harness) {
  const { installUrl } = await harness.github.startInstall(accountId, {
    projectId,
  });
  const state = new URL(installUrl).searchParams.get("state") ?? "";
  await harness.github.completeInstall(accountId, {
    installationId: INSTALLATION,
    state,
  });
  return await harness.github.linkRepository(accountId, {
    installationId: INSTALLATION,
    projectId,
    repositoryId: REPOSITORY,
  });
}

function addPull(
  harness: Harness,
  pull: {
    body?: string;
    closed?: boolean;
    headBranch?: string;
    id: number;
    number: number;
    title: string;
  },
) {
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    ...pull,
    pullRequest: true,
    updatedAt: "2026-09-30T11:00:00.000Z",
  });
}

async function recordNamed(harness: Harness, number: number) {
  const { records } = await harness.github.searchRecords(accountId, {
    projectId,
    query: "",
  });
  const record = records.find((candidate) => candidate.number === number);
  if (!record) {
    throw new Error(`No record #${number}`);
  }
  return record;
}

const overview = (harness: Harness) =>
  harness.github.workLinks(accountId, { projectId });

describe("Work-GitHub links: role mapping", () => {
  test("the role catalog is closed", () => {
    expect([...GITHUB_WORK_LINK_ROLES]).toEqual([
      "Required for completion",
      "Contextual",
    ]);
  });

  test("Fixes, Closes or Resolves with a unique key is Required for completion", async () => {
    const harness = seeded();
    for (const [index, word] of ["Fixes", "closes", "RESOLVES"].entries()) {
      addPull(harness, {
        body: `${word} CAN-1`,
        id: 6000 + index,
        number: 10 + index,
        title: `Change ${index}`,
      });
    }
    await connect(harness);
    const { links } = await overview(harness);
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toMatchObject({
        matchedKey: "CAN-1",
        origin: "Key match",
        role: GITHUB_ROLE_REQUIRED_LABEL,
        workKey: "CAN-1",
      });
    }
  });

  test("any other unique match is Contextual", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Related to CAN-2",
      id: 6001,
      number: 20,
      title: "Touches layout",
    });
    addPull(harness, { id: 6002, number: 21, title: "CAN-1 add retry" });
    // A closing word that is not supported, and a key far from the word.
    addPull(harness, {
      body: "Completes CAN-1",
      id: 6003,
      number: 22,
      title: "Almost",
    });
    addPull(harness, {
      body: "Fixes the bug described in CAN-1",
      id: 6004,
      number: 23,
      title: "Words between",
    });
    await connect(harness);
    const { links } = await overview(harness);
    expect(links).toHaveLength(4);
    expect(new Set(links.map((link) => link.role))).toEqual(
      new Set([GITHUB_ROLE_CONTEXTUAL_LABEL]),
    );
  });

  test("a branch name key links a Pull request as Contextual", async () => {
    const harness = seeded();
    addPull(harness, {
      headBranch: "feature/can-2-fix-layout",
      id: 6005,
      number: 30,
      title: "Layout",
    });
    await connect(harness);
    const { links } = await overview(harness);
    expect(links).toMatchObject([
      {
        matchedKey: "CAN-2",
        role: GITHUB_ROLE_CONTEXTUAL_LABEL,
        workKey: "CAN-2",
      },
    ]);
  });

  test("a Work key from the key history links to the surviving Work", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Fixes CAN-7",
      id: 6006,
      number: 31,
      title: "Old key",
    });
    await connect(harness);
    const { links } = await overview(harness);
    expect(links).toMatchObject([
      {
        matchedKey: "CAN-7",
        role: GITHUB_ROLE_REQUIRED_LABEL,
        workKey: "CAN-12",
      },
    ]);
  });

  test("an Issue is only ever Contextual, even with a closing word", async () => {
    const harness = seeded();
    harness.app.addIssue(INSTALLATION, REPOSITORY, {
      body: "Fixes CAN-2",
      id: 5001,
      number: 40,
      title: "Layout bug",
    });
    await connect(harness);
    const { links } = await overview(harness);
    expect(links).toMatchObject([
      { kind: "Issue", role: GITHUB_ROLE_CONTEXTUAL_LABEL },
    ]);
  });

  test("the key matcher is pure: the same text yields the same outcome", () => {
    const scope = {
      otherShortCodes: ["OTH"],
      ownShortCodes: ["CAN"],
      works: [
        {
          closureResult: null,
          id: "w1",
          key: "CAN-1",
          previousKeys: [],
          retiredIds: [],
          status: "Not Started" as const,
          title: "One",
          trashed: false,
        },
      ],
    };
    const input = {
      kind: "Pull request" as const,
      scope,
      texts: ["Closes CAN-1"],
    };
    expect(matchWorkKeys(input)).toEqual(matchWorkKeys(input));
    expect(matchWorkKeys(input)).toMatchObject({
      outcome: "link",
      role: GITHUB_ROLE_REQUIRED_LABEL,
    });
    // Text without a key shape, and a lookalike with an unknown prefix, do nothing.
    expect(matchWorkKeys({ ...input, texts: ["SHA-256 and UTF-8"] })).toEqual({
      outcome: "none",
      suggestions: [],
    });
  });
});

describe("Work-GitHub links: key collisions only suggest", () => {
  test("two keys, a missing key and an other-Project key never link and never mint Work", async () => {
    const harness = seeded();
    const worksBefore = harness.work.snapshot();
    addPull(harness, {
      body: "Fixes CAN-1 and CAN-2",
      id: 6010,
      number: 50,
      title: "Two",
    });
    addPull(harness, {
      body: "Fixes CAN-99",
      id: 6011,
      number: 51,
      title: "Missing",
    });
    addPull(harness, {
      body: "Closes OTH-1",
      id: 6012,
      number: 52,
      title: "Elsewhere",
    });
    addPull(harness, {
      body: "Fixes CAN-1 OTH-1",
      id: 6013,
      number: 53,
      title: "Mixed",
    });
    await connect(harness);
    const result = await overview(harness);
    expect(result.links).toEqual([]);
    const byRecord = new Map<string, string[]>();
    for (const suggestion of result.suggestions) {
      byRecord.set(suggestion.recordId, [
        ...(byRecord.get(suggestion.recordId) ?? []),
        `${suggestion.key}:${suggestion.reason}`,
      ]);
    }
    const two = await recordNamed(harness, 50);
    const missing = await recordNamed(harness, 51);
    const elsewhere = await recordNamed(harness, 52);
    const mixed = await recordNamed(harness, 53);
    expect((byRecord.get(two.id) ?? []).sort()).toEqual([
      "CAN-1:Multiple Work keys",
      "CAN-2:Multiple Work keys",
    ]);
    expect(byRecord.get(missing.id)).toEqual(["CAN-99:No Work with this key"]);
    expect(byRecord.get(elsewhere.id)).toEqual([
      "OTH-1:Key belongs to another Project",
    ]);
    expect((byRecord.get(mixed.id) ?? []).sort()).toEqual([
      "CAN-1:Multiple Work keys",
      "OTH-1:Key belongs to another Project",
    ]);
    // No second Work appeared and no Work row moved.
    expect(harness.work.snapshot()).toEqual(worksBefore);
  });

  test("a trashed Work is not a match", async () => {
    const harness = seeded();
    harness.work.trash("work-CAN-2");
    addPull(harness, {
      body: "Fixes CAN-2",
      id: 6014,
      number: 54,
      title: "Trashed target",
    });
    await connect(harness);
    const result = await overview(harness);
    expect(result.links).toEqual([]);
    expect(result.suggestions).toMatchObject([
      { key: "CAN-2", reason: "No Work with this key" },
    ]);
  });

  test("a suggestion is accepted only by a manual link that picks the role", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Fixes CAN-1 and CAN-2",
      id: 6015,
      number: 55,
      title: "Two",
    });
    await connect(harness);
    const record = await recordNamed(harness, 55);
    const link = await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: { kind: "record", recordId: record.id },
      workId: "work-CAN-2",
    });
    expect(link).toMatchObject({
      origin: "Manual",
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      workKey: "CAN-2",
    });
  });
});

describe("Work-GitHub links: manual links", () => {
  test("a manual pick chooses the role and a Pull request links many Work and the reverse", async () => {
    const harness = seeded();
    addPull(harness, { id: 6020, number: 60, title: "First" });
    addPull(harness, { id: 6021, number: 61, title: "Second" });
    await connect(harness);
    const first = await recordNamed(harness, 60);
    const second = await recordNamed(harness, 61);
    const link = (
      workId: string,
      recordId: string,
      role: "Contextual" | "Required for completion",
    ) =>
      harness.github.linkWork(accountId, {
        projectId,
        role,
        target: { kind: "record", recordId },
        workId,
      });
    await link("work-CAN-1", first.id, GITHUB_ROLE_REQUIRED_LABEL);
    await link("work-CAN-2", first.id, GITHUB_ROLE_CONTEXTUAL_LABEL);
    await link("work-CAN-1", second.id, GITHUB_ROLE_CONTEXTUAL_LABEL);
    const { links } = await overview(harness);
    expect(
      links.map((item) => `${item.workKey}:${item.number}:${item.role}`).sort(),
    ).toEqual([
      "CAN-1:60:Required for completion",
      "CAN-1:61:Contextual",
      "CAN-2:60:Contextual",
    ]);
    await expect(
      link("work-CAN-1", first.id, GITHUB_ROLE_CONTEXTUAL_LABEL),
    ).rejects.toMatchObject({ code: "GITHUB_WORK_LINK_EXISTS" });
  });

  test("Required for completion is refused on an Issue, a commit and a branch", async () => {
    const harness = seeded();
    harness.app.addIssue(INSTALLATION, REPOSITORY, {
      id: 5002,
      number: 62,
      title: "An Issue",
    });
    const repository = await connect(harness);
    const issue = await recordNamed(harness, 62);
    for (const target of [
      { kind: "record" as const, recordId: issue.id },
      { kind: "Commit" as const, linkId: repository.id, sha: "abcdef1234567" },
      { kind: "Branch" as const, linkId: repository.id, name: "main" },
    ]) {
      await expect(
        harness.github.linkWork(accountId, {
          projectId,
          role: GITHUB_ROLE_REQUIRED_LABEL,
          target,
          workId: "work-CAN-1",
        }),
      ).rejects.toMatchObject({ code: "GITHUB_WORK_LINK_ROLE_INVALID" });
    }
    expect((await overview(harness)).links).toEqual([]);
  });

  test("a commit and a branch link by explicit pick, with the exact commit read from GitHub", async () => {
    const harness = seeded();
    const repository = await connect(harness);
    const commit = await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: { kind: "Commit", linkId: repository.id, sha: "ABCDEF1234567" },
      workId: "work-CAN-1",
    });
    const branch = await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: {
        kind: "Branch",
        linkId: repository.id,
        name: "feature/checkout",
      },
      workId: "work-CAN-1",
    });
    expect(commit).toMatchObject({
      kind: "Commit",
      recordId: null,
      value: "abcdef1234567",
    });
    expect(branch).toMatchObject({
      kind: "Branch",
      recordId: null,
      value: "feature/checkout",
    });
    // Only the allow-listed commit endpoint was used; nothing was written.
    expect(
      harness.app.requests.filter(({ route }) =>
        route.includes("/git/commits/"),
      ),
    ).toHaveLength(1);
  });

  test("another Project's Work, a trashed Work and a foreign account are refused", async () => {
    const harness = seeded();
    addPull(harness, { id: 6022, number: 63, title: "Target" });
    await connect(harness);
    const record = await recordNamed(harness, 63);
    const attempt = (workId: string, account = accountId) =>
      harness.github.linkWork(account, {
        projectId,
        role: GITHUB_ROLE_CONTEXTUAL_LABEL,
        target: { kind: "record", recordId: record.id },
        workId,
      });
    await expect(attempt("work-OTH-1")).rejects.toMatchObject({
      code: "GITHUB_WORK_NOT_FOUND",
    });
    harness.work.trash("work-CAN-2");
    await expect(attempt("work-CAN-2")).rejects.toMatchObject({
      code: "GITHUB_WORK_NOT_FOUND",
    });
    await expect(attempt("work-CAN-1", otherAccountId)).rejects.toMatchObject({
      code: "GITHUB_PROJECT_NOT_FOUND",
    });
  });

  test("an archived Project's links are read-only", async () => {
    const harness = seeded();
    await expect(
      harness.github.linkWork(accountId, {
        projectId: archivedProjectId,
        role: GITHUB_ROLE_CONTEXTUAL_LABEL,
        target: { kind: "Branch", linkId: "x", name: "main" },
        workId: "work-CAN-1",
      }),
    ).rejects.toMatchObject({ code: "GITHUB_PROJECT_READ_ONLY" });
  });

  test("unlinking a manual link deletes it; unlinking an automatic one keeps it unlinked after the next sync", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Fixes CAN-1",
      id: 6023,
      number: 64,
      title: "Auto",
    });
    addPull(harness, { id: 6024, number: 65, title: "Manual" });
    const repository = await connect(harness);
    const manualRecord = await recordNamed(harness, 65);
    const manual = await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: { kind: "record", recordId: manualRecord.id },
      workId: "work-CAN-2",
    });
    const auto = (await overview(harness)).links.find(
      (l) => l.origin === "Key match",
    );
    expect(auto).toBeDefined();
    await harness.github.unlinkWork(accountId, {
      linkId: manual.id,
      projectId,
    });
    await harness.github.unlinkWork(accountId, {
      linkId: auto?.id ?? "",
      projectId,
    });
    expect((await overview(harness)).links).toEqual([]);
    // The same text is read again; the removed automatic link does not return.
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 64, {
      title: "Auto, edited",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    await harness.github.syncNow(accountId, {
      linkId: repository.id,
      projectId,
    });
    expect((await overview(harness)).links).toEqual([]);
    await expect(
      harness.github.unlinkWork(accountId, { linkId: manual.id, projectId }),
    ).rejects.toMatchObject({ code: "GITHUB_WORK_LINK_NOT_FOUND" });
  });
});

describe("Work-GitHub links: no GitHub or Work write, no close effect", () => {
  test("linking, key matching and unlinking leave the GitHub records and every Work untouched", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Fixes CAN-1",
      id: 6030,
      number: 70,
      title: "Closes it",
    });
    addPull(harness, { id: 6031, number: 71, title: "Plain" });
    const repository = await connect(harness);
    const recordsBefore = structuredClone(harness.stored().records);
    const worksBefore = harness.work.snapshot();
    const plain = await recordNamed(harness, 71);
    const link = await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_REQUIRED_LABEL,
      target: { kind: "record", recordId: plain.id },
      workId: "work-CAN-2",
    });
    await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: { kind: "Branch", linkId: repository.id, name: "main" },
      workId: "work-CAN-2",
    });
    await harness.github.unlinkWork(accountId, { linkId: link.id, projectId });
    expect(harness.stored().records).toEqual(recordsBefore);
    // Not Started stays Not Started: a required link does not start, block or close Work.
    expect(harness.work.snapshot()).toEqual(worksBefore);
    expect(
      harness.work
        .snapshot()
        .every(
          (work) => work.status === "Not Started" || work.id === "work-OTH-1",
        ),
    ).toBe(true);
    // Every request GitHub saw was a read (or the App's own token mint).
    for (const { route } of harness.app.requests) {
      expect(route.startsWith("GET ") || route.includes("/access_tokens")).toBe(
        true,
      );
    }
  });

  test("a merged Required for completion Pull request does not complete the Work", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Fixes CAN-1",
      id: 6032,
      number: 72,
      title: "Will merge",
    });
    const repository = await connect(harness);
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 72, {
      closed: true,
      updatedAt: "2026-10-01T09:30:00.000Z",
    });
    await harness.github.syncNow(accountId, {
      linkId: repository.id,
      projectId,
    });
    const { links } = await overview(harness);
    expect(links).toMatchObject([
      { role: GITHUB_ROLE_REQUIRED_LABEL, sourceState: "closed" },
    ]);
    // The role is only data for Work Automation (spec 62): the Work row is as seeded.
    expect(
      harness.work.snapshot().find((w) => w.id === "work-CAN-1"),
    ).toMatchObject({
      closureResult: null,
      status: "Not Started",
    });
  });

  test("a Work with no required Pull request has no close effect at all", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Related CAN-1",
      id: 6033,
      number: 73,
      title: "Context only",
    });
    await connect(harness);
    const { links } = await overview(harness);
    expect(links.filter((l) => l.role === GITHUB_ROLE_REQUIRED_LABEL)).toEqual(
      [],
    );
    expect(harness.work.snapshot().every((w) => w.closureResult === null)).toBe(
      true,
    );
  });
});

describe("Create work and link", () => {
  test("previews a one-time draft, writes nothing, then creates exactly one Work and a Contextual link", async () => {
    const harness = seeded();
    harness.app.addIssue(INSTALLATION, REPOSITORY, {
      id: 5010,
      number: 80,
      title: "Add dark mode",
    });
    const repository = await connect(harness);
    const issue = await recordNamed(harness, 80);
    const before = harness.work.snapshot();
    const preview = await harness.github.previewCreateWork(accountId, {
      projectId,
      recordId: issue.id,
    });
    expect(preview).toMatchObject({
      draft: {
        startingStatus: "Not Started",
        title: "Add dark mode",
        type: "Task",
      },
      syncsFields: false,
      writesGitHub: false,
    });
    expect(harness.work.snapshot()).toEqual(before);
    const created = await harness.github.createWorkAndLink(accountId, {
      description: "Dark theme for the app.",
      projectId,
      recordId: issue.id,
      title: "Dark mode",
      type: "Feature",
    });
    expect(created.work).toMatchObject({
      status: "Not Started",
      title: "Dark mode",
    });
    expect(created.link).toMatchObject({
      origin: "Create work and link",
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      workId: created.work.id,
    });
    expect(harness.work.snapshot()).toHaveLength(before.length + 1);
    // No continuous field sync: the GitHub title changes, the Work title does not.
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 80, {
      title: "Add a dark theme",
      updatedAt: "2026-10-01T09:00:00.000Z",
    });
    await harness.github.syncNow(accountId, {
      linkId: repository.id,
      projectId,
    });
    expect((await recordNamed(harness, 80)).title).toBe("Add a dark theme");
    expect(
      harness.work.snapshot().find((w) => w.id === created.work.id)?.title,
    ).toBe("Dark mode");
    // The link can be removed; the Work stays.
    await harness.github.unlinkWork(accountId, {
      linkId: created.link.id,
      projectId,
    });
    expect(
      harness.work.snapshot().find((w) => w.id === created.work.id),
    ).toBeDefined();
  });

  test("starts from an Issue only", async () => {
    const harness = seeded();
    addPull(harness, { id: 6040, number: 81, title: "A PR" });
    await connect(harness);
    const pull = await recordNamed(harness, 81);
    await expect(
      harness.github.previewCreateWork(accountId, {
        projectId,
        recordId: pull.id,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_WORK_LINK_TARGET_UNAVAILABLE" });
    await expect(
      harness.github.createWorkAndLink(accountId, {
        description: "",
        projectId,
        recordId: pull.id,
        title: "Nope",
        type: "Task",
      }),
    ).rejects.toMatchObject({ code: "GITHUB_WORK_LINK_TARGET_UNAVAILABLE" });
  });
});

describe("Attention signals", () => {
  test("a Completed Work with an open Pull request is a neutral, source-linked signal and writes no status", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Fixes CAN-1",
      id: 6050,
      number: 3,
      title: "Still open",
    });
    await connect(harness);
    harness.work.complete("work-CAN-1");
    const worksBefore = harness.work.snapshot();
    const signals = await harness.github.attentionSignals(accountId, {
      projectId,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      presentation: "Action Required",
      record: { kind: "Pull request", number: 3, sourceState: "open" },
      signalType: "work-pr-status-conflict",
      work: { key: "CAN-1" },
    });
    expect(signals[0]?.summary).toMatch(NEUTRAL_SUMMARY);
    expect(harness.work.snapshot()).toEqual(worksBefore);
    // Asking again does not open a second signal.
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toHaveLength(1);
  });

  test("the signal ends when the Pull request is no longer open", async () => {
    const harness = seeded();
    addPull(harness, {
      body: "Fixes CAN-1",
      id: 6051,
      number: 3,
      title: "Still open",
    });
    const repository = await connect(harness);
    harness.work.complete("work-CAN-1");
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toHaveLength(1);
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 3, {
      closed: true,
      updatedAt: "2026-10-01T09:30:00.000Z",
    });
    await harness.github.syncNow(accountId, {
      linkId: repository.id,
      projectId,
    });
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toEqual([]);
  });

  test("an open Project-linked Pull request with no Work link is one deduped signal on the existing record", async () => {
    const harness = seeded();
    addPull(harness, { id: 6052, number: 90, title: "Nobody links me" });
    const repository = await connect(harness);
    const recordsBefore = harness.stored().records.length;
    const first = await harness.github.attentionSignals(accountId, {
      projectId,
    });
    expect(first).toHaveLength(1);
    const record = await recordNamed(harness, 90);
    expect(first[0]).toMatchObject({
      presentation: "Action Required",
      record: { id: record.id, kind: "Pull request" },
      signalId: `unlinked-open-pr:${record.id}`,
      signalType: "unlinked-open-pr",
      work: null,
    });
    expect(first[0]?.signalId).toMatch(OPEN_PR_SIGNAL);
    // Repeated syncs and reads dedupe on the same record; no new identity or Work appears.
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 90, {
      title: "Nobody links me, edited",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    await harness.github.syncNow(accountId, {
      linkId: repository.id,
      projectId,
    });
    await harness.github.syncNow(accountId, {
      linkId: repository.id,
      projectId,
    });
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toHaveLength(1);
    expect(harness.stored().signals).toHaveLength(1);
    expect(harness.stored().records).toHaveLength(recordsBefore);
    expect(harness.work.snapshot()).toHaveLength(4);
  });

  test("dismissing holds across syncs; linking ends the signal; unlinking raises it again", async () => {
    const harness = seeded();
    addPull(harness, { id: 6053, number: 91, title: "Dismiss me" });
    addPull(harness, { id: 6054, number: 92, title: "Link me" });
    const repository = await connect(harness);
    const dismissed = (await recordNamed(harness, 91)).id;
    const [first] = (
      await harness.github.attentionSignals(accountId, { projectId })
    ).filter((signal) => signal.record.id === dismissed);
    await harness.github.dismissSignal(accountId, {
      projectId,
      signalId: first?.signalId ?? "",
    });
    harness.app.updateIssue(INSTALLATION, REPOSITORY, 91, {
      title: "Dismiss me again",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    await harness.github.syncNow(accountId, {
      linkId: repository.id,
      projectId,
    });
    const open = await harness.github.attentionSignals(accountId, {
      projectId,
    });
    expect(open.map((signal) => signal.record.number)).toEqual([92]);
    const link = await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: { kind: "record", recordId: open[0]?.record.id ?? "" },
      workId: "work-CAN-1",
    });
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toEqual([]);
    await harness.github.unlinkWork(accountId, { linkId: link.id, projectId });
    expect(
      (await harness.github.attentionSignals(accountId, { projectId })).map(
        (signal) => signal.record.number,
      ),
    ).toEqual([92]);
  });

  test("a closed or merged Pull request, an Issue, a commit and a branch never raise the unlinked signal", async () => {
    const harness = seeded();
    addPull(harness, { closed: true, id: 6055, number: 93, title: "Closed" });
    harness.app.addIssue(INSTALLATION, REPOSITORY, {
      id: 5020,
      number: 94,
      title: "Unlinked Issue",
    });
    const repository = await connect(harness);
    // A commit and a branch exist only as explicit links: they are never records to signal on.
    await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: { kind: "Commit", linkId: repository.id, sha: "abcdef1234567" },
      workId: "work-CAN-1",
    });
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toEqual([]);
    expect(harness.stored().signals).toEqual([]);
  });

  test("a commit or branch link does not stand in for a Work link of an open Pull request", async () => {
    const harness = seeded();
    addPull(harness, { id: 6056, number: 95, title: "Open and unlinked" });
    const repository = await connect(harness);
    await harness.github.linkWork(accountId, {
      projectId,
      role: GITHUB_ROLE_CONTEXTUAL_LABEL,
      target: { kind: "Branch", linkId: repository.id, name: "feature/x" },
      workId: "work-CAN-1",
    });
    expect(
      (await harness.github.attentionSignals(accountId, { projectId })).map(
        (signal) => signal.signalType,
      ),
    ).toEqual(["unlinked-open-pr"]);
  });

  test("a Trash or Archived record raises no signal and a disconnected Repository none either", async () => {
    const harness = seeded();
    addPull(harness, { id: 6057, number: 96, title: "Trash me" });
    addPull(harness, { id: 6058, number: 97, title: "Archive me" });
    const repository = await connect(harness);
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toHaveLength(2);
    await harness.github.trashRecord(accountId, {
      projectId,
      recordId: (await recordNamed(harness, 96)).id,
    });
    await harness.github.archiveRecord(accountId, {
      projectId,
      recordId: (await recordNamed(harness, 97)).id,
    });
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toEqual([]);
    await harness.github.disconnect(accountId, {
      linkId: repository.id,
      projectId,
    });
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toEqual([]);
  });
});
