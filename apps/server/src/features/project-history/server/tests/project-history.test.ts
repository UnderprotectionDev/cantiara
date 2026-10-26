import type {
  StoryEventFact,
  StoryTimelineFacts,
} from "@cantiara/api/project-history";
import { describe, expect, test } from "vitest";

import {
  createProjectHistory,
  ProjectHistoryProjectNotFoundError,
  ProjectHistoryWorkNotFeatureError,
  ProjectHistoryWorkNotFoundError,
} from "../project-history";
import {
  createMemoryProjectHistory,
  emptyStorySources,
} from "../project-history-memory-store";

const ACCOUNT = "account-1";
const ok = <T>(value: T) => ({ available: true as const, value });

const fact = (
  recordType: StoryEventFact["source"]["recordType"],
  recordId: string,
  title: string,
  occurredAt: string,
  extra: Partial<StoryEventFact> = {},
): StoryEventFact => ({
  abandonmentRationale: null,
  occurredAt,
  source: { label: title, recordId, recordType },
  state: null,
  title,
  ...extra,
});

function sources(
  overrides: Partial<StoryTimelineFacts["sources"]> = {},
): StoryTimelineFacts["sources"] {
  return { ...emptyStorySources(), ...overrides };
}

function setup() {
  const harness = createMemoryProjectHistory({
    accountId: ACCOUNT,
    features: new Map([
      [
        "feature-1",
        sources({
          Work: ok([
            fact("Work", "w2", "Sync engine", "2026-04-02T00:00:00.000Z", {
              state: "Completed",
            }),
          ]),
        }),
      ],
    ]),
    projects: new Map([
      [
        "project-1",
        {
          sources: sources({
            Decision: ok([
              fact("Decision", "d1", "Use SQLite", "2026-04-03T00:00:00.000Z", {
                state: "Valid",
              }),
            ]),
            "Production Incident": ok([
              fact(
                "Production Incident",
                "i1",
                "Outage",
                "2026-04-01T00:00:00.000Z",
              ),
            ]),
            Work: ok([
              fact("Work", "w1", "Offline queue", "2026-04-04T00:00:00.000Z", {
                abandonmentRationale: "Superseded by sync.",
                state: "Abandoned",
              }),
              fact("Work", "w2", "Sync engine", "2026-04-02T00:00:00.000Z", {
                state: "Completed",
              }),
            ]),
            "Code change": {
              available: false,
              reason: "GitHub history has no story read yet.",
            },
          }),
          works: [
            { id: "feature-1", key: "TID-1", title: "Sync", type: "Feature" },
            { id: "w1", key: "TID-2", title: "Queue", type: "Task" },
          ],
        },
      ],
    ]),
  });
  return createProjectHistory(harness.sources);
}

describe("Project History Story Timeline", () => {
  test("lists the Project story chronologically with sources", async () => {
    const timeline = await setup().storyTimeline(ACCOUNT, {
      projectId: "project-1",
      scope: "Project",
    });
    expect(timeline.scope).toEqual({ kind: "Project", projectId: "project-1" });
    expect(timeline.events.map((event) => event.title)).toEqual([
      "Outage",
      "Sync engine",
      "Use SQLite",
      "Offline queue",
    ]);
    expect(
      timeline.events.every((event) => event.source.recordId.length > 0),
    ).toBe(true);
  });

  test("shows the abandonment rationale on the related event", async () => {
    const timeline = await setup().storyTimeline(ACCOUNT, {
      projectId: "project-1",
      scope: "Project",
    });
    const abandoned = timeline.events.find(
      (event) => event.title === "Offline queue",
    );
    expect(abandoned?.state).toBe("Abandoned");
    expect(abandoned?.abandonmentRationale).toBe("Superseded by sync.");
    expect(
      timeline.events
        .filter((event) => event !== abandoned)
        .every((event) => event.abandonmentRationale === null),
    ).toBe(true);
  });

  test("reduces a Feature-type Work to its own story, not the whole Project", async () => {
    const timeline = await setup().storyTimeline(ACCOUNT, {
      projectId: "project-1",
      scope: "Feature",
      workId: "feature-1",
    });
    expect(timeline.scope).toEqual({
      key: "TID-1",
      kind: "Feature",
      projectId: "project-1",
      title: "Sync",
      workId: "feature-1",
    });
    expect(timeline.events.map((event) => event.title)).toEqual([
      "Sync engine",
    ]);
  });

  test("reports a source that cannot be read instead of omitting or inventing it", async () => {
    const timeline = await setup().storyTimeline(ACCOUNT, {
      projectId: "project-1",
      scope: "Project",
    });
    expect(timeline.unavailable).toEqual([
      { kind: "Code change", reason: "GitHub history has no story read yet." },
    ]);
  });

  test("refuses other accounts, missing Work and non-Feature Work", async () => {
    const history = setup();
    await expect(
      history.storyTimeline("other", {
        projectId: "project-1",
        scope: "Project",
      }),
    ).rejects.toBeInstanceOf(ProjectHistoryProjectNotFoundError);
    await expect(
      history.storyTimeline(ACCOUNT, {
        projectId: "project-1",
        scope: "Feature",
        workId: "nope",
      }),
    ).rejects.toBeInstanceOf(ProjectHistoryWorkNotFoundError);
    await expect(
      history.storyTimeline(ACCOUNT, {
        projectId: "project-1",
        scope: "Feature",
        workId: "w1",
      }),
    ).rejects.toBeInstanceOf(ProjectHistoryWorkNotFeatureError);
  });

  test("exposes reading only: no write, signal or narrative member", () => {
    expect(Object.keys(setup())).toEqual(["storyTimeline"]);
  });
});
