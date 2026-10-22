import {
  compareStatements,
  type SchemaChangeDraft,
  type SchemaOperationName,
} from "./schema-change-draft";

/** Down is produced only when the whole set passes the reverse-proof criterion. */
export const SAFE_DOWN_UNAVAILABLE = "Safe Down could not be produced";

export interface SafeDownBlocker {
  /** Criterion item the operation fails. */
  criterion: string;
  operation: SchemaOperationName | "Edited Up SQL";
  path: string;
}

export type SafeDown =
  | { sql: string; status: "Produced" }
  | {
      blockers: SafeDownBlocker[];
      label: typeof SAFE_DOWN_UNAVAILABLE;
      status: "Unavailable";
    };

/**
 * One ineligible operation drops the whole inverse: no partial or best-effort
 * Down exists. An edited Up text also drops it, because the inverse is no
 * longer determined by the two Diagram Versions alone.
 */
export function buildSafeDown(
  draft: Pick<SchemaChangeDraft, "operations">,
  options: { edited: boolean },
): SafeDown {
  const blockers: SafeDownBlocker[] = [];
  for (const operation of draft.operations) {
    if (operation.class !== "Non-destructive") {
      blockers.push({
        criterion:
          operation.downCriterion ??
          `Class ${operation.class} is not Non-destructive.`,
        operation: operation.operation,
        path: operation.path,
      });
    } else if (
      operation.downCriterion ||
      operation.statements.some(({ inverse }) => inverse === null)
    ) {
      blockers.push({
        criterion:
          operation.downCriterion ??
          "The inverse is not fully determined by the two Diagram Versions.",
        operation: operation.operation,
        path: operation.path,
      });
    }
  }
  if (options.edited) {
    blockers.push({
      criterion:
        "The Up text was edited, so its inverse is no longer determined by the two Diagram Versions.",
      operation: "Edited Up SQL",
      path: "upSql",
    });
  }
  if (blockers.length > 0) {
    return { blockers, label: SAFE_DOWN_UNAVAILABLE, status: "Unavailable" };
  }
  const inverses = draft.operations
    .flatMap(({ statements }) => statements)
    .sort(compareStatements)
    .reverse()
    .map(({ inverse }) => inverse);
  return { sql: `${inverses.join("\n")}\n`, status: "Produced" };
}
