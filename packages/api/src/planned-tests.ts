import { z } from "zod";
import {
  type BrokenReferenceReason,
  brokenReferenceReasonSchema,
} from "./relations";
import {
  findSecretKinds,
  type TestHandoffPackageJson,
} from "./test-handoff-package";

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

/**
 * Test Handoff lifecycle (spec 53, ticket 03). A Test Handoff is a light
 * historical Project record of requested external test work and the Session
 * Tests that come back. It is NOT a Test Session, NOT a runner or CI
 * orchestrator and NOT Work's external execution handoff (ADR-0015, spec 24):
 * it shares none of that contract's types, states or tables. The states
 * describe the handoff PROCESS, never a test result, and no state is entered by
 * the product on its own: a linked Session Test only yields a `suggestion`.
 * The surface has no start, run, poll, schedule or remote-cancel operation.
 */
export const TEST_HANDOFF_LABEL = "Test Handoff";
export const TEST_HANDOFF_STATES = [
  "Draft",
  "Ready to share",
  "Shared",
  "Result received",
  "Closed",
  "Canceled",
] as const;
export const testHandoffStateSchema = z.enum(TEST_HANDOFF_STATES);
export type TestHandoffState = z.infer<typeof testHandoffStateSchema>;

/**
 * The only founder-driven moves. `Closed` and `Canceled` are final: a late
 * report may still be linked to a canceled Handoff, but it is never reopened.
 * `Result received` may fall back to `Shared` when more results are expected.
 * Only the founder moves a Handoff; nothing here is reached by a linked report.
 */
export const TEST_HANDOFF_TRANSITIONS: Record<
  TestHandoffState,
  readonly TestHandoffState[]
> = {
  Canceled: [],
  Closed: [],
  Draft: ["Ready to share", "Canceled"],
  "Ready to share": ["Draft", "Shared", "Canceled"],
  "Result received": ["Shared", "Closed"],
  Shared: ["Result received", "Closed", "Canceled"],
};

export function canTransitionTestHandoff(
  from: TestHandoffState,
  to: TestHandoffState,
) {
  return TEST_HANDOFF_TRANSITIONS[from].includes(to);
}

/** Content is editable only until it is shared; a shared Handoff is history. */
export const TEST_HANDOFF_EDITABLE_STATES: readonly TestHandoffState[] = [
  "Draft",
  "Ready to share",
];

export const TEST_HANDOFF_SCENARIO_MAX = 100;
export const TEST_HANDOFF_EXECUTOR_SUGGESTIONS = [
  "Me",
  "Codex",
  "Claude Code",
  "Conductor",
] as const;

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * A founder-typed build context value. Text is kept as typed; a URL must be
 * plain http(s) with no credentials, query or fragment, because those are the
 * places tokens travel and this value is later copied into a package.
 */
function contextValue(label: string) {
  return z
    .string()
    .trim()
    .max(255, `${label} must be 255 characters or fewer.`)
    .nullish()
    .transform((value) => (value ? value : null))
    .superRefine((value, context) => {
      if (value === null || !URL_SCHEME.test(value)) {
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        context.addIssue({
          code: "custom",
          message: `${label} is not a valid URL.`,
        });
        return;
      }
      const safe =
        (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        !parsed.username &&
        !parsed.password &&
        !parsed.search &&
        !parsed.hash;
      if (!safe) {
        context.addIssue({
          code: "custom",
          message: `${label} must be an http(s) URL without credentials, query or fragment.`,
        });
      }
    });
}

/** Founder-typed `product_build_context`. The product never reads GitHub or CI. */
export const testHandoffBuildContextSchema = z
  .object({
    branch: contextValue("Branch"),
    build: contextValue("Build"),
    commit: contextValue("Commit"),
    repository: contextValue("Repository"),
    targetEnvironment: contextValue("Target environment"),
  })
  .strict();
export type TestHandoffBuildContext = z.output<
  typeof testHandoffBuildContextSchema
>;
export const EMPTY_TEST_HANDOFF_BUILD_CONTEXT: TestHandoffBuildContext = {
  branch: null,
  build: null,
  commit: null,
  repository: null,
  targetEnvironment: null,
};

const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be a calendar date.")
  .refine(
    (value) => new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
    "Due date must be a calendar date.",
  )
  .nullish()
  .transform((value) => (value ? value : null));

const handoffScenariosSchema = z
  .array(plannedTestCaseVersionRefSchema)
  .max(
    TEST_HANDOFF_SCENARIO_MAX,
    `A ${TEST_HANDOFF_LABEL} selects at most ${TEST_HANDOFF_SCENARIO_MAX} versions.`,
  )
  .default([])
  .refine(
    (refs) => new Set(refs.map(({ caseId }) => caseId)).size === refs.length,
    "Select one version per Planned Test Case.",
  );

/**
 * Founder-typed Handoff text never carries a secret. The scan names the kind of
 * secret and never repeats the value; the same scan runs again over the whole
 * package when it is previewed or produced.
 */
function secretFree(label: string) {
  return (value: string | null, context: z.RefinementCtx) => {
    if (value === null) {
      return;
    }
    const kinds = findSecretKinds(value);
    if (kinds.length > 0) {
      context.addIssue({
        code: "custom",
        message: `${label} looks like it contains a secret (${kinds.join(", ")}). Remove it: a ${TEST_HANDOFF_LABEL} package never carries secrets, tokens or credentials.`,
      });
    }
  };
}

export const TEST_HANDOFF_AD_HOC_MAX = 50;
export const TEST_HANDOFF_CONTEXT_REF_MAX = 50;

/** Founder-written intent that is not a Planned Test Case. Mints no id or version. */
export const testHandoffAdHocItemSchema = z
  .object({
    expectedBehavior: requiredText(
      "Ad hoc expected behavior",
      PLANNED_TEST_TEXT_MAX,
    ).superRefine(secretFree("Ad hoc expected behavior")),
    intent: requiredText("Ad hoc intent", PLANNED_TEST_TEXT_MAX).superRefine(
      secretFree("Ad hoc intent"),
    ),
  })
  .strict();
export type TestHandoffAdHocItem = z.output<typeof testHandoffAdHocItemSchema>;

const handoffAdHocScopeSchema = z
  .array(testHandoffAdHocItemSchema)
  .max(
    TEST_HANDOFF_AD_HOC_MAX,
    `A ${TEST_HANDOFF_LABEL} holds at most ${TEST_HANDOFF_AD_HOC_MAX} ad hoc items.`,
  )
  .default([]);

/**
 * Records the founder adds to a Handoff as package context. Every reference is
 * exact: a Document names its revision (and optionally a stable section), a
 * Wireframe names its Screen and an exact version. Technical Diagrams have no
 * version yet, so they cannot be referenced exactly and are not selectable.
 */
export const TEST_HANDOFF_CONTEXT_KINDS = [
  "Work",
  "Feature",
  "Document",
  "Wireframe",
] as const;
export const testHandoffContextKindSchema = z.enum(TEST_HANDOFF_CONTEXT_KINDS);
export type TestHandoffContextKind = z.infer<
  typeof testHandoffContextKindSchema
>;

export const testHandoffContextRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Work"), targetId: identifierSchema }).strict(),
  z.object({ kind: z.literal("Feature"), targetId: identifierSchema }).strict(),
  z
    .object({
      documentRevision: z.number().int().min(0).safe(),
      kind: z.literal("Document"),
      sectionId: identifierSchema.nullish().transform((value) => value ?? null),
      targetId: identifierSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("Wireframe"),
      targetId: identifierSchema,
      wireframeVersion: versionNumberSchema,
    })
    .strict(),
]);
export type TestHandoffContextRef = z.output<
  typeof testHandoffContextRefSchema
>;

export function testHandoffContextRefKey(ref: TestHandoffContextRef) {
  return JSON.stringify([
    ref.kind,
    ref.targetId,
    ref.kind === "Document" ? ref.documentRevision : null,
    ref.kind === "Document" ? ref.sectionId : null,
    ref.kind === "Wireframe" ? ref.wireframeVersion : null,
  ]);
}

const handoffContextRefsSchema = z
  .array(testHandoffContextRefSchema)
  .max(
    TEST_HANDOFF_CONTEXT_REF_MAX,
    `A ${TEST_HANDOFF_LABEL} selects at most ${TEST_HANDOFF_CONTEXT_REF_MAX} context records.`,
  )
  .default([])
  .refine(
    (refs) => new Set(refs.map(testHandoffContextRefKey)).size === refs.length,
    "Select each context record once.",
  );

/**
 * Target executor is free text on purpose: the founder, Codex, Claude Code,
 * Conductor or any named external tool. The suggestions above are not a closed
 * runtime list and nothing dispatches on them.
 */
export const testHandoffFieldsSchema = z
  .object({
    adHocScope: handoffAdHocScopeSchema,
    buildContext: testHandoffBuildContextSchema.prefault({}),
    contextRefs: handoffContextRefsSchema,
    dueDate: dueDateSchema,
    environmentPreconditions: z
      .string()
      .trim()
      .max(
        PLANNED_TEST_TEXT_MAX,
        `Environment preconditions must be ${PLANNED_TEST_TEXT_MAX} characters or fewer.`,
      )
      .nullish()
      .transform((value) => (value ? value : null))
      .superRefine(secretFree("Environment preconditions")),
    purpose: requiredText(
      "Purpose and scope",
      PLANNED_TEST_TEXT_MAX,
    ).superRefine(secretFree("Purpose and scope")),
    scenarios: handoffScenariosSchema,
    targetExecutor: z
      .string()
      .trim()
      .max(120, "Target executor must be 120 characters or fewer.")
      .nullish()
      .transform((value) => (value ? value : null)),
    title: requiredText("Title", 255).superRefine(secretFree("Title")),
  })
  .strict();

export const createTestHandoffInputSchema = testHandoffFieldsSchema
  .extend({ projectId: identifierSchema })
  .strict();
export type CreateTestHandoffInput = z.input<
  typeof createTestHandoffInputSchema
>;

/** Full replace of the editable content, like a new case version. */
export const updateTestHandoffInputSchema = testHandoffFieldsSchema
  .extend({ handoffId: identifierSchema, projectId: identifierSchema })
  .strict();
export type UpdateTestHandoffInput = z.input<
  typeof updateTestHandoffInputSchema
>;

/** `expectedState` is the state the founder saw, so a stale click is refused. */
export const transitionTestHandoffInputSchema = z
  .object({
    expectedState: testHandoffStateSchema,
    handoffId: identifierSchema,
    projectId: identifierSchema,
    to: testHandoffStateSchema,
  })
  .strict();
export type TransitionTestHandoffInput = z.input<
  typeof transitionTestHandoffInputSchema
>;

/** Links an arriving Session Test to a Handoff, once. Spec 54 owns acceptance. */
export const linkTestHandoffSessionTestInputSchema = z
  .object({
    handoffId: identifierSchema,
    projectId: identifierSchema,
    sessionTestId: identifierSchema,
  })
  .strict();
export type LinkTestHandoffSessionTestInput = z.input<
  typeof linkTestHandoffSessionTestInputSchema
>;

export const testHandoffProjectInputSchema = plannedTestCaseProjectInputSchema;

export const testHandoffContextTargetsInputSchema = z
  .object({ kind: testHandoffContextKindSchema, projectId: identifierSchema })
  .strict();
export type TestHandoffContextTargetsInput = z.input<
  typeof testHandoffContextTargetsInputSchema
>;

export const testHandoffPackageInputSchema = z
  .object({ handoffId: identifierSchema, projectId: identifierSchema })
  .strict();
export type TestHandoffPackageInput = z.input<
  typeof testHandoffPackageInputSchema
>;

/**
 * Confirm carries the package version and fingerprint the founder previewed,
 * so a package is only produced from what was shown. A change in between is a
 * conflict, never a silently different package.
 */
export const produceTestHandoffPackageInputSchema =
  testHandoffPackageInputSchema
    .extend({
      expectedPackageVersion: versionNumberSchema,
      previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
export type ProduceTestHandoffPackageInput = z.input<
  typeof produceTestHandoffPackageInputSchema
>;

/** Only a shared-ready Handoff produces a package; a Draft is not shareable yet. */
export const TEST_HANDOFF_PACKAGE_STATES: readonly TestHandoffState[] = [
  "Ready to share",
  "Shared",
];

export interface TestHandoffStoredRecord {
  adHocScope: TestHandoffAdHocItem[];
  buildContext: TestHandoffBuildContext;
  /** Founder-selected work, document and design records, in chosen order. */
  contextRefs: TestHandoffContextRef[];
  createdAt: string;
  /** Calendar date `YYYY-MM-DD`, or `null`. */
  dueDate: string | null;
  environmentPreconditions: string | null;
  id: string;
  /**
   * Package version counter. `0` means no package was produced yet; producing a
   * package (ticket 04) is the only writer and increments it in the same
   * transaction that stores the package.
   */
  packageVersion: number;
  projectId: string;
  purpose: string;
  /** Selected exact versions in the order the founder chose. */
  scenarios: PlannedTestCaseVersionRef[];
  /** Arriving Session Tests, oldest link first. */
  sessionTests: { linkedAt: string; sessionTestId: string }[];
  state: TestHandoffState;
  stateChangedAt: string;
  targetExecutor: string | null;
  title: string;
  updatedAt: string;
}

export interface TestHandoffScenarioView {
  caseId: string;
  currentVersion: number;
  /** Explicit difference, e.g. "Pinned to v1, current v3". */
  summary: string;
  title: string;
  version: number;
}

export interface TestHandoffSuggestion {
  reason: string;
  state: "Result received";
}

export type TestHandoffContextRefView = TestHandoffContextRef & {
  brokenReason: BrokenReferenceReason | null;
  label: string | null;
};

export interface TestHandoffRecord {
  adHocScope: TestHandoffAdHocItem[];
  allowedTransitions: TestHandoffState[];
  buildContext: TestHandoffBuildContext;
  contextRefs: TestHandoffContextRefView[];
  createdAt: string;
  dueDate: string | null;
  editable: boolean;
  environmentPreconditions: string | null;
  id: string;
  packageVersion: number;
  projectId: string;
  purpose: string;
  /** A report arrived after cancel: shown as attention, state is unchanged. */
  resultAfterCancel: boolean;
  scenarios: TestHandoffScenarioView[];
  sessionTests: SessionTestRecord[];
  state: TestHandoffState;
  stateChangedAt: string;
  /**
   * Only a suggestion. The product never moves or closes a Handoff because a
   * Session Test arrived; the founder makes `Result received` explicit.
   */
  suggestion: TestHandoffSuggestion | null;
  targetExecutor: string | null;
  title: string;
  updatedAt: string;
}

export interface TestHandoffList {
  handoffs: TestHandoffRecord[];
  readOnly: boolean;
}

export function toTestHandoffRecord(
  stored: TestHandoffStoredRecord,
  cases: ReadonlyMap<string, PlannedTestStoredCase>,
  sessionTests: ReadonlyMap<string, SessionTestStoredRecord>,
  contextLive: ReadonlyMap<string, TestHandoffContextLive> = new Map(),
): TestHandoffRecord {
  const scenarios = stored.scenarios.map((ref): TestHandoffScenarioView => {
    const scenario = cases.get(ref.caseId);
    const pinned = scenario?.versions.find(
      ({ version }) => version === ref.version,
    );
    if (!(scenario && pinned)) {
      throw new Error(`Test Handoff ${stored.id} lost a pinned version.`);
    }
    return {
      caseId: ref.caseId,
      currentVersion: scenario.currentVersion,
      summary: `Pinned to v${ref.version}, ${
        ref.version === scenario.currentVersion
          ? "current"
          : `current v${scenario.currentVersion}`
      }`,
      title: pinned.title,
      version: ref.version,
    };
  });
  const arrived = stored.sessionTests.flatMap(({ sessionTestId }) => {
    const found = sessionTests.get(sessionTestId);
    if (!found) {
      return [];
    }
    return [
      toSessionTestRecord(
        found,
        found.scenarioId ? (cases.get(found.scenarioId) ?? null) : null,
      ),
    ];
  });
  return {
    adHocScope: stored.adHocScope,
    allowedTransitions: [...TEST_HANDOFF_TRANSITIONS[stored.state]],
    buildContext: stored.buildContext,
    contextRefs: stored.contextRefs.map((ref) => {
      const live = contextLive.get(testHandoffContextRefKey(ref));
      return {
        ...ref,
        brokenReason: live?.state === "broken" ? live.reason : null,
        label: live?.state === "resolved" ? live.label : null,
      };
    }),
    createdAt: stored.createdAt,
    dueDate: stored.dueDate,
    editable: TEST_HANDOFF_EDITABLE_STATES.includes(stored.state),
    environmentPreconditions: stored.environmentPreconditions,
    id: stored.id,
    packageVersion: stored.packageVersion,
    projectId: stored.projectId,
    purpose: stored.purpose,
    resultAfterCancel: stored.state === "Canceled" && arrived.length > 0,
    scenarios,
    sessionTests: arrived,
    state: stored.state,
    stateChangedAt: stored.stateChangedAt,
    suggestion:
      stored.state === "Shared" && arrived.length > 0
        ? {
            reason: `${arrived.length} linked ${
              arrived.length === 1 ? "Session Test" : "Session Tests"
            } arrived. Mark Result received when you have read them; the ${TEST_HANDOFF_LABEL} stays open until you close it.`,
            state: "Result received",
          }
        : null,
    targetExecutor: stored.targetExecutor,
    title: stored.title,
    updatedAt: stored.updatedAt,
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

/** What a live owner resolver says about a Handoff context record. */
export type TestHandoffContextLive =
  | { label: string; state: "resolved" }
  | { reason: BrokenReferenceReason; state: "broken" };

export interface TestHandoffContextCandidate {
  /** Document only: the current revision, which the reference will pin. */
  documentRevision: number | null;
  kind: TestHandoffContextKind;
  label: string;
  /** Document only: stable sections of the current revision. */
  sections: { id: string; label: string }[];
  targetId: string;
  /** Wireframe only: the exact versions that exist for the Screen. */
  wireframeVersions: number[];
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
  /**
   * Pins a Handoff context record: `null` unless it is an existing, active
   * record of this Project (a Document must still be at the named revision and
   * hold the named section; a Wireframe version must exist).
   */
  bindContext: (ref: TestHandoffContextRef) => Promise<string | null>;
  candidates: (
    targetType: PlannedTestRelationTargetType,
  ) => Promise<PlannedTestRelationTarget[]>;
  contextCandidates: (
    kind: TestHandoffContextKind,
  ) => Promise<TestHandoffContextCandidate[]>;
  read: (
    relation: PlannedTestStoredRelation,
  ) => Promise<
    | { label: string; sectionLabel: string | null; state: "resolved" }
    | { reason: BrokenReferenceReason; state: "broken" }
  >;
  /** Reads an already pinned context record against its owner's current state. */
  readContext: (ref: TestHandoffContextRef) => Promise<TestHandoffContextLive>;
}

/**
 * One produced package, persisted exactly as it was handed out. `json` and
 * `markdown` are the two renderings of the same package version; a later case,
 * spec or Screen edit never touches them.
 */
export interface TestHandoffPackageStored {
  createdAt: string;
  handoffId: string;
  json: string;
  markdown: string;
  packageVersion: number;
}

export interface TestHandoffPackageRecord extends TestHandoffPackageStored {
  package: TestHandoffPackageJson;
  schemaVersion: TestHandoffPackageJson["schema_version"];
}

export type TestHandoffPackageBlockerKind = "secret" | "state" | "unavailable";

/** Something that stops the package from being produced; never carries a value. */
export interface TestHandoffPackageBlocker {
  kind: TestHandoffPackageBlockerKind;
  message: string;
  path: string | null;
}

/**
 * Closed-world preview. It lists exactly what the package will contain and
 * what it never contains. With any blocker the rendering is withheld, so a
 * blocked preview can never be copied out as a package.
 */
export interface TestHandoffPackagePreview {
  blockers: TestHandoffPackageBlocker[];
  canProduce: boolean;
  excluded: string[];
  /** Fingerprint of the package content (without `created_at`), or `null`. */
  fingerprint: string | null;
  handoffId: string;
  included: { count: number; section: string }[];
  json: string | null;
  markdown: string | null;
  nextPackageVersion: number;
}

export interface TestHandoffPackageList {
  handoffId: string;
  packages: TestHandoffPackageRecord[];
}

export const TEST_HANDOFF_PACKAGE_EXCLUDED = [
  "Records you did not select",
  "Records you cannot access, in Trash or archived",
  "Secrets, tokens and credentials",
  "Redacted values",
  "Attachments (none are approved for this package)",
  "Anything GitHub or CI could report",
] as const;

/** One Project-scoped unit of work; a write holds the case rows it touches. */
export interface PlannedTestTransaction {
  appendVersion: (
    caseId: string,
    version: PlannedTestStoredVersion,
    updatedAt: string,
  ) => Promise<void>;
  /**
   * Increments the package counter only while it is still `expected`. Resolves
   * `false` otherwise, so two producers can never both claim one version.
   */
  bumpPackageVersion: (handoffId: string, expected: number) => Promise<boolean>;
  /** When `lock` is true the case row is held until the unit of work ends. */
  findCase: (
    caseId: string,
    lock: boolean,
  ) => Promise<PlannedTestStoredCase | null>;
  /** When `lock` is true the Handoff row is held until the unit of work ends. */
  findHandoff: (
    handoffId: string,
    lock: boolean,
  ) => Promise<TestHandoffStoredRecord | null>;
  findSessionTest: (
    sessionTestId: string,
    lock: boolean,
  ) => Promise<SessionTestStoredRecord | null>;
  insertCase: (record: PlannedTestStoredCase) => Promise<void>;
  insertHandoff: (record: TestHandoffStoredRecord) => Promise<void>;
  insertPackage: (record: TestHandoffPackageStored) => Promise<void>;
  insertSessionTest: (record: SessionTestStoredRecord) => Promise<void>;
  /**
   * Attaches a Session Test to a Handoff. Resolves `false` when the Session
   * Test already arrived on a Handoff, so a link can never be moved.
   */
  linkHandoffSessionTest: (
    handoffId: string,
    sessionTestId: string,
    linkedAt: string,
  ) => Promise<boolean>;
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
  listHandoffs: () => Promise<TestHandoffStoredRecord[]>;
  /** Produced packages of one Handoff, newest version first. */
  listPackages: (handoffId: string) => Promise<TestHandoffPackageStored[]>;
  listSessionTests: () => Promise<SessionTestStoredRecord[]>;
  /** The Project the unit of work belongs to; its name goes into the package. */
  project: { id: string; name: string };
  /** True for an archived Project, which stays readable but takes no writes. */
  readOnly: boolean;
  /** Replaces the editable content and selected versions of a Handoff. */
  replaceHandoffContent: (
    handoffId: string,
    content: Pick<
      TestHandoffStoredRecord,
      | "adHocScope"
      | "buildContext"
      | "contextRefs"
      | "dueDate"
      | "environmentPreconditions"
      | "purpose"
      | "scenarios"
      | "targetExecutor"
      | "title"
    >,
    updatedAt: string,
  ) => Promise<void>;
  resolver: PlannedTestTargetResolver;
  /**
   * Moves a Handoff only while it is still in `expected`. Resolves `false`
   * otherwise, so a concurrent move is refused rather than overwritten.
   */
  setHandoffState: (
    handoffId: string,
    expected: TestHandoffState,
    to: TestHandoffState,
    changedAt: string,
  ) => Promise<boolean>;
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
  /** Selectable context records for a Handoff, by kind. */
  contextTargets: (
    accountId: string,
    input: TestHandoffContextTargetsInput,
  ) => Promise<TestHandoffContextCandidate[]>;
  create: (
    accountId: string,
    input: CreatePlannedTestCaseInput,
  ) => Promise<PlannedTestCaseRecord>;
  createHandoff: (
    accountId: string,
    input: CreateTestHandoffInput,
  ) => Promise<TestHandoffRecord>;
  createVersion: (
    accountId: string,
    input: CreatePlannedTestCaseVersionInput,
  ) => Promise<PlannedTestCaseRecord>;
  handoffs: (accountId: string, projectId: string) => Promise<TestHandoffList>;
  /** Attaches an arriving Session Test; never moves the Handoff's state. */
  linkHandoffSessionTest: (
    accountId: string,
    input: LinkTestHandoffSessionTestInput,
  ) => Promise<TestHandoffRecord>;
  /** Binds an ad hoc Session Test to one exact version, once. */
  linkSessionTest: (
    accountId: string,
    input: LinkSessionTestInput,
  ) => Promise<SessionTestRecord>;
  list: (accountId: string, projectId: string) => Promise<PlannedTestCaseList>;
  /** Produced packages of one Handoff, exactly as they were handed out. */
  packages: (
    accountId: string,
    input: TestHandoffPackageInput,
  ) => Promise<TestHandoffPackageList>;
  /** Writes nothing. Lists what a package would hold and what blocks it. */
  previewPackage: (
    accountId: string,
    input: TestHandoffPackageInput,
  ) => Promise<TestHandoffPackagePreview>;
  /**
   * Confirms a previewed package: stores it and increments the package version
   * in one transaction. It starts nothing and moves no Handoff state.
   */
  producePackage: (
    accountId: string,
    input: ProduceTestHandoffPackageInput,
  ) => Promise<TestHandoffPackageRecord>;
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
  /** The only way a Handoff changes state, and only as the founder asks. */
  transitionHandoff: (
    accountId: string,
    input: TransitionTestHandoffInput,
  ) => Promise<TestHandoffRecord>;
  updateHandoff: (
    accountId: string,
    input: UpdateTestHandoffInput,
  ) => Promise<TestHandoffRecord>;
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
