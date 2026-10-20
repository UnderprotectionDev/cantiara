import { z } from "zod";
import {
  type BrokenReferenceReason,
  brokenReferenceReasonSchema,
} from "./relations";

/**
 * Planned Tests and Handoff seam, case half (spec 53, ticket 01).
 *
 * A Planned Test Case (Planlı Test Senaryosu) is versioned test intent. This
 * contract deliberately names no runner, result, step, status or "validated"
 * concept: the surface is `list`, `create`, `createVersion`, `version` and
 * `relationTargets`, and every input is `.strict()` so none of those can be
 * smuggled in. `version` reads one EXACT version and has no "latest" form; that
 * is the pin the Test Session bind (ticket 02), the Test Handoff (ticket 03)
 * and the package export (ticket 04) extend this module with.
 */

const identifierSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.string().datetime({ offset: true });
const versionNumberSchema = z.number().int().min(1).safe();

export const PLANNED_TEST_CASE_LABEL = "Planned Test Case";
export const PLANNED_TESTS_AREA_LABEL = "Tests";

export const PLANNED_TEST_TEXT_MAX = 10_000;
export const PLANNED_TEST_RELATION_MAX = 50;

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

export const plannedTestCaseFieldsSchema = z
  .object({
    expectedBehavior: requiredText("Expected behavior", PLANNED_TEST_TEXT_MAX),
    notes: z
      .string()
      .trim()
      .max(
        PLANNED_TEST_TEXT_MAX,
        `Notes must be ${PLANNED_TEST_TEXT_MAX} characters or fewer.`,
      )
      .nullish()
      .transform((value) => (value ? value : null)),
    preconditions: requiredText("Preconditions", PLANNED_TEST_TEXT_MAX),
    purpose: requiredText("Purpose", PLANNED_TEST_TEXT_MAX),
    scope: requiredText("Scope", PLANNED_TEST_TEXT_MAX),
    title: requiredText("Title", 255),
  })
  .strict();

/**
 * Relation target families that have an owner record and a live resolver today.
 * Project Release and GitHub records belong to specs 63 and 61 and are absent
 * on purpose: this feature mints no placeholder ids for records that do not
 * exist yet. Repository, branch and commit are Handoff `product_build_context`
 * text, never a relation target.
 */
export const PLANNED_TEST_RELATION_TARGET_TYPES = [
  "Work",
  "Feature",
  "Document",
  "Decision",
  "Risk",
  "Project Goal",
  "Milestone",
  "Source",
  "Screen",
] as const;
export const plannedTestRelationTargetTypeSchema = z.enum(
  PLANNED_TEST_RELATION_TARGET_TYPES,
);
export type PlannedTestRelationTargetType = z.infer<
  typeof plannedTestRelationTargetTypeSchema
>;

const plainRelationSchema = z
  .object({
    targetId: identifierSchema,
    targetType: z.enum([
      "Work",
      "Feature",
      "Decision",
      "Risk",
      "Project Goal",
      "Milestone",
      "Source",
      "Screen",
    ]),
  })
  .strict();

/** A Document relation names the exact revision and, optionally, a stable section. */
const documentRelationSchema = z
  .object({
    documentRevision: z.number().int().nonnegative().safe(),
    sectionId: identifierSchema.optional(),
    targetId: identifierSchema,
    targetType: z.literal("Document"),
  })
  .strict();

export const plannedTestRelationInputSchema = z.union([
  plainRelationSchema,
  documentRelationSchema,
]);
export type PlannedTestRelationInput = z.output<
  typeof plannedTestRelationInputSchema
>;

const relationsSchema = z
  .array(plannedTestRelationInputSchema)
  .max(
    PLANNED_TEST_RELATION_MAX,
    `A ${PLANNED_TEST_CASE_LABEL} has at most ${PLANNED_TEST_RELATION_MAX} relations.`,
  )
  .default([]);

export const createPlannedTestCaseInputSchema = plannedTestCaseFieldsSchema
  .extend({ projectId: identifierSchema, relations: relationsSchema })
  .strict();
export type CreatePlannedTestCaseInput = z.input<
  typeof createPlannedTestCaseInputSchema
>;
export type ParsedCreatePlannedTestCaseInput = z.output<
  typeof createPlannedTestCaseInputSchema
>;

/** Input change kinds; both open a version, they only explain the difference. */
export const PLANNED_TEST_CHANGE_KINDS = [
  "Meaningful change",
  "Editorial change",
] as const;
export const plannedTestChangeKindSchema = z.enum(PLANNED_TEST_CHANGE_KINDS);
export type PlannedTestChangeKind = z.infer<typeof plannedTestChangeKindSchema>;
export const PLANNED_TEST_VERSION_KINDS = [
  "Initial version",
  ...PLANNED_TEST_CHANGE_KINDS,
] as const;
export const plannedTestVersionKindSchema = z.enum(PLANNED_TEST_VERSION_KINDS);
export type PlannedTestVersionKind = z.infer<
  typeof plannedTestVersionKindSchema
>;

/**
 * A new version carries the full definition, never a patch: the version stays
 * readable on its own. `expectedVersion` is the version the founder edited
 * from, so a concurrent edit is refused instead of overwritten.
 */
export const createPlannedTestCaseVersionInputSchema =
  plannedTestCaseFieldsSchema
    .extend({
      caseId: identifierSchema,
      changeKind: plannedTestChangeKindSchema,
      expectedVersion: versionNumberSchema,
      projectId: identifierSchema,
      relations: relationsSchema,
    })
    .strict();
export type CreatePlannedTestCaseVersionInput = z.input<
  typeof createPlannedTestCaseVersionInputSchema
>;
export type ParsedCreatePlannedTestCaseVersionInput = z.output<
  typeof createPlannedTestCaseVersionInputSchema
>;

export const plannedTestCaseProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

/** Exact version read. There is no optional `version`, so no "latest" lookup. */
export const plannedTestCaseVersionInputSchema = z
  .object({
    caseId: identifierSchema,
    projectId: identifierSchema,
    version: versionNumberSchema,
  })
  .strict();
export type PlannedTestCaseVersionInput = z.input<
  typeof plannedTestCaseVersionInputSchema
>;

export const plannedTestRelationTargetsInputSchema = z
  .object({
    projectId: identifierSchema,
    targetType: plannedTestRelationTargetTypeSchema,
  })
  .strict();
export type PlannedTestRelationTargetsInput = z.input<
  typeof plannedTestRelationTargetsInputSchema
>;

/** Exact reference a later bind, Handoff or package holds. Never `latest`. */
export const plannedTestCaseVersionRefSchema = z
  .object({ caseId: identifierSchema, version: versionNumberSchema })
  .strict();
export type PlannedTestCaseVersionRef = z.infer<
  typeof plannedTestCaseVersionRefSchema
>;

/**
 * Session Test bind (spec 53, ticket 02). An Oturum Testi (`Session Test`) is
 * bound, if at all, to an EXACT `scenario_id` + `scenario_version`; the bind is
 * the same `PlannedTestCaseVersionRef` the case half exposes, never "latest".
 * There is no rebind: the only bind transition is ad hoc -> linked, once. The
 * parent Test Session, results, review and report intake belong to spec 54/57.
 */
export const SESSION_TEST_LABEL = "Session Test";
export const SESSION_TEST_BIND_ORIGINS = [
  "Bound when recorded",
  "Linked later",
] as const;
export const sessionTestBindOriginSchema = z.enum(SESSION_TEST_BIND_ORIGINS);
export type SessionTestBindOrigin = z.infer<typeof sessionTestBindOriginSchema>;

/**
 * Ad hoc tests keep the then-current purpose and expected behavior on the
 * Session Test itself. A bound test takes its definition from the pinned
 * version and must not also carry a copy that could drift from it.
 */
export const recordSessionTestInputSchema = z
  .object({
    binding: plannedTestCaseVersionRefSchema.nullish(),
    expectedBehavior: requiredText(
      "Expected behavior",
      PLANNED_TEST_TEXT_MAX,
    ).optional(),
    projectId: identifierSchema,
    purpose: requiredText("Purpose", PLANNED_TEST_TEXT_MAX).optional(),
    title: requiredText("Title", 255),
  })
  .strict()
  .superRefine((value, context) => {
    const adHoc = !value.binding;
    for (const field of ["purpose", "expectedBehavior"] as const) {
      const present = value[field] !== undefined;
      if (adHoc && !present) {
        context.addIssue({
          code: "custom",
          message: "An ad hoc Session Test records its then-current content.",
          path: [field],
        });
      }
      if (!adHoc && present) {
        context.addIssue({
          code: "custom",
          message: "A bound Session Test takes its content from the version.",
          path: [field],
        });
      }
    }
  });
export type RecordSessionTestInput = z.input<
  typeof recordSessionTestInputSchema
>;
export type ParsedRecordSessionTestInput = z.output<
  typeof recordSessionTestInputSchema
>;

/** Links an ad hoc Session Test to one exact version, once. No rebind. */
export const linkSessionTestInputSchema = plannedTestCaseVersionRefSchema
  .extend({ projectId: identifierSchema, sessionTestId: identifierSchema })
  .strict();
export type LinkSessionTestInput = z.input<typeof linkSessionTestInputSchema>;

export const sessionTestProjectInputSchema = plannedTestCaseProjectInputSchema;

export interface SessionTestStoredRecord {
  bindOrigin: SessionTestBindOrigin | null;
  createdAt: string;
  expectedBehavior: string | null;
  id: string;
  linkedAt: string | null;
  projectId: string;
  purpose: string | null;
  scenarioId: string | null;
  scenarioVersion: number | null;
  title: string;
}

/**
 * What the bind says about the case today. `executedVersion` is the only
 * statement of what was actually tried against a case version: it is the bound
 * version when the bind was made at record time and `null` for a late link, so
 * a late link never shows its version as executed or validated.
 */
export interface SessionTestBindView {
  caseId: string;
  /** Versions added after the bound one, with how each differed. */
  changesSinceBound: { changeKind: PlannedTestVersionKind; version: number }[];
  currentVersion: number;
  /** Version that was executed; `null` for a late link. */
  executedVersion: number | null;
  linkedAt: string | null;
  origin: SessionTestBindOrigin;
  pinnedTitle: string;
  pinnedVersion: number;
  /** Explicit version difference, e.g. "Bound to v1, current v3". */
  summary: string;
  /** True only when the executed version is the current one. */
  validatesCurrentVersion: boolean;
}

export interface SessionTestRecord {
  bind: SessionTestBindView | null;
  createdAt: string;
  /** Recorded content: ad hoc and late-linked tests only. */
  expectedBehavior: string | null;
  id: string;
  projectId: string;
  purpose: string | null;
  title: string;
}

export interface SessionTestList {
  readOnly: boolean;
  sessionTests: SessionTestRecord[];
}

export function describeSessionTestBind(
  stored: SessionTestStoredRecord,
  scenario: PlannedTestStoredCase,
): SessionTestBindView {
  const pinnedVersion = stored.scenarioVersion;
  const pinned = scenario.versions.find(
    ({ version }) => version === pinnedVersion,
  );
  if (!pinned || stored.bindOrigin === null) {
    throw new Error(`Session Test ${stored.id} lost its pinned version.`);
  }
  const executedVersion =
    stored.bindOrigin === "Bound when recorded" ? pinned.version : null;
  const current =
    pinned.version === scenario.currentVersion
      ? "current"
      : `current v${scenario.currentVersion}`;
  const summary =
    executedVersion === null
      ? `Linked later to v${pinned.version}, not executed against it, ${current}`
      : `Bound to v${pinned.version}, ${current}`;
  return {
    caseId: scenario.id,
    changesSinceBound: scenario.versions
      .filter(({ version }) => version > pinned.version)
      .map(({ changeKind, version }) => ({ changeKind, version })),
    currentVersion: scenario.currentVersion,
    executedVersion,
    linkedAt: stored.linkedAt,
    origin: stored.bindOrigin,
    pinnedTitle: pinned.title,
    pinnedVersion: pinned.version,
    summary,
    validatesCurrentVersion: executedVersion === scenario.currentVersion,
  };
}

export function toSessionTestRecord(
  stored: SessionTestStoredRecord,
  scenario: PlannedTestStoredCase | null,
): SessionTestRecord {
  return {
    bind:
      stored.scenarioId !== null && scenario
        ? describeSessionTestBind(stored, scenario)
        : null,
    createdAt: stored.createdAt,
    expectedBehavior: stored.expectedBehavior,
    id: stored.id,
    projectId: stored.projectId,
    purpose: stored.purpose,
    title: stored.title,
  };
}

export interface PlannedTestStoredRelation {
  documentRevision: number | null;
  id: string;
  sectionId: string | null;
  targetId: string;
  targetType: PlannedTestRelationTargetType;
}

export interface PlannedTestStoredVersion {
  caseId: string;
  changeKind: PlannedTestVersionKind;
  createdAt: string;
  expectedBehavior: string;
  id: string;
  notes: string | null;
  preconditions: string;
  purpose: string;
  relations: PlannedTestStoredRelation[];
  scope: string;
  title: string;
  version: number;
}

export interface PlannedTestStoredCase {
  createdAt: string;
  currentVersion: number;
  id: string;
  projectId: string;
  updatedAt: string;
  /** Oldest first; versions are immutable and only ever appended. */
  versions: PlannedTestStoredVersion[];
}

export const plannedTestRelationViewSchema = z
  .object({
    brokenReason: brokenReferenceReasonSchema.nullable(),
    documentRevision: z.number().int().nonnegative().nullable(),
    id: identifierSchema,
    label: z.string().nullable(),
    sectionId: z.string().nullable(),
    sectionLabel: z.string().nullable(),
    state: z.enum(["resolved", "broken"]),
    targetId: identifierSchema,
    targetType: plannedTestRelationTargetTypeSchema,
  })
  .strict();
export type PlannedTestRelationView = z.infer<
  typeof plannedTestRelationViewSchema
>;

export const plannedTestCaseVersionRecordSchema =
  plannedTestCaseFieldsSchema.extend({
    caseId: identifierSchema,
    changeKind: plannedTestVersionKindSchema,
    createdAt: timestampSchema,
    id: identifierSchema,
    relations: z.array(plannedTestRelationViewSchema),
    version: versionNumberSchema,
  });
export type PlannedTestCaseVersionRecord = z.output<
  typeof plannedTestCaseVersionRecordSchema
>;

export interface PlannedTestCaseRecord {
  createdAt: string;
  /** The head version. Informational only: nothing binds to "current". */
  current: PlannedTestCaseVersionRecord;
  id: string;
  projectId: string;
  updatedAt: string;
  /** Every version, oldest first. */
  versions: PlannedTestCaseVersionRecord[];
}

export interface PlannedTestCaseList {
  cases: PlannedTestCaseRecord[];
  readOnly: boolean;
}

export interface PlannedTestRelationTarget {
  /** Current revision; present for a Document, which relates by exact revision. */
  documentRevision: number | null;
  label: string;
  /** Stable sections of the current revision; present for a Document. */
  sections: { id: string; label: string }[];
  targetId: string;
  targetType: PlannedTestRelationTargetType;
}

/** What a live owner resolver says about a relation the founder is binding now. */
export interface PlannedTestBoundTarget {
  label: string;
  sectionLabel: string | null;
}

/**
 * Live resolvers of the target families' owner records, scoped to one account
 * and Project. `bind` returns `null` for anything that is not an existing,
 * active record of this Project, so a title-only or placeholder relation can
 * never be saved. `read` reports an existing relation against the owner's
 * current state and names a gone target as broken, never as another record.
 */
export interface PlannedTestTargetResolver {
  bind: (
    relation: PlannedTestRelationInput,
  ) => Promise<PlannedTestBoundTarget | null>;
  candidates: (
    targetType: PlannedTestRelationTargetType,
  ) => Promise<PlannedTestRelationTarget[]>;
  read: (
    relation: PlannedTestStoredRelation,
  ) => Promise<
    | { label: string; sectionLabel: string | null; state: "resolved" }
    | { reason: BrokenReferenceReason; state: "broken" }
  >;
}

/** One Project-scoped unit of work; a write holds the case rows it touches. */
export interface PlannedTestTransaction {
  appendVersion: (
    caseId: string,
    version: PlannedTestStoredVersion,
    updatedAt: string,
  ) => Promise<void>;
  /** When `lock` is true the case row is held until the unit of work ends. */
  findCase: (
    caseId: string,
    lock: boolean,
  ) => Promise<PlannedTestStoredCase | null>;
  findSessionTest: (
    sessionTestId: string,
    lock: boolean,
  ) => Promise<SessionTestStoredRecord | null>;
  insertCase: (record: PlannedTestStoredCase) => Promise<void>;
  insertSessionTest: (record: SessionTestStoredRecord) => Promise<void>;
  /**
   * Sets the bind of a Session Test that has none. Resolves `false` when it
   * already had one, so a bind can never be moved.
   */
  linkSessionTest: (
    sessionTestId: string,
    ref: PlannedTestCaseVersionRef,
    linkedAt: string,
  ) => Promise<boolean>;
  listCases: () => Promise<PlannedTestStoredCase[]>;
  listSessionTests: () => Promise<SessionTestStoredRecord[]>;
  /** True for an archived Project, which stays readable but takes no writes. */
  readOnly: boolean;
  resolver: PlannedTestTargetResolver;
}

export interface PlannedTestStore {
  /** Resolves to `null` when the account does not own the Project. */
  run: <T>(
    accountId: string,
    projectId: string,
    mode: "read" | "write",
    work: (transaction: PlannedTestTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

export interface PlannedTestsAccess {
  create: (
    accountId: string,
    input: CreatePlannedTestCaseInput,
  ) => Promise<PlannedTestCaseRecord>;
  createVersion: (
    accountId: string,
    input: CreatePlannedTestCaseVersionInput,
  ) => Promise<PlannedTestCaseRecord>;
  /** Binds an ad hoc Session Test to one exact version, once. */
  linkSessionTest: (
    accountId: string,
    input: LinkSessionTestInput,
  ) => Promise<SessionTestRecord>;
  list: (accountId: string, projectId: string) => Promise<PlannedTestCaseList>;
  recordSessionTest: (
    accountId: string,
    input: RecordSessionTestInput,
  ) => Promise<SessionTestRecord>;
  relationTargets: (
    accountId: string,
    input: PlannedTestRelationTargetsInput,
  ) => Promise<PlannedTestRelationTarget[]>;
  sessionTests: (
    accountId: string,
    projectId: string,
  ) => Promise<SessionTestList>;
  /** Exactly the requested version, with its relations resolved live. */
  version: (
    accountId: string,
    input: PlannedTestCaseVersionInput,
  ) => Promise<PlannedTestCaseVersionRecord>;
}

type VersionContent = Pick<
  PlannedTestStoredVersion,
  "expectedBehavior" | "notes" | "preconditions" | "purpose" | "scope" | "title"
> & {
  relations: Pick<
    PlannedTestStoredRelation,
    "documentRevision" | "sectionId" | "targetId" | "targetType"
  >[];
};

export function relationKey(
  relation: Pick<
    PlannedTestStoredRelation,
    "documentRevision" | "sectionId" | "targetId" | "targetType"
  >,
) {
  return JSON.stringify([
    relation.targetType,
    relation.targetId,
    relation.documentRevision,
    relation.sectionId,
  ]);
}

/** True when two definitions are identical, relations compared as a set. */
export function isSamePlannedTestContent(
  left: VersionContent,
  right: VersionContent,
) {
  const keys = (content: VersionContent) =>
    content.relations.map(relationKey).sort();
  return (
    left.title === right.title &&
    left.purpose === right.purpose &&
    left.scope === right.scope &&
    left.preconditions === right.preconditions &&
    left.expectedBehavior === right.expectedBehavior &&
    left.notes === right.notes &&
    JSON.stringify(keys(left)) === JSON.stringify(keys(right))
  );
}

/** The first repeated relation, or `null`. Repeats are refused, not merged. */
export function duplicatePlannedTestRelation(
  relations: readonly PlannedTestRelationInput[],
) {
  const seen = new Set<string>();
  for (const relation of relations) {
    const key = relationKey({
      documentRevision:
        "documentRevision" in relation ? relation.documentRevision : null,
      sectionId: "sectionId" in relation ? (relation.sectionId ?? null) : null,
      targetId: relation.targetId,
      targetType: relation.targetType,
    });
    if (seen.has(key)) {
      return relation;
    }
    seen.add(key);
  }
  return null;
}
