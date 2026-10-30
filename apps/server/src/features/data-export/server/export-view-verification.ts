import {
  ExportError,
  type ExportSubject,
  exportFamilyOf,
  type exportRequestSchema,
  exportScopeProjectIds,
} from "@cantiara/api/data-export";

/** The stored definition and live membership of a Smart Collection view. */
export interface VerifiedSmartCollection {
  /** Stored conditions that are set (status, type, ...); values as text. */
  conditions: Record<string, string>;
  /** Ids of the records that are members of the view right now. */
  memberIds: readonly string[];
  /** The collection name shown on screen. */
  name: string;
  projectIds: readonly string[];
  /** The record type the collection lists. */
  sourceType: string;
}

/**
 * Resolves a Smart Collection view for the account, read-only, or `null` when
 * it does not exist or is not the account's. The manifest never claims a view
 * the server did not actually read.
 */
export interface ExportViewVerifier {
  smartCollection: (
    accountId: string,
    viewId: string,
  ) => Promise<VerifiedSmartCollection | null>;
}

export interface VerifiedExportView {
  /** Filters handed to the source reader. */
  readerFilters: Record<string, string>;
  /** Records the export is limited to; undefined means every matching record. */
  recordIds?: string[];
}

function unverified(detail: string): ExportError {
  return new ExportError("view_unverified", detail);
}

function sameSet(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((item) => right.includes(item))
  );
}

function sameFilters(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => left[key] === right[key])
  );
}

/**
 * Checks the client-sent view descriptor against what the server can prove:
 * the view kind must match the scope kind, and a Smart Collection must be
 * resolved server-side and match its stored definition (scope, filters, record
 * type, name). Its live membership then limits the records read.
 */
export async function verifyExportView(input: {
  accountId: string;
  parsed: ReturnType<typeof exportRequestSchema.parse>;
  recordType: ExportSubject;
  verifier?: ExportViewVerifier;
}): Promise<VerifiedExportView> {
  const { accountId, parsed, recordType, verifier } = input;
  const { view } = parsed;
  const plain: VerifiedExportView = {
    readerFilters: parsed.filters,
    ...(parsed.recordIds ? { recordIds: parsed.recordIds } : {}),
  };
  if (!view) {
    return plain;
  }
  if (view.kind === "Work list" && parsed.scope.kind !== "project") {
    throw unverified("A Work list covers one Project.");
  }
  if (
    view.kind === "Cross-project list" &&
    parsed.scope.kind !== "cross-project"
  ) {
    throw unverified("A cross-project list covers a selection of Projects.");
  }
  if (view.kind !== "Smart Collection") {
    return plain;
  }

  const definition =
    verifier && view.id
      ? await verifier.smartCollection(accountId, view.id)
      : null;
  if (!definition) {
    throw unverified("The Smart Collection could not be found.");
  }
  if (view.name !== definition.name) {
    throw unverified("The view name does not match the Smart Collection.");
  }
  if (!sameSet(exportScopeProjectIds(parsed.scope), definition.projectIds)) {
    throw unverified("The scope does not match the Smart Collection.");
  }
  const typeMatches =
    definition.sourceType === recordType ||
    (definition.sourceType === "Work" && exportFamilyOf(recordType) === "Work");
  if (!typeMatches) {
    throw unverified("The record type does not match the Smart Collection.");
  }
  if (definition.conditions.type && definition.conditions.type !== recordType) {
    throw unverified("The Work type does not match the Smart Collection.");
  }
  if (!sameFilters(parsed.filters, definition.conditions)) {
    throw unverified("The filters do not match the Smart Collection.");
  }

  // The collection's own membership is what is read; a client selection can
  // only narrow it. `type` is carried by the record type, not a reader filter.
  const { type: _type, ...readerFilters } = parsed.filters;
  const members = new Set(definition.memberIds);
  const requested = parsed.recordIds;
  return {
    readerFilters,
    recordIds: requested
      ? requested.filter((id) => members.has(id))
      : [...definition.memberIds],
  };
}
