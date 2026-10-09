import { expect, test } from "vitest";
import { decisionChain, decisionSnapshotPreview } from "./decision-chain";
import type { DecisionSupersessionGraph } from "./decision-supersession";

const record = (
  id: string,
  life: "Valid" | "Superseded" | "Withdrawn" = "Valid",
) => ({
  id,
  title: id,
  decision: `Choose ${id}`,
  rationale: `Because ${id}`,
  life,
  sourceType: "Decision" as const,
  projectId: "project",
  revision: 1,
  createdAt: "2026-10-09T08:00:00.000Z",
  updatedAt: "2026-10-09T08:00:00.000Z",
});
const relation = (predecessorId: string, successorId: string) => ({
  predecessorId,
  successorId,
  actorId: "founder",
  rationale: "Changed constraints",
  occurredAt: "2026-10-09T09:00:00.000Z",
});
const graph: DecisionSupersessionGraph = {
  records: [
    record("final"),
    record("old", "Superseded"),
    record("middle", "Superseded"),
    record("unrelated"),
    record("parallel", "Superseded"),
  ],
  relations: [
    relation("old", "middle"),
    relation("middle", "final"),
    relation("parallel", "final"),
  ],
  evidence: [],
  revision: 3,
  readOnly: false,
};

test("Decisions resolves all generations in replacement order, independently of creation and history order", () => {
  for (const id of ["old", "middle", "final"]) {
    const chain = decisionChain(graph, id);
    expect(chain?.records.map((item) => item.id)).toEqual([
      "old",
      "middle",
      "parallel",
      "final",
    ]);
    expect(chain?.current?.id).toBe("final");
  }
  expect(
    decisionChain(graph, "unrelated")?.records.map((item) => item.id),
  ).toEqual(["unrelated"]);
});

test("Decisions does not invent a Valid current record for withdrawn, missing, cyclic or forked chains", () => {
  expect(
    decisionChain(
      {
        ...graph,
        records: graph.records.map((item) =>
          item.id === "final" ? { ...item, life: "Withdrawn" } : item,
        ),
      },
      "old",
    )?.current,
  ).toBeNull();
  expect(decisionChain(graph, "missing")).toBeNull();
  expect(
    decisionChain(
      {
        ...graph,
        records: graph.records.filter((item) => item.id !== "final"),
      },
      "old",
    ),
  ).toBeNull();
  expect(
    decisionChain(
      { ...graph, relations: [...graph.relations, relation("final", "old")] },
      "old",
    ),
  ).toBeNull();
  expect(
    decisionChain(
      { ...graph, relations: [...graph.relations, relation("old", "final")] },
      "old",
    ),
  ).toBeNull();
});

test("new Decision snapshot previews default to Valid and require separate explicit closed-world items", () => {
  expect(
    decisionSnapshotPreview(graph).map((item) =>
      item.kind === "Decision" ? item.record.id : "relation",
    ),
  ).toEqual(["final", "unrelated"]);
  const preview = decisionSnapshotPreview(graph, {
    decisionIds: ["middle", "final"],
    relationPredecessorIds: ["middle"],
  });
  expect(preview).toHaveLength(3);
  expect(preview.map((item) => item.kind)).toEqual([
    "Decision",
    "Decision",
    "Supersession",
  ]);
  const before = structuredClone(preview);
  for (const item of graph.records) {
    if (item.id === "final") {
      item.title = "Edited current choice";
    }
  }
  expect(preview).toEqual(before);
  expect(decisionSnapshotPreview(graph, { decisionIds: ["old"] })).toHaveLength(
    1,
  );
  expect(() =>
    decisionSnapshotPreview(graph, { decisionIds: ["missing"] }),
  ).toThrow();
  expect(() =>
    decisionSnapshotPreview(graph, {
      decisionIds: ["old"],
      relationPredecessorIds: ["old"],
    }),
  ).toThrow();
});
