import { describe, expect, test } from "vitest";

import {
  deriveStoryTimeline,
  PROJECT_HISTORY_LABEL,
  PROJECT_HISTORY_OPEN_SOURCE_LABEL,
  STORY_EVENT_KINDS,
  STORY_TIMELINE_LABEL,
  type StoryTimelineFacts,
  storyTimelineInputSchema,
  storyTimelineSchema,
} from "./project-history";

const SIGNAL_OR_NARRATIVE =
  /signal|notification|summary|release note|feed|success|score/i;

const ok = <T>(value: T) => ({ available: true as const, value });

function facts(): StoryTimelineFacts {
  return {
    scope: { kind: "Project", projectId: "p1" },
    sources: {
      "Code change": { available: false, reason: "GitHub history not read." },
      Decision: ok([
        {
          abandonmentRationale: null,
          occurredAt: "2026-03-02T10:00:00.000Z",
          source: {
            label: "Use SQLite",
            recordId: "d1",
            recordType: "Decision",
          },
          state: "Valid",
          title: "Use SQLite",
        },
      ]),
      Design: ok([]),
      Document: ok([]),
      "Lifecycle change": ok([]),
      Milestone: ok([
        {
          abandonmentRationale: null,
          occurredAt: "2026-03-01T10:00:00.000Z",
          source: { label: "Alpha", recordId: "m1", recordType: "Milestone" },
          state: "Reached",
          title: "Alpha",
        },
      ]),
      "Production Incident": ok([]),
      "Project Release": ok([]),
      "Validation result": ok([]),
      Work: ok([
        {
          abandonmentRationale: "Superseded by the sync rewrite.",
          occurredAt: "2026-03-03T10:00:00.000Z",
          source: { label: "TID-4", recordId: "w4", recordType: "Work" },
          state: "Abandoned",
          title: "Offline queue",
        },
      ]),
    },
  };
}

describe("Story Timeline contract", () => {
  test("uses the owning English labels", () => {
    expect(PROJECT_HISTORY_LABEL).toBe("Project History");
    expect(STORY_TIMELINE_LABEL).toBe("Story Timeline");
    expect(PROJECT_HISTORY_OPEN_SOURCE_LABEL).toBe("Open source record");
  });

  test("lists realized events chronologically with kind and source", () => {
    const timeline = deriveStoryTimeline(facts());
    expect(timeline.events.map((event) => event.title)).toEqual([
      "Alpha",
      "Use SQLite",
      "Offline queue",
    ]);
    expect(timeline.events.map((event) => event.kind)).toEqual([
      "Milestone",
      "Decision",
      "Work",
    ]);
    for (const event of timeline.events) {
      expect(event.source.recordId).toBeTruthy();
    }
    expect(storyTimelineSchema.parse(timeline)).toEqual(timeline);
  });

  test("shows the abandonment rationale on the related event only", () => {
    const [milestone, , work] = deriveStoryTimeline(facts()).events;
    expect(work?.abandonmentRationale).toBe("Superseded by the sync rewrite.");
    expect(milestone?.abandonmentRationale).toBeNull();
  });

  test("names an unreadable owner source instead of omitting or inventing it", () => {
    const timeline = deriveStoryTimeline(facts());
    expect(timeline.unavailable).toEqual([
      { kind: "Code change", reason: "GitHub history not read." },
    ]);
    expect(timeline.events.some((event) => event.kind === "Code change")).toBe(
      false,
    );
  });

  test("the event kinds are the closed story set; field edits are not one", () => {
    expect([...STORY_EVENT_KINDS]).toEqual([
      "Decision",
      "Document",
      "Design",
      "Work",
      "Milestone",
      "Lifecycle change",
      "Code change",
      "Production Incident",
      "Validation result",
      "Project Release",
    ]);
    const timeline = deriveStoryTimeline(facts());
    const forged = {
      ...timeline,
      events: [{ ...timeline.events[0], kind: "Field change" }],
    };
    expect(storyTimelineSchema.safeParse(forged).success).toBe(false);
  });

  test("the timeline carries no signal, summary, release note or narrative", () => {
    const timeline = deriveStoryTimeline(facts());
    expect(Object.keys(timeline).sort()).toEqual([
      "events",
      "scope",
      "unavailable",
    ]);
    expect(Object.keys(timeline.events[0] ?? {}).join(" ")).not.toMatch(
      SIGNAL_OR_NARRATIVE,
    );
    expect(
      storyTimelineSchema.safeParse({ ...timeline, signal: { id: "s" } })
        .success,
    ).toBe(false);
  });

  test("inputs are strict Project scope or Feature-type Work scope", () => {
    expect(
      storyTimelineInputSchema.parse({ projectId: "p1", scope: "Project" }),
    ).toEqual({ projectId: "p1", scope: "Project" });
    expect(
      storyTimelineInputSchema.parse({
        projectId: "p1",
        scope: "Feature",
        workId: "w1",
      }),
    ).toEqual({ projectId: "p1", scope: "Feature", workId: "w1" });
    for (const bad of [
      { projectId: "p1", scope: "Project", workId: "w1" },
      { projectId: "p1", scope: "Feature" },
      { projectId: "p1", scope: "Project", status: "Closed" },
      { projectId: "", scope: "Project" },
    ]) {
      expect(storyTimelineInputSchema.safeParse(bad).success).toBe(false);
    }
  });
});
