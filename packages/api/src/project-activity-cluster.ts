import type {
  ProjectActivityEntry,
  ProjectActivityRow,
} from "./project-activity";

/**
 * Five-minute presentation cluster of Project Activity (spec 68 #465). Pure and
 * clock-free. A cluster is presentation only: it carries every atomic row it
 * groups, so nothing is dropped, summed or rewritten.
 *
 * Window rule (the chosen reading): a row joins the open cluster when it is at
 * most five minutes after the PRECEDING row of that same cluster (chaining),
 * not five minutes after the cluster's first row.
 */
export const PROJECT_ACTIVITY_CLUSTER_WINDOW_MS = 5 * 60 * 1000;
/** Undo kinds that are ordinary field boundaries; every other kind is structural. */
const CLUSTERABLE_UNDO_KINDS = new Set<string | null>([null, "field"]);

/**
 * Only an ordinary, non-redacted field edit may sit in a cluster. Create,
 * Status change, Archive, Relation and Automation event types, undo entries and
 * structural undo boundaries always stay their own row. (Comments, security
 * events and publications are not Kayıt geçmişi rows and never reach here.)
 */
function isClusterable(row: ProjectActivityRow): boolean {
  return (
    row.eventType === "Field change" &&
    !row.redacted &&
    row.undo.of === null &&
    CLUSTERABLE_UNDO_KINDS.has(row.undo.kind)
  );
}

/** Same actor, same origin (a source delivery is its own origin) and same record. */
function clusterKey(row: ProjectActivityRow): string {
  return JSON.stringify([
    row.actor.kind,
    row.actor.actorId,
    row.origin.kind,
    row.origin.kind === "source" ? row.origin.sourceId : null,
    row.origin.kind === "source" ? row.origin.deliveryId : null,
    row.source.recordType,
    row.source.recordId,
  ]);
}

export function compareProjectActivityRowsNewestFirst(
  left: ProjectActivityRow,
  right: ProjectActivityRow,
) {
  return left.occurredAt === right.occurredAt
    ? right.id.localeCompare(left.id)
    : right.occurredAt.localeCompare(left.occurredAt);
}

/**
 * Stamps every row with its `group`: the id of the oldest row of the cluster it
 * belongs to, or its own id. Run it over the UNFILTERED rows of one scope so a
 * row a filter hides still closes a cluster; filters then narrow the stamped
 * rows without ever merging across that boundary.
 */
export function withProjectActivityGroups(
  rows: readonly ProjectActivityRow[],
): ProjectActivityRow[] {
  const oldestFirst = [...rows].sort((a, b) =>
    compareProjectActivityRowsNewestFirst(b, a),
  );
  const open = new Map<string, ProjectActivityRow[]>();
  const groupOf = new Map<string, string>();
  const recordOf = (row: ProjectActivityRow) =>
    `${row.source.recordType}:${row.source.recordId}`;
  for (const row of oldestFirst) {
    const record = recordOf(row);
    const group = open.get(record);
    const previous = group?.at(-1);
    if (
      group &&
      previous &&
      isClusterable(row) &&
      clusterKey(row) === clusterKey(previous) &&
      Date.parse(row.occurredAt) - Date.parse(previous.occurredAt) <=
        PROJECT_ACTIVITY_CLUSTER_WINDOW_MS
    ) {
      group.push(row);
    } else if (isClusterable(row)) {
      open.set(record, [row]);
    } else {
      open.delete(record);
    }
    const first = open.get(record)?.[0] ?? row;
    groupOf.set(row.id, first.id);
  }
  return rows.map((row) => ({ ...row, group: groupOf.get(row.id) ?? row.id }));
}

function buildCluster(newestFirst: ProjectActivityRow[]): ProjectActivityEntry {
  const [last] = newestFirst;
  const first = newestFirst.at(-1);
  if (!(first && last) || newestFirst.length < 2) {
    throw new Error("A cluster needs at least two rows.");
  }
  return {
    cluster: {
      actor: first.actor,
      fieldNames: [
        ...new Set(
          [...newestFirst]
            .reverse()
            .flatMap((row) => row.changes.map((change) => change.field)),
        ),
      ],
      from: first.occurredAt,
      id: `cluster:${first.group}`,
      origin: first.origin,
      rows: newestFirst,
      source: first.source,
      to: last.occurredAt,
    },
    kind: "cluster",
  };
}

/**
 * Presentation entries, newest first, of rows already stamped by
 * `withProjectActivityGroups`: rows sharing a `group` form one cluster (only
 * the rows present, so a filter or a page edge may leave a single row).
 */
export function projectActivityEntriesOfRows(
  rows: readonly ProjectActivityRow[],
): ProjectActivityEntry[] {
  const groups = new Map<string, ProjectActivityRow[]>();
  for (const row of [...rows].sort(compareProjectActivityRowsNewestFirst)) {
    const members = groups.get(row.group);
    if (members) {
      members.push(row);
    } else {
      groups.set(row.group, [row]);
    }
  }
  return [...groups.values()]
    .map((members): ProjectActivityEntry => {
      const [only] = members;
      return members.length > 1 || !only
        ? buildCluster(members)
        : { kind: "row", row: only };
    })
    .sort((a, b) =>
      compareProjectActivityRowsNewestFirst(entryHead(a), entryHead(b)),
    );
}

function entryHead(entry: ProjectActivityEntry): ProjectActivityRow {
  if (entry.kind === "row") {
    return entry.row;
  }
  const [head] = entry.cluster.rows;
  if (!head) {
    throw new Error("A cluster needs at least two rows.");
  }
  return head;
}

/** Groups atomic rows into presentation entries, newest first. */
export function clusterProjectActivityRows(
  rows: readonly ProjectActivityRow[],
): ProjectActivityEntry[] {
  return projectActivityEntriesOfRows(withProjectActivityGroups(rows));
}
