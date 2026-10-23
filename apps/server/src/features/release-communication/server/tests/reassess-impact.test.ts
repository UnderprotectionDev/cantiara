import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  createFixtures,
  createScopeWork,
  PROJECT_ID,
  RELEASE_ID,
} from "./release-communication-fixtures";

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
