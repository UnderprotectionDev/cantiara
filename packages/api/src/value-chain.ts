import { z } from "zod";

/**
 * Value Chain (spec 67): a read-only view derived live from the explicit
 * records and relations of one Project, anchored at one Project Goal. It
 * stores nothing and never infers a missing link. The pure derivation below is
 * the only place that decides which node is reached and why; the database
 * adapter only reports facts (nodes and the explicit edges between them).
 */
export const VALUE_CHAIN_LABEL = "Value Chain";
export const VALUE_CHAIN_NOT_LINKED_LABEL = "Not linked to goal";
export const VALUE_CHAIN_CONTRIBUTES_LABEL = "Contributes to Goal";
export const VALUE_CHAIN_OPEN_SOURCE_LABEL = "Open source record";
export const VALUE_CHAIN_UNAVAILABLE_LABEL = "Unavailable record";
export const VALUE_CHAIN_RELATED_NOTE =
  "A Related link does not count as a contribution to this goal.";
export const valueChainBoundByLabel = (relationType: string) =>
  `Bound by ${relationType}`;
export const VALUE_CHAIN_FILL_GAP_LABEL = "Fill this gap";
export const VALUE_CHAIN_CHOOSE_EXISTING_LABEL = "Choose an existing record";
export const VALUE_CHAIN_START_NEW_LABEL = "Start a new record";
export const VALUE_CHAIN_GAP_NOTE =
  "Nothing is written until you save the relation in the owning feature. No other record changes status.";
export const VALUE_CHAIN_OPEN_FAILED = "The record could not be opened.";
export const VALUE_CHAIN_NOTE =
  "Derived from explicit records and relations. Nothing here is written, scored or inferred.";

const id = z.string().trim().min(1).max(255);

export const VALUE_CHAIN_NODE_TYPES = [
  "Project Goal",
  "Milestone",
  "Work",
  "Problem or opportunity",
  "Evidence",
  "Decision",
  "GitHub",
  "Test",
  "Project Release",
  "Observation",
  "Risk",
  "Assumption",
  "Open Question",
  "Other record",
] as const;
export type ValueChainNodeType = (typeof VALUE_CHAIN_NODE_TYPES)[number];
export const valueChainNodeTypeSchema = z.enum(VALUE_CHAIN_NODE_TYPES);

export const VALUE_CHAIN_UNAVAILABLE_REASONS = [
  "Archived",
  "In Trash",
  "Permanently deleted",
  "Redacted for security",
  "No access",
] as const;
export type ValueChainUnavailableReason =
  (typeof VALUE_CHAIN_UNAVAILABLE_REASONS)[number];

export const valueChainInputSchema = z
  .object({ goalId: id, projectId: id })
  .strict();
export type ValueChainInput = z.infer<typeof valueChainInputSchema>;

/** The exact stored relation that binds a child to its parent. */
export interface ValueChainRelation {
  /** Stored relation id, or null for a bind owned by the record itself. */
  id: string | null;
  /** Catalog label such as `Contributes to Goal` or `Release scope`. */
  label: string;
}

export interface ValueChainFactNode {
  id: string;
  status: string | null;
  /** Null once the record is unavailable: private content never travels. */
  title: string | null;
  type: ValueChainNodeType;
  unavailable: ValueChainUnavailableReason | null;
}

/** `parent` is the end nearer the Goal; the edge is one explicit stored bind. */
export interface ValueChainFactEdge {
  child: ValueChainNodeRef;
  parent: ValueChainNodeRef;
  relation: ValueChainRelation;
}

export interface ValueChainNodeRef {
  id: string;
  type: ValueChainNodeType;
}

export interface ValueChainFacts {
  /**
   * Explicit binds that are not part of the chain: a goal `Related` link, or a
   * Work that shares a Release scope without contributing. They only make
   * records visible under `Not linked to goal`; they never reach the Goal.
   */
  associations: ValueChainFactEdge[];
  /** Explicit binds that carry the chain from the Goal outwards. */
  edges: ValueChainFactEdge[];
  goal: {
    id: string;
    title: string | null;
    unavailable: ValueChainUnavailableReason | null;
  };
  nodes: ValueChainFactNode[];
}

export interface ValueChainNode {
  children: ValueChainNode[];
  id: string;
  relation: ValueChainRelation;
  /** True when this node already appears fully under an earlier branch. */
  repeat: boolean;
  status: string | null;
  title: string | null;
  type: ValueChainNodeType;
  unavailable: ValueChainUnavailableReason | null;
  /** Why the node is shown, naming the parent and the exact relation. */
  why: string;
}

export interface ValueChainNotLinkedNode {
  id: string;
  /** The explicit relation that makes this record related, never a guess. */
  reason: string;
  relation: ValueChainRelation;
  status: string | null;
  title: string | null;
  type: ValueChainNodeType;
  unavailable: ValueChainUnavailableReason | null;
}

export interface ValueChainGap {
  from: ValueChainNodeRef;
  /** What is not present on the explicit relations of `from`. */
  label: string;
  missing: ValueChainNodeType;
}

export interface ValueChain {
  /** Branches below the Goal, one per directly bound record. */
  branches: ValueChainNode[];
  gaps: ValueChainGap[];
  goal: ValueChainFacts["goal"];
  notLinked: ValueChainNotLinkedNode[];
}

const nodeRefKey = (ref: ValueChainNodeRef) => `${ref.type}:${ref.id}`;

/** Child stages every contributing Work may reach; absence is shown, not scored. */
const WORK_STAGES: readonly ValueChainNodeType[] = [
  "Decision",
  "Test",
  "Project Release",
];

interface ChainIndex {
  childrenOf: Map<string, ValueChainFactEdge[]>;
  neighboursOf: Map<string, ValueChainFactEdge[]>;
  nodes: Map<string, ValueChainFactNode>;
  reached: Set<string>;
}

function appendEdge(
  map: Map<string, ValueChainFactEdge[]>,
  ref: ValueChainNodeRef,
  edge: ValueChainFactEdge,
) {
  map.set(nodeRefKey(ref), [...(map.get(nodeRefKey(ref)) ?? []), edge]);
}

function indexFacts(facts: ValueChainFacts, goalRef: ValueChainNodeRef) {
  const index: ChainIndex = {
    childrenOf: new Map(),
    neighboursOf: new Map(),
    nodes: new Map(facts.nodes.map((node) => [nodeRefKey(node), node])),
    reached: new Set([nodeRefKey(goalRef)]),
  };
  for (const edge of facts.edges) {
    appendEdge(index.childrenOf, edge.parent, edge);
  }
  for (const edge of [...facts.edges, ...facts.associations]) {
    appendEdge(index.neighboursOf, edge.parent, edge);
    appendEdge(index.neighboursOf, edge.child, edge);
  }
  return index;
}

function branchNode(
  index: ChainIndex,
  edge: ValueChainFactEdge,
  parent: { title: string | null; type: ValueChainNodeType },
  trail: ReadonlySet<string>,
): ValueChainNode {
  const key = nodeRefKey(edge.child);
  const fact = index.nodes.get(key);
  const repeat = index.reached.has(key);
  index.reached.add(key);
  // A bind whose record no fact describes is a deleted end, never a guess.
  const unavailable = fact ? fact.unavailable : "Permanently deleted";
  const title = fact && !unavailable ? fact.title : null;
  return {
    children: repeat
      ? []
      : buildBranches(index, edge.child, title, new Set([...trail, key])),
    id: edge.child.id,
    relation: edge.relation,
    repeat,
    status: fact && !unavailable ? fact.status : null,
    title,
    type: edge.child.type,
    unavailable,
    why: `Reached from ${parent.type} ${
      parent.title ?? VALUE_CHAIN_UNAVAILABLE_LABEL
    }.`,
  };
}

function buildBranches(
  index: ChainIndex,
  parent: ValueChainNodeRef,
  parentTitle: string | null,
  trail: ReadonlySet<string>,
): ValueChainNode[] {
  return (index.childrenOf.get(nodeRefKey(parent)) ?? [])
    .filter((edge) => !trail.has(nodeRefKey(edge.child)))
    .map((edge) =>
      branchNode(index, edge, { title: parentTitle, type: parent.type }, trail),
    );
}

function deriveGaps(
  index: ChainIndex,
  goalRef: ValueChainNodeRef,
  branchCount: number,
) {
  const gaps: ValueChainGap[] = [];
  if (branchCount === 0) {
    gaps.push({
      from: goalRef,
      label: "No Work, Milestone or Project Release contributes to this goal.",
      missing: "Work",
    });
  }
  for (const key of index.reached) {
    const fact = index.nodes.get(key);
    if (fact?.type !== "Work" || fact.unavailable) {
      continue;
    }
    const present = new Set(
      (index.childrenOf.get(key) ?? []).map((edge) => edge.child.type),
    );
    for (const stage of WORK_STAGES.filter((item) => !present.has(item))) {
      gaps.push({
        from: { id: fact.id, type: "Work" },
        label: `No ${stage} is bound to this Work.`,
        missing: stage,
      });
    }
  }
  return gaps;
}

function deriveNotLinked(index: ChainIndex) {
  const notLinked: ValueChainNotLinkedNode[] = [];
  const listed = new Set<string>();
  for (const key of index.reached) {
    for (const edge of index.neighboursOf.get(key) ?? []) {
      for (const other of [edge.parent, edge.child]) {
        const otherKey = nodeRefKey(other);
        const fact = index.nodes.get(otherKey);
        if (!fact || index.reached.has(otherKey) || listed.has(otherKey)) {
          continue;
        }
        listed.add(otherKey);
        notLinked.push({
          id: fact.id,
          reason: `Related to a record in this chain, but no ${VALUE_CHAIN_CONTRIBUTES_LABEL} path reaches it.`,
          relation: edge.relation,
          status: fact.unavailable ? null : fact.status,
          title: fact.unavailable ? null : fact.title,
          type: fact.type,
          unavailable: fact.unavailable,
        });
      }
    }
  }
  return notLinked;
}

export function deriveValueChain(facts: ValueChainFacts): ValueChain {
  const goalRef: ValueChainNodeRef = {
    id: facts.goal.id,
    type: "Project Goal",
  };
  const index = indexFacts(facts, goalRef);
  const branches = buildBranches(
    index,
    goalRef,
    facts.goal.unavailable ? null : facts.goal.title,
    new Set([nodeRefKey(goalRef)]),
  );
  return {
    branches,
    gaps: deriveGaps(index, goalRef, branches.length),
    goal: facts.goal,
    notLinked: deriveNotLinked(index),
  };
}

/** Read-only: the seam has no write, publish, score or gate command. */
export interface ValueChainAccess {
  /** Null when the Project, or a Goal with no remaining bind, is not found. */
  chain: (
    accountId: string,
    input: ValueChainInput,
  ) => Promise<ValueChain | null>;
}
