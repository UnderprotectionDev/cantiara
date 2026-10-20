import { z } from "zod";

/**
 * Test Assessments seam (spec 56).
 *
 * A Test Assessment (Test değerlendirmesi) is an optional, dated snapshot of how
 * the founder read the test records of one Feature, Handoff or Project Release.
 * The contract names no score, coverage, readiness, gate, exception or
 * acceptance concept: the access is `list`, `record` and `contextTargets`, every
 * input is `.strict()` so none of those can be smuggled in, and there is no
 * update, reopen or carry-forward operation. Session, Gap and follow-up Work ids
 * are cited by id only; the snapshot never writes to their owner records.
 */

const identifierSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.string().datetime({ offset: true });

export const TEST_ASSESSMENT_LABEL = "Test Assessment";
export const TEST_ASSESSMENTS_SECTION_LABEL = "Recent Test Assessments";
export const TEST_ASSESSMENT_NEW_CONTEXT_LABEL =
  "New test context after this assessment";

export const TEST_ASSESSMENT_DECISIONS = [
  "Acceptable",
  "Follow-up needed",
  "Undecided",
] as const;
export type TestAssessmentDecision = (typeof TEST_ASSESSMENT_DECISIONS)[number];

export const TEST_ASSESSMENT_CONTEXT_KINDS = [
  "Feature",
  "Handoff",
  "Project Release",
] as const;
export type TestAssessmentContextKind =
  (typeof TEST_ASSESSMENT_CONTEXT_KINDS)[number];

export const TEST_ASSESSMENT_SOURCE_KINDS = [
  "Test Session",
  "Test Gap",
  "Follow-up Work",
] as const;
export type TestAssessmentSourceKind =
  (typeof TEST_ASSESSMENT_SOURCE_KINDS)[number];

export const TEST_ASSESSMENT_SOURCE_MAX = 200;
export const TEST_ASSESSMENT_CONTEXT_EVENT_KINDS = [
  "New result",
  "Corrected result",
  "New Test Gap",
  "Context change",
] as const;
export type TestAssessmentContextEventKind =
  (typeof TEST_ASSESSMENT_CONTEXT_EVENT_KINDS)[number];

export const TEST_ASSESSMENT_LIMITS_MAX = 10_000;

const decisionSchema = z.enum(TEST_ASSESSMENT_DECISIONS);
const contextKindSchema = z.enum(TEST_ASSESSMENT_CONTEXT_KINDS);

export const testAssessmentContextSchema = z
  .object({ kind: contextKindSchema, targetId: identifierSchema })
  .strict();
export type TestAssessmentContext = z.infer<typeof testAssessmentContextSchema>;

const sourceIdsSchema = z
  .array(identifierSchema)
  .max(TEST_ASSESSMENT_SOURCE_MAX)
  .default([])
  .transform((ids) => [...new Set(ids)]);

export const recordTestAssessmentInputSchema = z
  .object({
    context: testAssessmentContextSchema,
    decision: decisionSchema,
    followUpWorkIds: sourceIdsSchema,
    gapIds: sourceIdsSchema,
    knownLimits: z
      .string()
      .trim()
      .max(TEST_ASSESSMENT_LIMITS_MAX)
      .nullish()
      .transform((value) => (value ? value : null)),
    projectId: identifierSchema,
    sessionIds: sourceIdsSchema,
  })
  .strict();
export type RecordTestAssessmentInput = z.infer<
  typeof recordTestAssessmentInputSchema
>;

export const testAssessmentProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const testAssessmentContextTargetsInputSchema = z
  .object({ kind: contextKindSchema, projectId: identifierSchema })
  .strict();
export type TestAssessmentContextTargetsInput = z.infer<
  typeof testAssessmentContextTargetsInputSchema
>;

export interface TestAssessmentContextCandidate {
  id: string;
  kind: TestAssessmentContextKind;
  label: string;
}

/** Persisted snapshot. Nothing in it is ever updated after the insert. */
export interface TestAssessmentStoredRecord {
  assessedAt: string;
  assessorAccountId: string;
  context: TestAssessmentContext;
  decision: TestAssessmentDecision;
  followUpWorkIds: string[];
  gapIds: string[];
  id: string;
  knownLimits: string | null;
  projectId: string;
  sessionIds: string[];
}

/**
 * Recorded test context for the Assessment's own context. Owners (Test Session,
 * Test Gap, bound context) report the event; the Assessment never reads time or
 * repository activity to decide anything.
 */
export interface TestAssessmentContextEvent {
  kind: TestAssessmentContextEventKind;
  recordedAt: string;
  sourceId: string;
  sourceKind: TestAssessmentSourceKind | "Context";
}

export const testAssessmentNewContextSchema = z
  .object({
    sources: z.array(
      z
        .object({
          kind: z.enum(TEST_ASSESSMENT_CONTEXT_EVENT_KINDS),
          recordedAt: timestampSchema,
          sourceId: identifierSchema,
          sourceKind: z.enum([...TEST_ASSESSMENT_SOURCE_KINDS, "Context"]),
        })
        .strict(),
    ),
  })
  .strict();
export type TestAssessmentNewContext = z.infer<
  typeof testAssessmentNewContextSchema
>;

export const testAssessmentRecordSchema = z
  .object({
    assessedAt: timestampSchema,
    assessorAccountId: identifierSchema,
    context: testAssessmentContextSchema.extend({
      /** Live label; `null` when the context record is gone. */
      label: z.string().nullable(),
    }),
    decision: decisionSchema,
    followUpWorkIds: z.array(identifierSchema),
    gapIds: z.array(identifierSchema),
    id: identifierSchema,
    knownLimits: z.string().nullable(),
    /** Present only when recorded test context arrived after `assessedAt`. */
    newContext: testAssessmentNewContextSchema.nullable(),
    projectId: identifierSchema,
    sessionIds: z.array(identifierSchema),
  })
  .strict();
export type TestAssessmentRecord = z.infer<typeof testAssessmentRecordSchema>;

/** One selectable Feature, Handoff or Project Release context target. */
export const testAssessmentCandidateSchema = z
  .object({
    id: identifierSchema,
    kind: contextKindSchema,
    label: z.string(),
  })
  .strict();

export const testAssessmentListOutputSchema = z
  .object({
    assessments: z.array(testAssessmentRecordSchema),
  })
  .strict();

export const testAssessmentContextTargetsOutputSchema = z.array(
  testAssessmentCandidateSchema,
);

export function toTestAssessmentRecord(
  stored: TestAssessmentStoredRecord,
  contextLabel: string | null,
  events: TestAssessmentContextEvent[] = [],
): TestAssessmentRecord {
  const after = events
    .filter(
      (event) => Date.parse(event.recordedAt) > Date.parse(stored.assessedAt),
    )
    .sort(
      (a, b) =>
        a.recordedAt.localeCompare(b.recordedAt) ||
        a.sourceId.localeCompare(b.sourceId),
    );
  return {
    assessedAt: stored.assessedAt,
    assessorAccountId: stored.assessorAccountId,
    context: { ...stored.context, label: contextLabel },
    decision: stored.decision,
    followUpWorkIds: [...stored.followUpWorkIds],
    gapIds: [...stored.gapIds],
    id: stored.id,
    knownLimits: stored.knownLimits,
    newContext:
      after.length > 0 ? { sources: after.map((e) => ({ ...e })) } : null,
    projectId: stored.projectId,
    sessionIds: [...stored.sessionIds],
  };
}

export interface TestAssessmentTransaction {
  contextCandidates: (
    kind: TestAssessmentContextKind,
  ) => Promise<TestAssessmentContextCandidate[]>;
  /**
   * Recorded test context for this Assessment's context. Reading it never
   * writes: the snapshot bytes stay as saved.
   */
  contextEvents: (
    context: TestAssessmentContext,
  ) => Promise<TestAssessmentContextEvent[]>;
  /** Live label of the context record, `null` when it is not in this Project. */
  contextLabel: (context: TestAssessmentContext) => Promise<string | null>;
  insert: (record: TestAssessmentStoredRecord) => Promise<void>;
  list: () => Promise<TestAssessmentStoredRecord[]>;
  readOnly: boolean;
  /**
   * Cited ids that an owner record can disprove (follow-up Work). Test Session
   * and Test Gap owners arrive with specs 54 and 55; their ids stay opaque
   * until then.
   */
  unknownSources: (
    kind: TestAssessmentSourceKind,
    ids: string[],
  ) => Promise<string[]>;
}

export interface TestAssessmentStore {
  /** Resolves to `null` when the account does not own the Project. */
  run: <T>(
    accountId: string,
    projectId: string,
    mode: "read" | "write",
    work: (transaction: TestAssessmentTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

export interface TestAssessmentsAccess {
  contextTargets: (
    accountId: string,
    input: TestAssessmentContextTargetsInput,
  ) => Promise<TestAssessmentContextCandidate[]>;
  /** Newest first. */
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<{ assessments: TestAssessmentRecord[] }>;
  record: (
    accountId: string,
    input: RecordTestAssessmentInput,
  ) => Promise<TestAssessmentRecord>;
}
