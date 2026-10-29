import type { PersonalReminderSignalHistory } from "@cantiara/api/personal-reminders";
import { describe, expect, test } from "vitest";
import { dueLookAgainSignals, lookAgainTarget } from "../look-again";

function signal(
  overrides: Partial<PersonalReminderSignalHistory>,
): PersonalReminderSignalHistory {
  return {
    dismissedAt: null,
    evaluationNote: null,
    occurredAt: "2026-01-02T00:00:00.000Z",
    signalId: "signal-1",
    signalType: "review-later",
    sourcePath: "/projects/p1",
    sourceProjectId: "p1",
    sourceRecordId: "w1",
    sourceRecordType: "Work",
    ...overrides,
  };
}

describe("Look again", () => {
  test("lists only undismissed Review Later signals, newest first", () => {
    const due = dueLookAgainSignals([
      signal({ signalId: "old", occurredAt: "2026-01-01T00:00:00.000Z" }),
      signal({ signalId: "new", occurredAt: "2026-01-03T00:00:00.000Z" }),
      signal({ signalId: "remind", signalType: "personal-reminder" }),
      signal({ signalId: "gone", dismissedAt: "2026-01-04T00:00:00.000Z" }),
    ]);
    expect(due.map((item) => item.signalId)).toEqual(["new", "old"]);
  });

  test("maps each source type to its own record context", () => {
    expect(lookAgainTarget(signal({}))).toEqual({
      kind: "work",
      projectId: "p1",
      workId: "w1",
    });
    expect(
      lookAgainTarget(
        signal({ sourceRecordType: "Document", sourceProjectId: null }),
      ),
    ).toEqual({ kind: "document", documentId: "w1", projectId: null });
    expect(lookAgainTarget(signal({ sourceRecordType: "Risk" }))).toMatchObject(
      { kind: "project-source-record", sourceType: "Risk" },
    );
    expect(lookAgainTarget(signal({ sourceRecordType: "Project" }))).toEqual({
      kind: "project",
      projectId: "p1",
    });
  });

  test("has no target for a Project record without a Project", () => {
    expect(lookAgainTarget(signal({ sourceProjectId: null }))).toBeNull();
  });
});
