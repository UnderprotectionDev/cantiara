import { describe, expect, test } from "vitest";

import { trashCandidates } from "../trash-candidates";

describe("trashCandidates", () => {
  test("lists Risks then Decisions with the revision shown", () => {
    expect(
      trashCandidates({
        decisions: [{ id: "d1", revision: 4, title: "Use Postgres" }],
        risks: [{ id: "r1", revision: 2, title: "Slip" }],
      }),
    ).toEqual([
      { id: "r1", kind: "Risk", label: "Slip", revision: 2 },
      { id: "d1", kind: "Decision", label: "Use Postgres", revision: 4 },
    ]);
  });

  test("lists Configuration Trash definitions by name", () => {
    expect(
      trashCandidates({
        customFields: [{ id: "cf1", name: "Effort band", revision: 2 }],
        workTemplates: [{ id: "wt1", name: "Bug intake", revision: 1 }],
      }),
    ).toEqual([
      { id: "cf1", kind: "Custom Field", label: "Effort band", revision: 2 },
      { id: "wt1", kind: "Work Template", label: "Bug intake", revision: 1 },
    ]);
  });

  test("is empty before the sources load", () => {
    expect(trashCandidates({})).toEqual([]);
  });
});
