import { z } from "zod";
import {
  type BrokenReferenceReason,
  brokenReferenceReasonSchema,
} from "./relations";

/**
 * Test Gaps seam (spec 55).
 *
 * A Test Gap (Test Açığı) is a Project master record the founder writes by
 * hand: a title, a rationale and support relations. This contract names no
 * coverage, score, severity, result, runner or auto-create concept: the write
 * surface is `create` (and, in later tickets, the manual bind and close
 * operations), and every input is `.strict()` so none of those can be smuggled
 * in. Nothing here is reachable from a failed Session Test, a missing case
 * relation, an executor note, a spec change, a GitHub check or similarity.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const TEST_GAP_LABEL = "Test Gap";
export const TEST_GAPS_AREA_LABEL = "Tests";

export const TEST_GAP_TEXT_MAX = 10_000;
export const TEST_GAP_RELATION_MAX = 50;

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

/**
 * Support relation families: Feature, Work, spec section (a Document revision
 * and optional stable section), Risk and Project Release. A relation is
 * evidence for the founder's judgement; binding one never writes the target's
 * status, priority or publish fitness.
 */
export const TEST_GAP_RELATION_TARGET_TYPES = [
  "Feature",
  "Work",
  "Document",
  "Risk",
  "Project Release",
] as const;
export const testGapRelationTargetTypeSchema = z.enum(
  TEST_GAP_RELATION_TARGET_TYPES,
);
export type TestGapRelationTargetType = z.infer<
  typeof testGapRelationTargetTypeSchema
>;

const plainRelationSchema = z
  .object({
    targetId: identifierSchema,
    targetType: z.enum(["Feature", "Work", "Risk", "Project Release"]),
  })
  .strict();

/** A spec section relation names the exact Document revision and, optionally, a stable section. */
const documentRelationSchema = z
  .object({
    documentRevision: z.number().int().nonnegative().safe(),
    sectionId: identifierSchema.optional(),
    targetId: identifierSchema,
    targetType: z.literal("Document"),
  })
  .strict();

export const testGapRelationInputSchema = z.union([
  plainRelationSchema,
  documentRelationSchema,
]);
export type TestGapRelationInput = z.output<typeof testGapRelationInputSchema>;

export const createTestGapInputSchema = z
  .object({
    projectId: identifierSchema,
    rationale: requiredText("Rationale", TEST_GAP_TEXT_MAX),
    relations: z
      .array(testGapRelationInputSchema)
      .max(
        TEST_GAP_RELATION_MAX,
        `A ${TEST_GAP_LABEL} has at most ${TEST_GAP_RELATION_MAX} relations.`,
      )
      .default([]),
    title: requiredText("Title", 255),
  })
  .strict();
export type CreateTestGapInput = z.input<typeof createTestGapInputSchema>;

export const testGapProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const testGapRelationTargetsInputSchema = z
  .object({
    projectId: identifierSchema,
    targetType: testGapRelationTargetTypeSchema,
  })
  .strict();
export type TestGapRelationTargetsInput = z.input<
  typeof testGapRelationTargetsInputSchema
>;

/**
 * Test Gap states (spec 55). `Open` and `Planned` are reached by planning:
 * binding a Planned Test Case version or a Test Handoff lifts a Gap to at most
 * `Planned`. `Met by result` and `Not needed` are the founder's explicit
 * closure, never reached by a bind, a new Session Test or an incoming report.
 */
export const TEST_GAP_STATES = [
  "Open",
  "Planned",
  "Met by result",
  "Not needed",
] as const;
export const testGapStateSchema = z.enum(TEST_GAP_STATES);
export type TestGapState = z.infer<typeof testGapStateSchema>;

/** The states planning can reach. A bind never goes past `Planned`. */
export const TEST_GAP_PLANNING_STATES: readonly TestGapState[] = [
  "Open",
  "Planned",
];

/** A bind lifts `Open` to `Planned` and leaves every other state alone. */
export function stateAfterBind(state: TestGapState): TestGapState {
  return state === "Open" ? "Planned" : state;
}

/** Removing the last bind of a `Planned` Gap returns it to `Open`. */
export function stateAfterUnbind(
  state: TestGapState,
  remainingBinds: number,
): TestGapState {
  return state === "Planned" && remainingBinds === 0 ? "Open" : state;
}

/** The two closures. Both are the founder's explicit choice; neither deletes the Gap. */
export const TEST_GAP_CLOSURE_OUTCOMES = [
  "Met by result",
  "Not needed",
] as const;
export const testGapClosureOutcomeSchema = z.enum(TEST_GAP_CLOSURE_OUTCOMES);
export type TestGapClosureOutcome = z.infer<typeof testGapClosureOutcomeSchema>;

export const TEST_GAP_SESSION_TEST_MAX = 100;

const optionalText = z
  .string()
  .trim()
  .max(
    TEST_GAP_TEXT_MAX,
    `Rationale must be ${TEST_GAP_TEXT_MAX} characters or fewer.`,
  )
  .nullish()
  .transform((value) => (value ? value : null));

const closeBase = {
  /** The state the founder saw, so a concurrent move is refused. */
  expectedState: z.enum(["Open", "Planned"]),
  gapId: identifierSchema,
  projectId: identifierSchema,
};

/**
 * Closing a Gap. `Met by result` needs the exact Session Tests the founder
 * selected (at least one, each once) and takes an optional rationale;
 * `Not needed` needs a rationale and may keep a related Decision. There is no
 * way to close from a count, a ratio or a bind: the selected Session Tests are
 * the whole of the closure.
 */
export const closeTestGapInputSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      ...closeBase,
      outcome: z.literal("Met by result"),
      rationale: optionalText,
      sessionTestIds: z
        .array(identifierSchema)
        .min(1, "Select at least one Session Test that meets this Test Gap.")
        .max(
          TEST_GAP_SESSION_TEST_MAX,
          `Select at most ${TEST_GAP_SESSION_TEST_MAX} Session Tests.`,
        )
        .refine((ids) => new Set(ids).size === ids.length, {
          message: "Each Session Test can be selected once.",
        }),
    })
    .strict(),
  z
    .object({
      ...closeBase,
      decisionId: identifierSchema
        .nullish()
        .transform((value) => value ?? null),
      outcome: z.literal("Not needed"),
      rationale: requiredText("Rationale", TEST_GAP_TEXT_MAX),
    })
    .strict(),
]);
export type CloseTestGapInput = z.input<typeof closeTestGapInputSchema>;
export type ParsedCloseTestGapInput = z.output<typeof closeTestGapInputSchema>;

export const testGapDecisionTargetsInputSchema = testGapProjectInputSchema;

export interface TestGapStoredClosure {
  closedAt: string;
  decisionId: string | null;
  outcome: TestGapClosureOutcome;
  rationale: string | null;
  /** Selected Session Tests in the order the founder picked them. */
  sessionTests: { sessionTestId: string; title: string }[];
}

export interface TestGapClosureView {
  closedAt: string;
  decision: {
    brokenReason: BrokenReferenceReason | null;
    id: string;
    label: string | null;
    state: "broken" | "resolved";
  } | null;
  outcome: TestGapClosureOutcome;
  rationale: string | null;
  sessionTests: { id: string; title: string }[];
}

export interface TestGapDecisionTarget {
  label: string;
  targetId: string;
}

/** Exact Planned Test Case version a Gap is planned against. Never "latest". */
export const testGapCaseBindInputSchema = z
  .object({
    caseId: identifierSchema,
    gapId: identifierSchema,
    projectId: identifierSchema,
    version: z.number().int().min(1).safe(),
  })
  .strict();
export type TestGapCaseBindInput = z.input<typeof testGapCaseBindInputSchema>;

export const testGapHandoffBindInputSchema = z
  .object({
    gapId: identifierSchema,
    handoffId: identifierSchema,
    projectId: identifierSchema,
  })
  .strict();
export type TestGapHandoffBindInput = z.input<
  typeof testGapHandoffBindInputSchema
>;

export interface TestGapStoredCaseBind {
  caseId: string;
  title: string;
  version: number;
}

export interface TestGapStoredHandoffBind {
  handoffId: string;
  /** The Handoff process state, shown as is: it never moves the Gap. */
  handoffState: string;
  title: string;
}

export interface TestGapStoredRelation {
  documentRevision: number | null;
  id: string;
  sectionId: string | null;
  targetId: string;
  targetType: TestGapRelationTargetType;
}

export interface TestGapStoredRecord {
  caseBinds: TestGapStoredCaseBind[];
  closure: TestGapStoredClosure | null;
  createdAt: string;
  handoffBinds: TestGapStoredHandoffBind[];
  id: string;
  projectId: string;
  rationale: string;
  relations: TestGapStoredRelation[];
  state: TestGapState;
  stateChangedAt: string;
  title: string;
  updatedAt: string;
}

export interface TestGapRelationView {
  brokenReason: BrokenReferenceReason | null;
  documentRevision: number | null;
  id: string;
  label: string | null;
  sectionId: string | null;
  sectionLabel: string | null;
  state: "broken" | "resolved";
  targetId: string;
  targetType: TestGapRelationTargetType;
}

export const testGapRelationViewSchema = z
  .object({
    brokenReason: brokenReferenceReasonSchema.nullable(),
    documentRevision: z.number().int().nonnegative().nullable(),
    id: identifierSchema,
    label: z.string().nullable(),
    sectionId: z.string().nullable(),
    sectionLabel: z.string().nullable(),
    state: z.enum(["resolved", "broken"]),
    targetId: identifierSchema,
    targetType: testGapRelationTargetTypeSchema,
  })
  .strict();

export interface TestGapRecord {
  caseBinds: TestGapStoredCaseBind[];
  closure: TestGapClosureView | null;
  createdAt: string;
  handoffBinds: TestGapStoredHandoffBind[];
  id: string;
  projectId: string;
  rationale: string;
  relations: TestGapRelationView[];
  state: TestGapState;
  stateChangedAt: string;
  title: string;
  updatedAt: string;
}

export interface TestGapList {
  gaps: TestGapRecord[];
  readOnly: boolean;
}

export interface TestGapRelationTarget {
  /** Current revision; present for a Document, which relates by exact revision. */
  documentRevision: number | null;
  label: string;
  /** Stable sections of the current revision; present for a Document. */
  sections: { id: string; label: string }[];
  targetId: string;
  targetType: TestGapRelationTargetType;
}

export type TestGapTargetLive =
  | { label: string; sectionLabel: string | null; state: "resolved" }
  | { reason: BrokenReferenceReason; state: "broken" };

/**
 * Live resolvers of the support families' owner records, scoped to one account
 * and Project. `bind` returns `null` for anything that is not an existing,
 * active record of this Project, so a title-only or placeholder relation can
 * never be saved. `read` reports an existing relation against the owner's
 * current state and names a gone target as broken, never as another record.
 */
export interface TestGapTargetResolver {
  bind: (
    relation: TestGapRelationInput,
  ) => Promise<{ label: string; sectionLabel: string | null } | null>;
  /** The Decision a `Not needed` closure keeps, or `null` when it is not in this Project. */
  bindDecision: (decisionId: string) => Promise<string | null>;
  candidates: (
    targetType: TestGapRelationTargetType,
  ) => Promise<TestGapRelationTarget[]>;
  decisionCandidates: () => Promise<TestGapDecisionTarget[]>;
  read: (relation: TestGapStoredRelation) => Promise<TestGapTargetLive>;
  readDecision: (decisionId: string) => Promise<TestGapTargetLive>;
}

export interface TestGapCaseRef {
  caseId: string;
  version: number;
}

/** One Project-scoped unit of work. */
export interface TestGapTransaction {
  /** Resolves `false` when the bind already exists. */
  addCaseBind: (gapId: string, ref: TestGapCaseRef) => Promise<boolean>;
  /** Resolves `false` when the bind already exists. */
  addHandoffBind: (gapId: string, handoffId: string) => Promise<boolean>;
  /**
   * Closes the Gap only while it is still in `expected` (`Open` or `Planned`),
   * writing the state, the closure and the selected Session Tests together.
   * Resolves `false` otherwise, so a concurrent move is refused.
   */
  closeGap: (
    gapId: string,
    expected: TestGapState,
    to: TestGapClosureOutcome,
    closure: TestGapStoredClosure,
  ) => Promise<boolean>;
  /** The exact Planned Test Case version row, or `null` when it is not in this Project. */
  findCaseVersion: (ref: TestGapCaseRef) => Promise<{ title: string } | null>;
  /** When `lock` is true the Gap row is held until the unit of work ends. */
  findGap: (
    gapId: string,
    lock: boolean,
  ) => Promise<TestGapStoredRecord | null>;
  /** The Handoff of this Project, or `null`. */
  findHandoff: (
    handoffId: string,
  ) => Promise<{ handoffState: string; title: string } | null>;
  /** The Session Tests of this Project among `ids`, with their titles. */
  findSessionTests: (
    ids: readonly string[],
  ) => Promise<{ id: string; title: string }[]>;
  insertGap: (record: TestGapStoredRecord) => Promise<void>;
  listGaps: () => Promise<TestGapStoredRecord[]>;
  /** True for an archived Project, which stays readable but takes no writes. */
  readOnly: boolean;
  /** Resolves `false` when there was no such bind. */
  removeCaseBind: (gapId: string, ref: TestGapCaseRef) => Promise<boolean>;
  /** Resolves `false` when there was no such bind. */
  removeHandoffBind: (gapId: string, handoffId: string) => Promise<boolean>;
  resolver: TestGapTargetResolver;
  /**
   * Moves the Gap only while it is still in `expected`. Resolves `false`
   * otherwise, so a concurrent move is refused rather than overwritten.
   */
  setGapState: (
    gapId: string,
    expected: TestGapState,
    to: TestGapState,
    changedAt: string,
  ) => Promise<boolean>;
}

export interface TestGapStore {
  /** Resolves to `null` when the account does not own the Project. */
  run: <T>(
    accountId: string,
    projectId: string,
    mode: "read" | "write",
    work: (transaction: TestGapTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

export interface TestGapsAccess {
  /** Plans a Gap against one exact Planned Test Case version: at most `Planned`. */
  bindCase: (
    accountId: string,
    input: TestGapCaseBindInput,
  ) => Promise<TestGapRecord>;
  /** Plans a Gap against a Test Handoff: at most `Planned`. */
  bindHandoff: (
    accountId: string,
    input: TestGapHandoffBindInput,
  ) => Promise<TestGapRecord>;
  /**
   * Closes a Gap by the founder's explicit choice: `Met by result` with the
   * selected Session Tests, or `Not needed` with a rationale. Never deletes.
   */
  close: (
    accountId: string,
    input: CloseTestGapInput,
  ) => Promise<TestGapRecord>;
  /** Files a Test Gap by hand. The only way a Gap comes to exist. */
  create: (
    accountId: string,
    input: CreateTestGapInput,
  ) => Promise<TestGapRecord>;
  /** Decisions a `Not needed` closure can keep. */
  decisionTargets: (
    accountId: string,
    projectId: string,
  ) => Promise<TestGapDecisionTarget[]>;
  list: (accountId: string, projectId: string) => Promise<TestGapList>;
  /** Selectable support records, by family. */
  relationTargets: (
    accountId: string,
    input: TestGapRelationTargetsInput,
  ) => Promise<TestGapRelationTarget[]>;
  unbindCase: (
    accountId: string,
    input: TestGapCaseBindInput,
  ) => Promise<TestGapRecord>;
  unbindHandoff: (
    accountId: string,
    input: TestGapHandoffBindInput,
  ) => Promise<TestGapRecord>;
}

export function testGapRelationKey(
  relation: Pick<
    TestGapStoredRelation,
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

export function testGapRelationInputKey(relation: TestGapRelationInput) {
  return testGapRelationKey({
    documentRevision:
      "documentRevision" in relation ? relation.documentRevision : null,
    sectionId: "sectionId" in relation ? (relation.sectionId ?? null) : null,
    targetId: relation.targetId,
    targetType: relation.targetType,
  });
}

/** The first repeated relation, or `null`. Repeats are refused, not merged. */
export function duplicateTestGapRelation(
  relations: readonly TestGapRelationInput[],
) {
  const seen = new Set<string>();
  for (const relation of relations) {
    const key = testGapRelationInputKey(relation);
    if (seen.has(key)) {
      return relation;
    }
    seen.add(key);
  }
  return null;
}
