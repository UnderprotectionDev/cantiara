import type { DecisionSupersessionGraph } from "./decision-supersession";

type DecisionRecord = DecisionSupersessionGraph["records"][number];
type Relation = DecisionSupersessionGraph["relations"][number];

export interface DecisionChain {
  current: DecisionRecord | null;
  records: DecisionRecord[];
  relations: Relation[];
}

/** Resolve generations from the authorized graph, never from history events. */
export function decisionChain(
  graph: DecisionSupersessionGraph,
  selectedId: string,
): DecisionChain | null {
  const records = new Map(graph.records.map((record) => [record.id, record]));
  const successors = new Map<string, Relation>();
  for (const relation of graph.relations) {
    if (successors.has(relation.predecessorId)) {
      return null;
    }
    successors.set(relation.predecessorId, relation);
  }
  let terminalId = selectedId;
  const visited = new Set<string>();
  let nextRelation = successors.get(terminalId);
  while (nextRelation) {
    if (visited.has(terminalId) || !records.has(terminalId)) {
      return null;
    }
    visited.add(terminalId);
    terminalId = nextRelation.successorId;
    nextRelation = successors.get(terminalId);
  }
  const terminal = records.get(terminalId);
  if (!terminal) {
    return null;
  }
  // Include all predecessors of a converging replacement, once per generation.
  const included = new Set([terminalId]);
  const pending = [terminalId];
  while (pending.length) {
    const id = pending.pop();
    for (const relation of graph.relations) {
      if (
        relation.successorId === id &&
        !included.has(relation.predecessorId)
      ) {
        included.add(relation.predecessorId);
        pending.push(relation.predecessorId);
      }
    }
  }
  const remaining = graph.records
    .filter((record) => included.has(record.id))
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
  if (remaining.length !== included.size) {
    return null;
  }
  const relations = graph.relations.filter((edge) =>
    included.has(edge.predecessorId),
  );
  const ordered = orderedGenerations(remaining, relations);
  return ordered
    ? {
        current: terminal.life === "Valid" ? terminal : null,
        records: ordered,
        relations,
      }
    : null;
}

function orderedGenerations(
  remaining: DecisionRecord[],
  relations: Relation[],
) {
  const ordered: DecisionRecord[] = [];
  const emitted = new Set<string>();
  while (remaining.length) {
    const index = remaining.findIndex((candidate) =>
      relations.every(
        (edge) =>
          edge.successorId !== candidate.id || emitted.has(edge.predecessorId),
      ),
    );
    if (index === -1) {
      return null;
    }
    const [record] = remaining.splice(index, 1);
    if (!record) {
      return null;
    }
    emitted.add(record.id);
    ordered.push(record);
  }
  return ordered;
}

export type DecisionSnapshotItem =
  | { kind: "Decision"; record: DecisionRecord }
  | { kind: "Supersession"; relation: Relation };

/** New snapshot candidates only. An approved revision is never resolved again. */
export function decisionSnapshotPreview(
  graph: DecisionSupersessionGraph,
  selection?: { decisionIds: string[]; relationPredecessorIds?: string[] },
): DecisionSnapshotItem[] {
  const ids =
    selection?.decisionIds ??
    graph.records
      .filter((record) => record.life === "Valid")
      .map((record) => record.id);
  const records = ids.map((id) => {
    const record = graph.records.find((item) => item.id === id);
    if (!record) {
      throw new Error("Decision is unavailable.");
    }
    return record;
  });
  const relations = (selection?.relationPredecessorIds ?? []).map((id) => {
    const relation = graph.relations.find((item) => item.predecessorId === id);
    if (
      !(
        relation &&
        ids.includes(relation.predecessorId) &&
        ids.includes(relation.successorId)
      )
    ) {
      throw new Error(
        "Select both Decisions and their supersession separately.",
      );
    }
    return relation;
  });
  return structuredClone([
    ...records.map((record) => ({ kind: "Decision" as const, record })),
    ...relations.map((relation) => ({
      kind: "Supersession" as const,
      relation,
    })),
  ]);
}
