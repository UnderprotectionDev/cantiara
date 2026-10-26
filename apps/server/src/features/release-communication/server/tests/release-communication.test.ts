// biome-ignore-all lint/suspicious/useAwait: the in-memory double implements the async port.
import { ReleaseCommunicationError } from "@cantiara/api/release-communication";
import { describe, expect, test } from "vitest";
import { createLookAgainSchedule } from "../release-communication-database";
import {
  ACCOUNT_ID,
  createFixtures,
  createScopeWork,
  PROJECT_ID,
  RELEASE_ID,
} from "./release-communication-fixtures";

const draft = {
  body: "The editor now starts in one click.",
  releaseId: RELEASE_ID,
  scopeWorkIds: ["work-1"],
};

async function savedFixture(fixtures = createFixtures(), extra: object = {}) {
  const note = await fixtures.access.saveDraft(ACCOUNT_ID, {
    ...draft,
    ...extra,
    baseRevision: 0,
  });
  if (!note) {
    throw new Error("draft not saved");
  }
  return { fixtures, note };
}

async function approvalFor(
  fixtures: ReturnType<typeof createFixtures>,
  noteId: string,
) {
  const preview = await fixtures.access.previewPublish(ACCOUNT_ID, noteId);
  if (!preview) {
    throw new Error("no preview");
  }
  return {
    approval: {
      buildInPublicEventIds: preview.buildInPublicEvents.map((e) => e.id),
      changelogLinkHrefs: preview.changelogLinks.map((l) => l.href),
      fingerprint: preview.fingerprint,
      publicLabels: preview.scope.flatMap((item) =>
        item.proposedPublicLabel
          ? [{ label: item.proposedPublicLabel, workId: item.workId }]
          : [],
      ),
      whyTrail: preview.whyTrail.map((item) => ({
        approvedFields: item.proposedFields.map((f) => f.name),
        sourceId: item.sourceId,
        sourceType: item.sourceType,
      })),
    },
    noteId,
  };
}

describe("Release notes bound to scope", () => {
  test("a draft needs scope binds and every bind lives in the Release scope", async () => {
    const fixtures = createFixtures();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        scopeWorkIds: [],
      }),
    ).rejects.toThrow();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        scopeWorkIds: ["work-elsewhere"],
      }),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_SCOPE_INVALID" });
    expect(await fixtures.access.listNotes(ACCOUNT_ID, RELEASE_ID)).toEqual([]);
  });

  test("a draft stays private: the changelog lists only published snapshots", async () => {
    const { fixtures } = await savedFixture();
    expect(
      await fixtures.access.changelog(ACCOUNT_ID, {
        projectId: "project-1",
        tagIds: [],
      }),
    ).toEqual([]);
  });

  test("GitHub Release text has no input: it is not accepted as the note", async () => {
    const fixtures = createFixtures();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        githubReleaseBody: "copied from GitHub",
      } as never),
    ).rejects.toThrow();
  });

  test("stale drafts conflict and another account sees nothing", async () => {
    const { fixtures, note } = await savedFixture();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        noteId: note.id,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_STALE_REVISION" });
    expect(
      await fixtures.access.listNotes("someone-else", RELEASE_ID),
    ).toBeNull();
    expect(
      await fixtures.access.previewPublish("someone-else", note.id),
    ).toBeNull();
  });

  test("tags must already exist in the Project", async () => {
    const fixtures = createFixtures();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        tagIds: ["invented-changelog-tag"],
      }),
    ).rejects.toBeInstanceOf(ReleaseCommunicationError);
  });
});

describe("Publish-close preview", () => {
  test("shows statuses, labels, links, trail snapshots and events together and writes nothing", async () => {
    const { fixtures, note } = await savedFixture(createFixtures(), {
      whyTrail: [
        {
          approvedFields: ["Summary"],
          sourceId: "decision-1",
          sourceType: "Decision",
        },
      ],
    });

    const preview = await fixtures.access.previewPublish(ACCOUNT_ID, note.id);

    expect(preview).toMatchObject({
      buildInPublicEvents: [{ id: "event-1" }],
      changelogLinks: [{ label: "Changelog" }],
      findings: [],
      scope: [
        {
          currentPublicLabel: null,
          internalStatus: "Closed",
          proposedPublicLabel: "Released",
          workId: "work-1",
        },
      ],
      whyTrail: [
        {
          proposedFields: [
            { name: "Summary", value: "Starting in one click matters most." },
          ],
        },
      ],
      written: false,
    });
    // Cancelling is leaving: the draft is untouched and nothing is public.
    const [still] =
      (await fixtures.access.listNotes(ACCOUNT_ID, RELEASE_ID)) ?? [];
    expect(still?.status).toBe("Draft");
    expect(
      await fixtures.access.changelog(ACCOUNT_ID, {
        projectId: "project-1",
        tagIds: [],
      }),
    ).toEqual([]);
  });

  test("selecting a record publishes none of its fields", async () => {
    const { fixtures, note } = await savedFixture(createFixtures(), {
      whyTrail: [{ sourceId: "decision-1", sourceType: "Decision" }],
    });
    const preview = await fixtures.access.previewPublish(ACCOUNT_ID, note.id);
    expect(preview?.whyTrail).toEqual([]);

    const entry = await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, note.id),
    );
    expect(entry?.whyTrail).toEqual([]);
  });

  test("text-only notes publish without a Why was this done? trail", async () => {
    const { fixtures, note } = await savedFixture();
    const entry = await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, note.id),
    );
    expect(entry).toMatchObject({ body: draft.body, whyTrail: [] });
  });

  test("blocks placeholders, secrets, out-of-scope Work keys and echoed private records", async () => {
    const fixtures = createFixtures();
    const cases = [
      ["TODO write the real note", "placeholder"],
      ["Mail founder@example.com for access", "sensitive-data"],
      ["This also fixes CNT-9", "closed-world"],
      ["Because of the Start-up decision", "indirect-leak"],
    ] as const;
    for (const [body, check] of cases) {
      // biome-ignore lint/performance/noAwaitInLoops: each case is its own draft.
      const note = await fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        body,
        whyTrail: [{ sourceId: "decision-1", sourceType: "Decision" }],
      });
      const preview = await fixtures.access.previewPublish(
        ACCOUNT_ID,
        note?.id ?? "",
      );
      expect(preview?.findings.map((f) => f.check)).toContain(check);
      await expect(
        fixtures.access.publish(ACCOUNT_ID, {
          approval: {
            buildInPublicEventIds: [],
            changelogLinkHrefs: [],
            fingerprint: preview?.fingerprint ?? "",
            publicLabels: [],
            whyTrail: [],
          },
          noteId: note?.id ?? "",
        }),
      ).rejects.toMatchObject({
        code: "RELEASE_COMMUNICATION_PREVIEW_BLOCKED",
      });
    }
  });

  test("a changed draft makes the earlier approval stale", async () => {
    const { fixtures, note } = await savedFixture();
    const approval = await approvalFor(fixtures, note.id);
    await fixtures.access.saveDraft(ACCOUNT_ID, {
      ...draft,
      baseRevision: note.revision,
      body: "A different note.",
      noteId: note.id,
    });
    await expect(
      fixtures.access.publish(ACCOUNT_ID, approval),
    ).rejects.toMatchObject({
      code: "RELEASE_COMMUNICATION_PREVIEW_STALE",
    });
  });
});

describe("Publish", () => {
  test("applies only the approved items; the rest stays private and unchanged", async () => {
    const fixtures = createFixtures({
      scope: [
        createScopeWork(),
        createScopeWork({
          id: "work-2",
          internalStatus: "Blocked",
          key: "CNT-2",
          proposedPublicLabel: "Released",
          title: "Editor shortcuts",
        }),
      ],
    });
    const { note } = await savedFixture(fixtures, {
      scopeWorkIds: ["work-1", "work-2"],
      whyTrail: [
        {
          approvedFields: ["Summary", "Context"],
          sourceId: "decision-1",
          sourceType: "Decision",
        },
      ],
    });
    const full = await approvalFor(fixtures, note.id);

    const entry = await fixtures.access.publish(ACCOUNT_ID, {
      ...full,
      approval: {
        ...full.approval,
        publicLabels: [{ label: "Released", workId: "work-1" }],
        whyTrail: [
          {
            approvedFields: ["Summary"],
            sourceId: "decision-1",
            sourceType: "Decision",
          },
        ],
      },
    });

    expect(entry?.publicLabels).toEqual([
      { label: "Released", workId: "work-1" },
    ]);
    expect(entry?.whyTrail[0]?.proposedFields).toEqual([
      { name: "Summary", value: "Starting in one click matters most." },
    ]);
  });

  test("an unproposed label cannot be smuggled in by approval", async () => {
    const { fixtures, note } = await savedFixture();
    const full = await approvalFor(fixtures, note.id);
    const entry = await fixtures.access.publish(ACCOUNT_ID, {
      ...full,
      approval: {
        ...full.approval,
        publicLabels: [{ label: "Completed", workId: "work-1" }],
      },
    });
    expect(entry?.publicLabels).toEqual([]);
    expect(entry?.buildInPublicEventIds).toEqual(["event-1"]);
  });

  test("never completes Work or writes a Release status, and the note is frozen", async () => {
    const { fixtures, note } = await savedFixture();
    const before = JSON.stringify({
      release: fixtures.release,
      scope: fixtures.scope,
    });

    await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, note.id),
    );

    expect(
      JSON.stringify({ release: fixtures.release, scope: fixtures.scope }),
    ).toBe(before);
    expect(fixtures.release.status).toBe("Preparing");
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: note.revision,
        noteId: note.id,
      }),
    ).rejects.toMatchObject({
      code: "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
    });
  });

  test("the changelog assembles published notes across Releases and filters by existing tags", async () => {
    const fixtures = createFixtures();
    const first = await savedFixture(fixtures, { tagIds: ["tag-editor"] });
    await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, first.note.id),
    );
    const second = await fixtures.access.saveDraft(ACCOUNT_ID, {
      ...draft,
      baseRevision: 0,
      body: "Shortcuts landed.",
      tagIds: ["tag-shortcuts"],
    });
    await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, second?.id ?? ""),
    );

    const all = await fixtures.access.changelog(ACCOUNT_ID, {
      projectId: "project-1",
      tagIds: [],
    });
    const editor = await fixtures.access.changelog(ACCOUNT_ID, {
      projectId: "project-1",
      tagIds: ["tag-editor"],
    });
    expect(all).toHaveLength(2);
    expect(editor?.map((entry) => entry.body)).toEqual([draft.body]);
  });
});

const VERDICT_KEY = /score|success|verdict|health/i;

function published() {
  return createFixtures({
    release: { status: "Published" },
    scope: [createScopeWork({ observedOutcome: "Editor opens faster" })],
  });
}

async function startRound(fixtures: ReturnType<typeof createFixtures>) {
  const round = await fixtures.access.startReassessment(ACCOUNT_ID, {
    releaseId: RELEASE_ID,
  });
  if (!round) {
    throw new Error("no round");
  }
  return round;
}

function observe(
  fixtures: ReturnType<typeof createFixtures>,
  roundId: string,
  kind: "access" | "outcome",
  extra: Record<string, unknown> = {},
) {
  return fixtures.access.recordObservation(ACCOUNT_ID, {
    assessment: "Observed",
    baseRevision: 0,
    evidence: [],
    kind,
    roundId,
    text: "",
    ...extra,
  } as never);
}

describe("Reassess impact", () => {
  test("places Goal, hypothesis, expected vs observed and earlier rounds side by side", async () => {
    const fixtures = published();
    const first = await startRound(fixtures);
    await observe(fixtures, first.id, "access", { text: "Reached 5 of 20" });
    fixtures.tick(14);
    await startRound(fixtures);

    const view = await fixtures.access.reassessment(ACCOUNT_ID, RELEASE_ID);

    expect(view).toMatchObject({
      blocksClose: false,
      goal: { title: "Faster start" },
      hypothesis: "Founders open the editor sooner",
      scope: [
        {
          expectedOutcome: "Founders reach the editor in one click",
          observedOutcome: "Editor opens faster",
          sourcePath: "/projects/project-1/work/work-1",
        },
      ],
    });
    expect(view?.rounds.map((round) => round.sequence)).toEqual([1, 2]);
    expect(view?.rounds[0]?.access?.text).toBe("Reached 5 of 20");
  });

  test("opens only after the Release is published and never writes it", async () => {
    const fixtures = createFixtures();
    await expect(
      fixtures.access.startReassessment(ACCOUNT_ID, { releaseId: RELEASE_ID }),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_NOT_PUBLISHED" });
    expect(fixtures.release.status).toBe("Preparing");
  });

  test("skipping reassessment is allowed and blocks nothing", async () => {
    const fixtures = published();
    const view = await fixtures.access.reassessment(ACCOUNT_ID, RELEASE_ID);
    expect(view?.rounds).toEqual([]);
    expect(view?.blocksClose).toBe(false);
    expect(await fixtures.access.actionNeeded(ACCOUNT_ID, PROJECT_ID)).toEqual(
      [],
    );
  });
});

describe("Access observation and Outcome observation", () => {
  test("stay separate: no combined verdict exists on the round", async () => {
    const fixtures = published();
    const round = await startRound(fixtures);
    await observe(fixtures, round.id, "access", { assessment: "Observed" });
    const saved = await observe(fixtures, round.id, "outcome", {
      assessment: "Not observed",
    });

    expect(saved?.access?.assessment).toBe("Observed");
    expect(saved?.outcome?.assessment).toBe("Not observed");
    const keys = Object.keys(saved ?? {});
    expect(keys.filter((key) => VERDICT_KEY.test(key))).toEqual([]);
  });

  test("a single field is an in-progress round that raises Action-needed", async () => {
    const fixtures = published();
    const round = await startRound(fixtures);
    expect(round.actionNeeded).toBe(true);

    const half = await observe(fixtures, round.id, "access");
    expect(half?.actionNeeded).toBe(true);
    expect(
      await fixtures.access.actionNeeded(ACCOUNT_ID, PROJECT_ID),
    ).toHaveLength(1);

    const both = await observe(fixtures, round.id, "outcome", {
      assessment: "Partially observed",
    });
    expect(both?.actionNeeded).toBe(false);
    expect(await fixtures.access.actionNeeded(ACCOUNT_ID, PROJECT_ID)).toEqual(
      [],
    );
  });

  test("Could not learn counts as judged", async () => {
    const fixtures = published();
    const round = await startRound(fixtures);
    await observe(fixtures, round.id, "access", {
      assessment: "Could not learn",
    });
    const both = await observe(fixtures, round.id, "outcome", {
      assessment: "Could not learn",
    });
    expect(both?.actionNeeded).toBe(false);
  });

  test("Close assessment closes the signal with a field still empty", async () => {
    const fixtures = published();
    const round = await startRound(fixtures);
    await observe(fixtures, round.id, "access");

    const closed = await fixtures.access.closeAssessment(ACCOUNT_ID, round.id);

    expect(closed).toMatchObject({
      actionNeeded: false,
      closeReason: "Close assessment",
    });
    expect(await fixtures.access.actionNeeded(ACCOUNT_ID, PROJECT_ID)).toEqual(
      [],
    );
    await expect(observe(fixtures, round.id, "outcome")).rejects.toMatchObject({
      code: "RELEASE_COMMUNICATION_ROUND_CLOSED",
    });
  });

  test("evidence belongs to the observation alone and must exist", async () => {
    const fixtures = published();
    const round = await startRound(fixtures);
    const saved = await observe(fixtures, round.id, "access", {
      evidence: [{ sourceId: "source-1", sourceType: "Source" }],
    });
    expect(saved?.access?.evidence).toEqual([
      { sourceId: "source-1", sourceType: "Source" },
    ]);
    expect(saved?.outcome).toBeNull();

    await expect(
      observe(fixtures, round.id, "outcome", {
        evidence: [{ sourceId: "missing", sourceType: "Source" }],
      }),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_EVIDENCE_INVALID" });
  });

  test("a correction keeps author, time and the previous value", async () => {
    const fixtures = published();
    const round = await startRound(fixtures);
    await observe(fixtures, round.id, "access", {
      assessment: "Not observed",
      text: "First read",
    });
    fixtures.tick(1);
    const corrected = await observe(fixtures, round.id, "access", {
      assessment: "Partially observed",
      baseRevision: 1,
      text: "Second read",
    });

    expect(corrected?.access).toMatchObject({
      assessment: "Partially observed",
      authorId: ACCOUNT_ID,
      previous: [{ assessment: "Not observed", text: "First read" }],
      revision: 2,
    });
    await expect(
      observe(fixtures, round.id, "access", { baseRevision: 1 }),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_STALE_REVISION" });
  });
});

describe("Dated rounds", () => {
  test("a conflicting and a consistent round both stay; the newer never overwrites the older", async () => {
    const fixtures = published();
    const first = await startRound(fixtures);
    await observe(fixtures, first.id, "access", { assessment: "Observed" });
    await observe(fixtures, first.id, "outcome", { assessment: "Observed" });
    fixtures.tick(30);
    const second = await startRound(fixtures);
    await observe(fixtures, second.id, "access", { assessment: "Observed" });
    await observe(fixtures, second.id, "outcome", {
      assessment: "Not observed",
    });

    const view = await fixtures.access.reassessment(ACCOUNT_ID, RELEASE_ID);
    const [one, two] = view?.rounds ?? [];

    expect(one?.outcome?.assessment).toBe("Observed");
    expect(two?.outcome?.assessment).toBe("Not observed");
    expect(one?.startedAt).not.toBe(two?.startedAt);
  });
});

describe("Look again", () => {
  test("is only the normal reminder: it starts no round and raises no signal", async () => {
    const fixtures = published();

    expect(
      await fixtures.access.setLookAgain(
        ACCOUNT_ID,
        RELEASE_ID,
        "2026-11-20T09:00:00.000Z",
      ),
    ).toBe(true);

    expect(fixtures.reminders).toEqual([
      { fireAt: "2026-11-20T09:00:00.000Z", releaseId: RELEASE_ID },
    ]);
    const view = await fixtures.access.reassessment(ACCOUNT_ID, RELEASE_ID);
    expect(view?.rounds).toEqual([]);
    expect(await fixtures.access.actionNeeded(ACCOUNT_ID, PROJECT_ID)).toEqual(
      [],
    );
  });

  test("a date picked while starting a round sets the same reminder on the Release", async () => {
    const fixtures = published();
    await fixtures.access.startReassessment(ACCOUNT_ID, {
      lookAgainAt: "2026-11-20T09:00:00.000Z",
      releaseId: RELEASE_ID,
    });
    expect(fixtures.reminders).toHaveLength(1);
  });

  test("a failed reminder date starts no round to retry into", async () => {
    const fixtures = createFixtures({
      release: { status: "Published" },
      scheduleError: "reminder store unavailable",
    });

    await expect(
      fixtures.access.startReassessment(ACCOUNT_ID, {
        lookAgainAt: "2026-11-20T09:00:00.000Z",
        releaseId: RELEASE_ID,
      }),
    ).rejects.toThrow("reminder store unavailable");
    expect(fixtures.reminders).toEqual([]);
    expect(
      (await fixtures.access.reassessment(ACCOUNT_ID, RELEASE_ID))?.rounds,
    ).toEqual([]);
  });

  test("another account cannot set or read it", async () => {
    const fixtures = published();
    expect(
      await fixtures.access.setLookAgain(
        "other",
        RELEASE_ID,
        "2026-11-20T09:00:00.000Z",
      ),
    ).toBe(false);
    expect(await fixtures.access.reassessment("other", RELEASE_ID)).toBeNull();
    expect(fixtures.reminders).toEqual([]);
  });
});

function fakeStore(
  existing: { action: string; id: string; status: string }[] = [],
) {
  const reminders = [...existing];
  const cancelledIds: string[] = [];
  const expectedOnCancel: unknown[] = [];
  const createdKeys: string[] = [];
  return {
    cancelledIds,
    createdKeys,
    expectedOnCancel,
    store: {
      cancel: async (
        _accountId: string,
        reminderId: string,
        expected?: { action?: string; sourceRecordType?: string },
      ) => {
        expectedOnCancel.push(expected);
        cancelledIds.push(reminderId);
        const reminder = reminders.find((row) => row.id === reminderId);
        if (reminder) {
          reminder.status = "Cancelled";
        }
        return reminder ?? null;
      },
      create: async (
        _accountId: string,
        input: { clientIdempotencyKey: string; fireAt: string },
      ) => {
        createdKeys.push(`${input.clientIdempotencyKey}:${input.fireAt}`);
        reminders.push({
          action: "Review Later",
          id: `reminder-${createdKeys.length}`,
          status: "Planned",
        });
        return { id: `reminder-${createdKeys.length}` };
      },
      list: async () => reminders.map((row) => ({ ...row })),
    },
  };
}

test("a re-picked date replaces the unsent reminder instead of accumulating", async () => {
  const first = fakeStore();
  const schedule = createLookAgainSchedule(first.store);
  expect(
    await schedule("account-1", "release-1", "2026-11-20T09:00:00.000Z"),
  ).toBe(true);

  const second = fakeStore([
    { action: "Review Later", id: "reminder-1", status: "Planned" },
  ]);
  const reschedule = createLookAgainSchedule(second.store);
  expect(
    await reschedule("account-1", "release-1", "2026-11-27T09:00:00.000Z"),
  ).toBe(true);
  expect(second.expectedOnCancel).toEqual([
    { action: "Review Later", sourceRecordType: "Project Release" },
  ]);
  expect(second.cancelledIds).toEqual(["reminder-1"]);
  expect(second.createdKeys).toHaveLength(1);
});

test("only the unsent Review Later on the Release is replaced", async () => {
  const fake = fakeStore([
    { action: "Remind me", id: "reminder-m", status: "Planned" },
    { action: "Review Later", id: "reminder-t", status: "Triggered" },
    { action: "Review Later", id: "reminder-c", status: "Cancelled" },
  ]);
  const schedule = createLookAgainSchedule(fake.store);

  expect(
    await schedule("account-1", "release-1", "2026-11-20T09:00:00.000Z"),
  ).toBe(true);
  expect(fake.cancelledIds).toEqual([]);
  expect(fake.createdKeys).toHaveLength(1);
});
