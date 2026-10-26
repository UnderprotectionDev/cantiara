import { z } from "zod";

import {
  type MutationActor,
  type MutationOrigin,
  type MutationPayload,
  type MutationUndoKind,
  mutationActorTypeSchema,
} from "./mutation-and-undo";

/**
 * Project Activity seam (spec 68, Proje Etkinliği).
 *
 * `Project Activity` is a PROJECTION of the existing Kayıt geçmişi (the
 * `mutation_history` of the Mutation Contract) of the Project's current
 * records. It adds no persistent event type, no second Denetim kaydı store and
 * no automation run log. A row never mints a Dikkat sinyali or a `Story
 * Timeline` event, the view is not the default Project landing surface and not
 * a Birleşik Bildirim Merkezi section, and it is neither GitHub Activity nor an
 * e-mail digest. The owners keep writing their own history; this module only
 * reads it, attributes it to a Project record and presents one atomic row per
 * history entry (grouping into presentation clusters is a later, separate
 * step and needs every field kept here: actor, time, origin, undo boundary,
 * previous–next and source reference).
 *
 * Secrets are never shown as previous–next. A redacted value carries a
 * contentless mark (Güvenlik redaksiyonu), never reconstructed text.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const PROJECT_HISTORY_LABEL = "Project History" as const;
export const PROJECT_ACTIVITY_LABEL = "Project Activity" as const;
export const PROJECT_ACTIVITY_QUESTION_LABEL = "What changed?" as const;
export const PROJECT_ACTIVITY_OPEN_SOURCE_LABEL = "Open source record" as const;

/** Source record or system types the feed can be filtered by. */
export const PROJECT_ACTIVITY_SOURCE_TYPES = [
  "Work",
  "Document",
  "Decision",
  "Risk",
  "Automation",
  "GitHub",
] as const;
export type ProjectActivitySourceType =
  (typeof PROJECT_ACTIVITY_SOURCE_TYPES)[number];
export const projectActivitySourceTypeSchema = z.enum(
  PROJECT_ACTIVITY_SOURCE_TYPES,
);

/** Event types the feed can be filtered by. */
export const PROJECT_ACTIVITY_EVENT_TYPES = [
  "Create",
  "Field change",
  "Status change",
  "Archive",
  "Relation",
  "Automation",
] as const;
export type ProjectActivityEventType =
  (typeof PROJECT_ACTIVITY_EVENT_TYPES)[number];
export const projectActivityEventTypeSchema = z.enum(
  PROJECT_ACTIVITY_EVENT_TYPES,
);

/** Owner record kinds whose history is attributed to a Project record. */
export const PROJECT_ACTIVITY_RECORD_TYPES = [
  "Work",
  "Document",
  "Decision",
  "Risk",
] as const;
export type ProjectActivityRecordType =
  (typeof PROJECT_ACTIVITY_RECORD_TYPES)[number];

export const PROJECT_ACTIVITY_PAGE_SIZE = 50;
export const PROJECT_ACTIVITY_MAX_PAGE_SIZE = 100;

const cursorSchema = z
  .string()
  .max(300)
  .regex(/^[^|]+\|.+$/, "Cursor is not valid.");

/** Strict: no status, score, signal or domain-write field is accepted. */
export const projectActivityInputSchema = z
  .object({
    cursor: cursorSchema.optional(),
    eventTypes: z.array(projectActivityEventTypeSchema).max(6).default([]),
    limit: z
      .number()
      .int()
      .min(1)
      .max(PROJECT_ACTIVITY_MAX_PAGE_SIZE)
      .default(PROJECT_ACTIVITY_PAGE_SIZE),
    projectId: identifierSchema,
    sourceTypes: z.array(projectActivitySourceTypeSchema).max(6).default([]),
  })
  .strict();
export type ProjectActivityInput = z.input<typeof projectActivityInputSchema>;
export type ParsedProjectActivityInput = z.output<
  typeof projectActivityInputSchema
>;

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export const projectActivityActorSchema = z
  .object({
    actorId: z.string(),
    authorizingUserId: z.string().nullable(),
    kind: mutationActorTypeSchema,
  })
  .strict();

export const projectActivitySourceRefSchema = z
  .object({
    label: z.string(),
    recordId: z.string(),
    recordType: z.enum(PROJECT_ACTIVITY_RECORD_TYPES),
  })
  .strict();
export type ProjectActivitySourceRef = z.infer<
  typeof projectActivitySourceRefSchema
>;

export const projectActivityValuesSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("shown"),
      next: z.string().nullable(),
      nextTruncated: z.boolean(),
      previous: z.string().nullable(),
      previousTruncated: z.boolean(),
    })
    .strict(),
  /** A secret or a redacted value: the field is named, the content is never sent. */
  z.object({ kind: z.literal("redacted") }).strict(),
  /** A structured value without a supported previous–next presentation. */
  z.object({ kind: z.literal("unsupported") }).strict(),
]);
export type ProjectActivityValues = z.infer<typeof projectActivityValuesSchema>;

export const projectActivityChangeSchema = z
  .object({
    field: z.string(),
    values: projectActivityValuesSchema,
  })
  .strict();
export type ProjectActivityChange = z.infer<typeof projectActivityChangeSchema>;

export const projectActivityOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("human") }).strict(),
  z
    .object({
      deliveryId: z.string(),
      kind: z.literal("source"),
      sourceId: z.string(),
    })
    .strict(),
]);

export const projectActivityRowSchema = z
  .object({
    actor: projectActivityActorSchema,
    changes: z.array(projectActivityChangeSchema),
    eventType: projectActivityEventTypeSchema,
    id: z.string(),
    occurredAt: z.string(),
    origin: projectActivityOriginSchema,
    /** True when the entry carries a redaction mark; no content follows it. */
    redacted: z.boolean(),
    revision: z.number().int(),
    source: projectActivitySourceRefSchema,
    /** The Güvenli geri alma boundary of this single entry; never merged. */
    undo: z
      .object({
        kind: z.string().nullable(),
        of: z.string().nullable(),
        undoable: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type ProjectActivityRow = z.infer<typeof projectActivityRowSchema>;

export const projectActivitySourceStatusSchema = z
  .object({
    reason: z.string().nullable(),
    sourceType: projectActivitySourceTypeSchema,
    status: z.enum(["available", "partial", "unavailable"]),
  })
  .strict();
export type ProjectActivitySourceStatus = z.infer<
  typeof projectActivitySourceStatusSchema
>;

export const projectActivitySchema = z
  .object({
    nextCursor: z.string().nullable(),
    projectId: z.string(),
    rows: z.array(projectActivityRowSchema),
    /** Why a source is partial or unavailable; never silently empty. */
    sources: z.array(projectActivitySourceStatusSchema),
    /** History of owners that cannot be attributed to a Project record type. */
    unattributed: z.array(z.string()),
    /** True when a source window was reached and older entries are not read. */
    windowReached: z.boolean(),
  })
  .strict();
export type ProjectActivity = z.infer<typeof projectActivitySchema>;

// ---------------------------------------------------------------------------
// Facts (what the read ports hand to the projection)
// ---------------------------------------------------------------------------

/** A history entry already attributed to a Project record by its owner table. */
export interface ProjectActivityHistoryFact {
  actor: MutationActor;
  id: string;
  nextValue: MutationPayload;
  occurredAt: string;
  origin: MutationOrigin;
  previousValue: MutationPayload;
  /** `relation`: the entry is a relation change of the source Work. */
  relation: boolean;
  revision: number;
  source: ProjectActivitySourceRef;
  undo?: { kind: MutationUndoKind } | undefined;
  undoOf?: string | undefined;
}

export interface ProjectActivityFacts {
  history: ProjectActivityHistoryFact[];
  /** Owner history that cannot be attributed to a Project record type. */
  unattributed: string[];
  windowReached: boolean;
}

// ---------------------------------------------------------------------------
// Pure projection
// ---------------------------------------------------------------------------

const MAX_VALUE_LENGTH = 300;
const IGNORED_FIELDS = new Set([
  "createdAt",
  "id",
  "key",
  "number",
  "revision",
  "statusChangedAt",
  "updatedAt",
]);
const SECRET_FIELD =
  /secret|token|password|passphrase|credential|api[-_]?key|private[-_]?key|authorization/i;
const STATUS_FIELDS = new Set(["status", "life"]);
const ARCHIVE_FIELDS = new Set(["archivedAt", "trashedAt", "deletedAt"]);
const ARCHIVE_STATUS_VALUES = new Set(["Archived", "Trash"]);
const RECORD_KEYS: Record<ProjectActivityRecordType, string> = {
  Decision: "decision",
  Document: "document",
  Risk: "risk",
  Work: "work",
};

type Json = MutationPayload;
interface JsonObject {
  [key: string]: Json;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A redaction mark is contentless: `redacted: true` and, at most, the
 * non-content `at`, `field` and `reason` keys. Anything else is not a mark.
 */
export function isProjectActivityRedactionMark(value: unknown): boolean {
  if (!isObject(value) || value.redacted !== true) {
    return false;
  }
  return Object.keys(value).every((key) =>
    ["at", "field", "reason", "redacted"].includes(key),
  );
}

/** A mark anywhere in the value, its record or one of the record's fields. */
function hasRedactionMark(value: unknown): boolean {
  if (isProjectActivityRedactionMark(value)) {
    return true;
  }
  return (
    isObject(value) &&
    Object.values(value).some((entry) => isProjectActivityRedactionMark(entry))
  );
}

function unwrapRecord(
  value: Json,
  recordType: ProjectActivityRecordType,
): JsonObject | null | "missing" {
  if (!isObject(value)) {
    return "missing";
  }
  const record = value[RECORD_KEYS[recordType]];
  if (record === null) {
    return null;
  }
  return isObject(record) ? record : "missing";
}

function isScalar(
  value: Json | undefined,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function present(value: Json | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

function clip(value: string | null): {
  text: string | null;
  truncated: boolean;
} {
  if (value !== null && value.length > MAX_VALUE_LENGTH) {
    return { text: value.slice(0, MAX_VALUE_LENGTH), truncated: true };
  }
  return { text: value, truncated: false };
}

function changeFor(
  field: string,
  previous: Json | undefined,
  next: Json | undefined,
): ProjectActivityChange {
  if (SECRET_FIELD.test(field)) {
    return { field, values: { kind: "redacted" } };
  }
  if (
    isProjectActivityRedactionMark(previous) ||
    isProjectActivityRedactionMark(next)
  ) {
    return { field, values: { kind: "redacted" } };
  }
  if (
    (previous !== undefined && !isScalar(previous)) ||
    (next !== undefined && !isScalar(next))
  ) {
    return { field, values: { kind: "unsupported" } };
  }
  const before = clip(present(previous));
  const after = clip(present(next));
  return {
    field,
    values: {
      kind: "shown",
      next: after.text,
      nextTruncated: after.truncated,
      previous: before.text,
      previousTruncated: before.truncated,
    },
  };
}

function sameJson(left: Json | undefined, right: Json | undefined): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function diffFields(
  previous: JsonObject | null,
  next: JsonObject | null,
): ProjectActivityChange[] {
  const before = previous ?? {};
  const after = next ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => !IGNORED_FIELDS.has(field))
    .sort();
  return fields
    .filter((field) => !sameJson(before[field], after[field]))
    .map((field) => changeFor(field, before[field], after[field]));
}

function classify(
  fact: ProjectActivityHistoryFact,
  previous: JsonObject | null | "missing",
  next: JsonObject | null | "missing",
  changes: ProjectActivityChange[],
): ProjectActivityEventType {
  if (fact.actor.type === "System automation") {
    return "Automation";
  }
  if (fact.relation) {
    return "Relation";
  }
  if (previous === null && next !== null && next !== "missing") {
    return "Create";
  }
  const fieldNames = changes.map((change) => change.field);
  if (previous !== "missing" && next !== "missing") {
    const before = previous ?? {};
    const after = next ?? {};
    const archived = fieldNames.some(
      (field) =>
        ARCHIVE_FIELDS.has(field) ||
        (STATUS_FIELDS.has(field) &&
          (ARCHIVE_STATUS_VALUES.has(String(before[field])) ||
            ARCHIVE_STATUS_VALUES.has(String(after[field])))),
    );
    if (archived) {
      return "Archive";
    }
  }
  if (fieldNames.some((field) => STATUS_FIELDS.has(field))) {
    return "Status change";
  }
  return "Field change";
}

function toRow(fact: ProjectActivityHistoryFact): ProjectActivityRow {
  const previous = unwrapRecord(fact.previousValue, fact.source.recordType);
  const next = unwrapRecord(fact.nextValue, fact.source.recordType);
  const redacted = [fact.previousValue, fact.nextValue, previous, next].some(
    hasRedactionMark,
  );
  const changes =
    previous === "missing" || next === "missing" || redacted
      ? []
      : diffFields(previous, next);
  return {
    actor: {
      actorId: fact.actor.actorId,
      authorizingUserId:
        fact.actor.type === "Authorized integration"
          ? fact.actor.authorizingUserId
          : null,
      kind: fact.actor.type,
    },
    changes,
    eventType: classify(fact, previous, next, changes),
    id: fact.id,
    occurredAt: fact.occurredAt,
    origin:
      fact.origin.kind === "human"
        ? { kind: "human" }
        : {
            deliveryId: fact.origin.deliveryId,
            kind: "source",
            sourceId: fact.origin.sourceId,
          },
    redacted,
    revision: fact.revision,
    source: fact.source,
    undo: {
      kind: fact.undo?.kind ?? null,
      of: fact.undoOf ?? null,
      undoable: fact.undo !== undefined,
    },
  };
}

function matchesSource(
  row: ProjectActivityRow,
  sourceTypes: readonly ProjectActivitySourceType[],
): boolean {
  if (sourceTypes.length === 0) {
    return true;
  }
  return (
    sourceTypes.includes(row.source.recordType) ||
    (sourceTypes.includes("Automation") &&
      row.actor.kind === "System automation") ||
    (sourceTypes.includes("GitHub") && row.actor.kind === "GitHub")
  );
}

function cursorOf(row: ProjectActivityRow) {
  return `${row.occurredAt}|${row.id}`;
}

function afterCursor(row: ProjectActivityRow, cursor: string | undefined) {
  if (!cursor) {
    return true;
  }
  const at = cursor.indexOf("|");
  const time = cursor.slice(0, at);
  const id = cursor.slice(at + 1);
  return row.occurredAt < time || (row.occurredAt === time && row.id < id);
}

export function projectActivitySourceStatuses(
  facts: ProjectActivityFacts,
): ProjectActivitySourceStatus[] {
  const attributed = new Set(
    facts.history.map((fact) => fact.source.recordType),
  );
  return PROJECT_ACTIVITY_SOURCE_TYPES.map((sourceType) => {
    if (sourceType === "Automation") {
      return {
        reason:
          "Automation rows are changes whose actor is System automation, read from the same record history; there is no automation run log.",
        sourceType,
        status: "available" as const,
      };
    }
    if (sourceType === "GitHub") {
      return {
        reason:
          "Only changes GitHub made to Project records appear. Bound GitHub external records keep no per-change history yet, so none is shown.",
        sourceType,
        status: "partial" as const,
      };
    }
    return {
      reason: attributed.has(sourceType)
        ? null
        : `No ${sourceType} history is recorded for this Project yet.`,
      sourceType,
      status: "available" as const,
    };
  });
}

/**
 * Projects the attributed Kayıt geçmişi into atomic rows, newest first. One
 * history entry is one row; nothing is merged, so actor, time, origin, undo
 * boundary and previous–next stay separate. No row is a signal or a story
 * event.
 */
export function deriveProjectActivity(
  projectId: string,
  facts: ProjectActivityFacts,
  input: ParsedProjectActivityInput,
): ProjectActivity {
  const rows = facts.history
    .map(toRow)
    .filter(
      (row) =>
        matchesSource(row, input.sourceTypes) &&
        (input.eventTypes.length === 0 ||
          input.eventTypes.includes(row.eventType)),
    )
    .sort((left, right) =>
      left.occurredAt === right.occurredAt
        ? right.id.localeCompare(left.id)
        : right.occurredAt.localeCompare(left.occurredAt),
    )
    .filter((row) => afterCursor(row, input.cursor));
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    nextCursor: rows.length > input.limit && last ? cursorOf(last) : null,
    projectId,
    rows: page,
    sources: projectActivitySourceStatuses(facts),
    unattributed: facts.unattributed,
    windowReached: facts.windowReached,
  };
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/** The only operation: a read. There is no write, signal or story procedure. */
export interface ProjectActivityAccess {
  list: (
    accountId: string,
    input: ParsedProjectActivityInput,
  ) => Promise<ProjectActivity>;
}
