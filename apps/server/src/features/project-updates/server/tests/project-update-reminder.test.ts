import { PERSONAL_REMINDER_ACTIONS } from "@cantiara/api/personal-reminders";
import type { CreateProjectUpdateInput } from "@cantiara/api/project-updates";
import { describe, expect, test } from "vitest";

import { createProjectUpdates } from "../project-updates";
import {
  createMemoryProjectUpdates,
  createMemoryReminderScheduler,
} from "../project-updates-memory-store";

const ACCOUNT = "account-1";
const DAY = 86_400_000;
const START = new Date(Date.UTC(2026, 9, 1));

function setup(options: { archived?: boolean } = {}) {
  let clock = START;
  const harness = createMemoryProjectUpdates({
    accountId: ACCOUNT,
    projects: new Map([
      ["project-1", { archived: options.archived, records: new Map() }],
    ]),
  });
  const reminders = createMemoryReminderScheduler();
  const access = createProjectUpdates(harness.store, {
    now: () => clock,
    reminders: reminders.scheduler,
  });
  return {
    ...harness,
    access,
    advance: (days: number) => {
      clock = new Date(clock.valueOf() + days * DAY);
      reminders.fire(clock);
    },
    reminders,
  };
}

const settings = {
  intervalDays: 7,
  projectId: "project-1",
  question: "What changed this week?",
  state: "Enabled" as const,
};

function updateInput(updateId = "u1"): CreateProjectUpdateInput {
  return {
    links: [],
    mark: "On Track",
    narrative: "Steady.",
    projectId: "project-1",
    snapshot: {
      blocks: [],
      lifecycle: "Active",
      purpose: null,
      targetDate: null,
    },
    updateId,
  };
}

describe("Optional Project Update reminder", () => {
  test("is off by default: no required cadence, nothing planned", async () => {
    const { access, reminders } = setup();
    expect(await access.reminder(ACCOUNT, "project-1")).toMatchObject({
      due: false,
      nextDueAt: null,
      state: "Disabled",
    });
    expect(reminders.planned()).toEqual([]);
  });

  test("enabling plans one reminder at the chosen interval", async () => {
    const { access, reminders } = setup();
    const reminder = await access.configureReminder(ACCOUNT, settings);
    expect(reminder).toMatchObject({
      due: false,
      intervalDays: 7,
      nextDueAt: new Date(START.valueOf() + 7 * DAY).toISOString(),
      question: "What changed this week?",
      state: "Enabled",
    });
    expect(reminders.planned()).toHaveLength(1);
  });

  test("a due reminder is a personal-reminder signal that opens the existing form", async () => {
    const { access, advance, reminders } = setup();
    await access.configureReminder(ACCOUNT, settings);
    advance(6);
    expect((await access.reminder(ACCOUNT, "project-1"))?.due).toBe(false);
    advance(1);
    expect((await access.reminder(ACCOUNT, "project-1"))?.due).toBe(true);
    expect(reminders.signals).toEqual([
      {
        dismissed: false,
        projectId: "project-1",
        signalType: "personal-reminder",
        sourcePath: "/projects/project-1#project-updates",
      },
    ]);
  });

  test("skip writes zero updates, acknowledges the nudge and plans the next", async () => {
    const { access, advance, entries, reminders } = setup();
    await access.configureReminder(ACCOUNT, settings);
    advance(7);
    const skipped = await access.skipReminder(ACCOUNT, "project-1");
    expect(skipped).toMatchObject({ due: false, state: "Enabled" });
    expect(entries).toEqual([]);
    expect((await access.overview(ACCOUNT, "project-1"))?.updates).toEqual([]);
    expect(reminders.planned()).toHaveLength(1);
    advance(7);
    expect((await access.reminder(ACCOUNT, "project-1"))?.due).toBe(true);
    expect(entries).toEqual([]);
  });

  test("only an explicit save writes one update and answers the reminder", async () => {
    const { access, advance, entries, reminders } = setup();
    await access.configureReminder(ACCOUNT, settings);
    advance(7);
    await access.create(ACCOUNT, updateInput());
    expect(entries).toHaveLength(1);
    expect(await access.reminder(ACCOUNT, "project-1")).toMatchObject({
      due: false,
    });
    expect(reminders.planned()).toHaveLength(1);
  });

  test("saving with no reminder due leaves the plan alone", async () => {
    const { access, reminders } = setup();
    await access.configureReminder(ACCOUNT, settings);
    const [before] = reminders.planned();
    await access.create(ACCOUNT, updateInput());
    expect(reminders.planned()).toEqual([before]);
  });

  test("pause and disable emit nothing and clear a fired nudge", async () => {
    await Promise.all(
      (["Paused", "Disabled"] as const).map(async (state) => {
        const { access, advance, reminders } = setup();
        await access.configureReminder(ACCOUNT, settings);
        advance(7);
        const reminder = await access.configureReminder(ACCOUNT, {
          ...settings,
          state,
        });
        expect(reminder).toMatchObject({ due: false, nextDueAt: null, state });
        const signalsBefore = reminders.signals.length;
        advance(30);
        expect(reminders.signals).toHaveLength(signalsBefore);
        expect(reminders.planned()).toEqual([]);
        // The question and interval are kept for later.
        expect(reminder).toMatchObject({
          intervalDays: 7,
          question: "What changed this week?",
        });
      }),
    );
  });

  test("question and interval are editable; only a new interval replans", async () => {
    const { access, reminders } = setup();
    await access.configureReminder(ACCOUNT, settings);
    const [first] = reminders.planned();
    const renamed = await access.configureReminder(ACCOUNT, {
      ...settings,
      question: "Anything blocking you?",
    });
    expect(renamed?.question).toBe("Anything blocking you?");
    expect(reminders.planned()).toEqual([first]);
    const slower = await access.configureReminder(ACCOUNT, {
      ...settings,
      intervalDays: 30,
    });
    expect(slower?.nextDueAt).toBe(
      new Date(START.valueOf() + 30 * DAY).toISOString(),
    );
    expect(reminders.planned()).toHaveLength(1);
    expect(reminders.planned()[0]).not.toEqual(first);
  });

  test("rejects a missing question, a zero or huge interval and extra fields", async () => {
    const { access } = setup();
    const results = await Promise.allSettled(
      [
        { question: "   " },
        { intervalDays: 0 },
        { intervalDays: 366 },
        { intervalDays: 1.5 },
        { score: 1 },
      ].map((bad) =>
        access.configureReminder(ACCOUNT, { ...settings, ...bad }),
      ),
    );
    expect(results.every((result) => result.status === "rejected")).toBe(true);
  });

  test("another account or an archived Project plans nothing", async () => {
    const { access, reminders } = setup();
    expect(await access.configureReminder("other", settings)).toBeNull();
    expect(await access.skipReminder("other", "project-1")).toBeNull();
    const archived = setup({ archived: true });
    await expect(
      archived.access.configureReminder(ACCOUNT, settings),
    ).rejects.toMatchObject({ code: "PROJECT_UPDATE_READ_ONLY" });
    expect(reminders.planned()).toEqual([]);
    expect(archived.reminders.planned()).toEqual([]);
  });

  test("adds no new Dikkat sinyali identity: only personal-reminder is produced", async () => {
    const { access, advance, reminders } = setup();
    await access.configureReminder(ACCOUNT, settings);
    advance(7);
    await access.skipReminder(ACCOUNT, "project-1");
    advance(7);
    expect([
      ...new Set(reminders.signals.map((signal) => signal.signalType)),
    ]).toEqual(["personal-reminder"]);
    expect([...PERSONAL_REMINDER_ACTIONS]).toEqual([
      "Remind me",
      "Review Later",
    ]);
  });
});
