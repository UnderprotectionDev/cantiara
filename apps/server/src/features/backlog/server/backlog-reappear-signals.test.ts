import { describe, expect, test } from "vitest";
import { dueReappearSignal } from "./backlog-reappear-signals";

const work = {
  archivedAt: null,
  id: "work-1",
  projectId: "project-1",
  reappearDate: "2026-09-26",
  status: "Blocked",
  trashedAt: null,
};

describe("Backlog reappear-date signal", () => {
  test("stays off by default and before the Account date", () => {
    expect(dueReappearSignal(work, false, "2026-09-26")).toBeNull();
    expect(dueReappearSignal(work, true, "2026-09-25")).toBeNull();
  });

  test("produces one source-linked Action needed identity when opted in", () => {
    expect(dueReappearSignal(work, true, "2026-09-26")).toEqual({
      presentation: "Action needed",
      projectId: "project-1",
      reappearDate: "2026-09-26",
      signalId: "reappear-date:work-1:2026-09-26",
      signalType: "reappear-date",
      sourcePath: "/projects/project-1#work-work-1",
      sourceWorkId: "work-1",
    });
  });

  test("excludes archived, trashed, and closed Work", () => {
    for (const change of [
      { archivedAt: new Date() },
      { trashedAt: new Date() },
      { status: "Closed" },
    ]) {
      expect(
        dueReappearSignal({ ...work, ...change }, true, "2026-09-26"),
      ).toBeNull();
    }
  });
});
