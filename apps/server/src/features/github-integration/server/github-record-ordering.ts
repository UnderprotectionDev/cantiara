import type {
  GitHubIssueSnapshot,
  GitHubRecordWriteResult,
  GitHubStoredRecord,
  GitHubWriteOptions,
} from "@cantiara/api/github-integration";

/**
 * The one ordering rule for GitHub dış kaydı writes (PRD 12), shared by the
 * PostgreSQL store and the in-memory harness so they cannot drift:
 *
 * - events apply by GitHub id and source `updated_at`, never by arrival order;
 * - an older snapshot never rewinds a newer state;
 * - at the same `updated_at` the reconcile snapshot wins over a webhook one,
 *   and a differing result is a conflict that the link history records;
 * - a permanently deleted source (tombstone) is never recreated;
 * - a record in Trash takes no write, and a restored one waits for an explicit
 *   reconcile instead of silently applying what it missed.
 */
export type RecordWriteDecision =
  | { action: "insert"; conflict: false; result: "applied" }
  | {
      action: "update";
      conflict: boolean;
      result: "applied";
    }
  | {
      action: "skip";
      conflict: false;
      result: Exclude<GitHubRecordWriteResult, "applied">;
    };

function sameContent(
  record: GitHubStoredRecord,
  snapshot: GitHubIssueSnapshot,
) {
  return (
    record.title === snapshot.title &&
    record.sourceState === snapshot.sourceState &&
    record.milestone === snapshot.milestone &&
    record.htmlUrl === snapshot.htmlUrl &&
    record.labels.join("\u0000") === snapshot.labels.join("\u0000")
  );
}

export function decideRecordWrite(input: {
  existing: GitHubStoredRecord | null;
  options: GitHubWriteOptions;
  snapshot: GitHubIssueSnapshot;
  tombstoned: boolean;
}): RecordWriteDecision {
  const { existing, options, snapshot, tombstoned } = input;
  if (!existing) {
    return tombstoned
      ? { action: "skip", conflict: false, result: "tombstoned" }
      : { action: "insert", conflict: false, result: "applied" };
  }
  if (existing.lifecycle === "Trash") {
    return { action: "skip", conflict: false, result: "trashed" };
  }
  if (existing.needsReconcile && !options.explicit) {
    return { action: "skip", conflict: false, result: "awaiting-reconcile" };
  }
  if (snapshot.sourceUpdatedAt < existing.sourceUpdatedAt) {
    return { action: "skip", conflict: false, result: "stale" };
  }
  if (snapshot.sourceUpdatedAt === existing.sourceUpdatedAt) {
    if (options.origin === "webhook" && existing.appliedFrom === "reconcile") {
      return { action: "skip", conflict: false, result: "stale" };
    }
    return {
      action: "update",
      conflict:
        options.origin === "reconcile" &&
        existing.appliedFrom === "webhook" &&
        !sameContent(existing, snapshot),
      result: "applied",
    };
  }
  return { action: "update", conflict: false, result: "applied" };
}
