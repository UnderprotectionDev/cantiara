import { describe, expect, test } from "vitest";

import {
  CONFIGURATION_HOSTS,
  configurationHostId,
  isWorkRecordHash,
  isWorkSurfaceHash,
  navigationSurfaceFromHash,
  workRecordHash,
  workRecordHref,
  workRelationsHash,
} from "./project-shell-navigation";

describe("Project Shell Work navigation", () => {
  test("exposes Record Action as a Project configuration host", () => {
    expect(CONFIGURATION_HOSTS.map((host) => host.label)).toContain(
      "Record Action",
    );
    expect(configurationHostId("Record Action")).toBe(
      "configuration-host-record-action",
    );
  });

  test("keeps Work relation anchors on the Work surface", () => {
    const hash = workRelationsHash("work-1");

    expect(isWorkSurfaceHash(hash)).toBe(true);
    expect(navigationSurfaceFromHash(hash, ["Work"], [], [])).toBe("Work");
  });

  test("keeps the Priority Map on the Work surface", () => {
    expect(isWorkSurfaceHash("priority-map")).toBe(true);
    expect(navigationSurfaceFromHash("priority-map", ["Work"], [], [])).toBe(
      "Work",
    );
  });

  test("builds the Work record link used by copied context", () => {
    expect(workRecordHash("work/2")).toBe("work-work%2F2");
    expect(workRecordHref("project/1", "work/2")).toBe(
      "/projects/project%2F1#work-work%2F2",
    );
  });

  test("keeps source Work record links on the Work surface", () => {
    const hash = workRecordHash("work-1");

    expect(isWorkRecordHash(hash)).toBe(true);
    expect(isWorkRecordHash(workRelationsHash("work-1"))).toBe(false);
    expect(isWorkSurfaceHash(hash)).toBe(true);
    expect(navigationSurfaceFromHash(hash, ["Work"], [], [])).toBe("Work");
  });
});
