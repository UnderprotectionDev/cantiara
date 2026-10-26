import { describe, expect, it } from "vitest";
import {
  deriveValueChain,
  type ValueChainFactEdge,
  type ValueChainFactNode,
  type ValueChainFacts,
} from "./value-chain";

const goal = { id: "g1", title: "Ship v1", unavailable: null } as const;
const node = (
  type: ValueChainFactNode["type"],
  id: string,
  title: string | null = id,
  unavailable: ValueChainFactNode["unavailable"] = null,
): ValueChainFactNode => ({
  id,
  status: unavailable ? null : "Open",
  title: unavailable ? null : title,
  type,
  unavailable,
});
const edge = (
  parent: ValueChainFactEdge["parent"],
  child: ValueChainFactEdge["child"],
  label = "Contributes to Goal",
): ValueChainFactEdge => ({
  child,
  parent,
  relation: { id: `${parent.id}>${child.id}`, label },
});
const G = { id: "g1", type: "Project Goal" } as const;
const w = (id: string) => ({ id, type: "Work" }) as const;

function facts(partial: Partial<ValueChainFacts>): ValueChainFacts {
  return { associations: [], edges: [], goal, nodes: [], ...partial };
}

describe("Value Chain derivation", () => {
  it("walks several branches from the goal and explains every node", () => {
    const chain = deriveValueChain(
      facts({
        edges: [
          edge(G, w("w1")),
          edge(G, { id: "r1", type: "Project Release" }),
          edge(w("w1"), { id: "d1", type: "Decision" }, "Related"),
        ],
        nodes: [
          node("Work", "w1"),
          node("Project Release", "r1"),
          node("Decision", "d1"),
        ],
      }),
    );
    expect(chain.branches.map((branch) => branch.id)).toEqual(["w1", "r1"]);
    expect(chain.branches[0]?.children[0]?.why).toBe("Shown because: Related");
    expect(chain.branches[0]?.children[0]?.relation).toEqual({
      id: "w1>d1",
      label: "Related",
    });
    expect(chain.branches[0]?.relation.label).toBe("Contributes to Goal");
  });

  it("shows a record bound only by association under Not linked to goal", () => {
    const chain = deriveValueChain(
      facts({
        associations: [
          edge(G, { id: "d2", type: "Decision" }, "Related"),
          edge(w("w2"), { id: "r1", type: "Project Release" }, "Release scope"),
        ],
        edges: [edge(G, { id: "r1", type: "Project Release" })],
        nodes: [
          node("Decision", "d2"),
          node("Work", "w2"),
          node("Project Release", "r1"),
        ],
      }),
    );
    expect(chain.branches.map((branch) => branch.id)).toEqual(["r1"]);
    expect(chain.notLinked.map((item) => item.id).sort()).toEqual(["d2", "w2"]);
  });

  it("keeps the context of an unlinked Work visible under Not linked to goal", () => {
    const chain = deriveValueChain(
      facts({
        associations: [
          edge(w("w2"), { id: "r1", type: "Project Release" }, "Release scope"),
        ],
        edges: [
          edge(G, w("w1")),
          edge(G, { id: "r1", type: "Project Release" }),
          edge(w("w2"), { id: "t1", type: "Test" }, "Planned Test Case target"),
        ],
        nodes: [
          node("Work", "w1"),
          node("Work", "w2"),
          node("Test", "t1"),
          node("Project Release", "r1"),
        ],
      }),
    );
    expect(chain.notLinked.map((item) => item.id).sort()).toEqual(["t1", "w2"]);
    const attached = chain.notLinked.find((item) => item.id === "t1");
    expect(attached?.reason).toBe(
      "Attached to w2, which itself has no Contributes to Goal path from this goal.",
    );
    // The second hop never reaches further: a bound context piece is listed,
    // its own neighbours are not traversed, and gaps stay on the chain.
    expect(chain.gaps.map((gap) => gap.from.id)).toEqual(["w1", "w1", "w1"]);
  });

  it("keeps an unavailable end visible without its content", () => {
    const chain = deriveValueChain(
      facts({
        edges: [edge(G, w("w1"))],
        nodes: [node("Work", "w1", "Secret plan", "Redacted for security")],
      }),
    );
    expect(JSON.stringify(chain)).not.toContain("Secret plan");
    expect(chain.branches[0]).toMatchObject({
      title: null,
      unavailable: "Redacted for security",
    });
  });

  it("treats a bind to a record with no fact as permanently deleted", () => {
    const chain = deriveValueChain(
      facts({ edges: [edge(G, w("gone"))], nodes: [] }),
    );
    expect(chain.branches[0]?.unavailable).toBe("Permanently deleted");
  });

  it("names missing steps as gaps and never completes them", () => {
    const chain = deriveValueChain(
      facts({ edges: [edge(G, w("w1"))], nodes: [node("Work", "w1")] }),
    );
    expect(chain.gaps.map((gap) => gap.missing)).toEqual([
      "Decision",
      "Test",
      "Project Release",
    ]);
    expect(chain.branches[0]?.children).toEqual([]);
  });

  it("reports an empty goal as a gap", () => {
    const chain = deriveValueChain(facts({}));
    expect(chain.branches).toEqual([]);
    expect(chain.gaps[0]?.from).toEqual(G);
  });

  it("lists a shared node once and terminates on cycles", () => {
    const chain = deriveValueChain(
      facts({
        edges: [
          edge(G, w("w1")),
          edge(G, w("w2")),
          edge(w("w1"), { id: "r1", type: "Project Release" }, "Release scope"),
          edge(w("w2"), { id: "r1", type: "Project Release" }, "Release scope"),
          edge(w("r1"), w("w1"), "Loop"),
        ],
        nodes: [
          node("Work", "w1"),
          node("Work", "w2"),
          node("Project Release", "r1"),
        ],
      }),
    );
    const repeats = JSON.stringify(chain.branches).match(/"repeat":true/g);
    expect(repeats?.length).toBe(1);
  });

  it("exposes no health, score or gate field", () => {
    const chain = deriveValueChain(facts({}));
    expect(Object.keys(chain).sort()).toEqual([
      "branches",
      "gaps",
      "goal",
      "notLinked",
    ]);
  });
});

const WRITE_OR_VERDICT_NAME = /create|update|save|health|score|gate|publish/i;

describe("Value Chain seam surface", () => {
  it("exports no goal write, health or gate helper", async () => {
    const exported = Object.keys(await import("./value-chain"));
    expect(exported.filter((name) => WRITE_OR_VERDICT_NAME.test(name))).toEqual(
      [],
    );
  });
});
