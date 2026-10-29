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

  test("is empty before the sources load", () => {
    expect(trashCandidates({})).toEqual([]);
  });
});
