// biome-ignore-all lint/performance/noAwaitInLoops: Each snapshot resolves its own live label and context events in order.
import {
  type RecordTestAssessmentInput,
  recordTestAssessmentInputSchema,
  type TestAssessmentContext,
  type TestAssessmentRecord,
  type TestAssessmentStore,
  type TestAssessmentStoredRecord,
  type TestAssessmentsAccess,
  testAssessmentContextTargetsInputSchema,
  testAssessmentProjectInputSchema,
  toTestAssessmentRecord,
} from "@cantiara/api/test-assessments";

export class TestAssessmentProjectNotFoundError extends Error {
  readonly code = "TEST_ASSESSMENT_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "TestAssessmentProjectNotFoundError";
  }
}

export class TestAssessmentProjectReadOnlyError extends Error {
  readonly code = "TEST_ASSESSMENT_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "TestAssessmentProjectReadOnlyError";
  }
}

/** The chosen Feature, Handoff or Project Release is not a record of this Project. */
export class TestAssessmentContextUnavailableError extends Error {
  readonly code = "TEST_ASSESSMENT_CONTEXT_UNAVAILABLE" as const;

  constructor(context: TestAssessmentContext) {
    super(`${context.kind} ${context.targetId} is not available.`);
    this.name = "TestAssessmentContextUnavailableError";
  }
}

/** A cited id an owner record disproves. Names ids only, never a value. */
export class TestAssessmentSourceUnavailableError extends Error {
  readonly code = "TEST_ASSESSMENT_SOURCE_UNAVAILABLE" as const;

  readonly sourceIds: string[];

  constructor(sourceIds: string[]) {
    super(`Cited records are not available: ${sourceIds.join(", ")}.`);
    this.name = "TestAssessmentSourceUnavailableError";
    this.sourceIds = sourceIds;
  }
}

export function createTestAssessments(
  store: TestAssessmentStore,
): TestAssessmentsAccess {
  return {
    async contextTargets(accountId, rawInput) {
      const input = testAssessmentContextTargetsInputSchema.parse(rawInput);
      const candidates = await store.run(
        accountId,
        input.projectId,
        "read",
        (transaction) => transaction.contextCandidates(input.kind),
      );
      if (!candidates) {
        throw new TestAssessmentProjectNotFoundError(input.projectId);
      }
      return candidates;
    },

    async list(accountId, rawProjectId) {
      const { projectId } = testAssessmentProjectInputSchema.parse({
        projectId: rawProjectId,
      });
      const assessments = await store.run(
        accountId,
        projectId,
        "read",
        async (transaction) => {
          const stored = await transaction.list();
          const records: TestAssessmentRecord[] = [];
          for (const item of sortNewestFirst(stored)) {
            records.push(
              toTestAssessmentRecord(
                item,
                await transaction.contextLabel(item.context),
                await transaction.contextEvents(item.context),
              ),
            );
          }
          return records;
        },
      );
      if (!assessments) {
        throw new TestAssessmentProjectNotFoundError(projectId);
      }
      return { assessments };
    },

    async record(accountId, rawInput: RecordTestAssessmentInput) {
      const input = recordTestAssessmentInputSchema.parse(rawInput);
      const saved = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new TestAssessmentProjectReadOnlyError(input.projectId);
          }
          const label = await transaction.contextLabel(input.context);
          if (label === null) {
            throw new TestAssessmentContextUnavailableError(input.context);
          }
          const unknown = [
            ...(await transaction.unknownSources(
              "Test Session",
              input.sessionIds,
            )),
            ...(await transaction.unknownSources("Test Gap", input.gapIds)),
            ...(await transaction.unknownSources(
              "Follow-up Work",
              input.followUpWorkIds,
            )),
          ];
          if (unknown.length > 0) {
            throw new TestAssessmentSourceUnavailableError(unknown);
          }
          const stored: TestAssessmentStoredRecord = {
            assessedAt: new Date().toISOString(),
            assessorAccountId: accountId,
            context: input.context,
            decision: input.decision,
            followUpWorkIds: input.followUpWorkIds,
            gapIds: input.gapIds,
            id: crypto.randomUUID(),
            knownLimits: input.knownLimits,
            projectId: input.projectId,
            sessionIds: input.sessionIds,
          };
          await transaction.insert(stored);
          return toTestAssessmentRecord(stored, label);
        },
      );
      if (!saved) {
        throw new TestAssessmentProjectNotFoundError(input.projectId);
      }
      return saved;
    },
  };
}

function sortNewestFirst(records: TestAssessmentStoredRecord[]) {
  return [...records].sort(
    (a, b) =>
      b.assessedAt.localeCompare(a.assessedAt) || b.id.localeCompare(a.id),
  );
}
