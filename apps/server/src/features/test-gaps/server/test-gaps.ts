import {
  createTestGapInputSchema,
  duplicateTestGapRelation,
  type TestGapRecord,
  type TestGapRelationInput,
  type TestGapStore,
  type TestGapStoredRecord,
  type TestGapStoredRelation,
  type TestGapsAccess,
  type TestGapTargetResolver,
  testGapProjectInputSchema,
  testGapRelationTargetsInputSchema,
} from "@cantiara/api/test-gaps";

export class TestGapProjectNotFoundError extends Error {
  readonly code = "TEST_GAP_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "TestGapProjectNotFoundError";
  }
}

export class TestGapProjectReadOnlyError extends Error {
  readonly code = "TEST_GAP_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "TestGapProjectReadOnlyError";
  }
}

/** The relation names no existing, active record of this Project (or repeats one). */
export class TestGapRelationTargetError extends Error {
  readonly code = "TEST_GAP_RELATION_TARGET_UNAVAILABLE" as const;

  constructor(relation: Pick<TestGapRelationInput, "targetId" | "targetType">) {
    super(
      `${relation.targetType} ${relation.targetId} is not an available relation target.`,
    );
    this.name = "TestGapRelationTargetError";
  }
}

async function toGapRecord(
  resolver: TestGapTargetResolver,
  stored: TestGapStoredRecord,
): Promise<TestGapRecord> {
  const relations = await Promise.all(
    stored.relations.map(async (relation) => {
      const live = await resolver.read(relation);
      return {
        brokenReason: live.state === "broken" ? live.reason : null,
        documentRevision: relation.documentRevision,
        id: relation.id,
        label: live.state === "resolved" ? live.label : null,
        sectionId: relation.sectionId,
        sectionLabel: live.state === "resolved" ? live.sectionLabel : null,
        state: live.state,
        targetId: relation.targetId,
        targetType: relation.targetType,
      };
    }),
  );
  return {
    createdAt: stored.createdAt,
    id: stored.id,
    projectId: stored.projectId,
    rationale: stored.rationale,
    relations,
    title: stored.title,
    updatedAt: stored.updatedAt,
  };
}

/** Every relation must resolve live: a title or placeholder id is never saved. */
async function bindRelations(
  resolver: TestGapTargetResolver,
  relations: readonly TestGapRelationInput[],
): Promise<TestGapStoredRelation[]> {
  const duplicate = duplicateTestGapRelation(relations);
  if (duplicate) {
    throw new TestGapRelationTargetError(duplicate);
  }
  return await Promise.all(
    relations.map(async (relation) => {
      if (!(await resolver.bind(relation))) {
        throw new TestGapRelationTargetError(relation);
      }
      return {
        documentRevision:
          "documentRevision" in relation ? relation.documentRevision : null,
        id: crypto.randomUUID(),
        sectionId:
          "sectionId" in relation ? (relation.sectionId ?? null) : null,
        targetId: relation.targetId,
        targetType: relation.targetType,
      };
    }),
  );
}

/**
 * Test Gaps seam. A Test Gap exists only because the founder called `create`:
 * the module has no reader of Session Tests, reports, spec changes, checks or
 * similarity, so nothing can file a Gap on the founder's behalf. There is no
 * coverage, score or result operation.
 */
export function createTestGaps(store: TestGapStore): TestGapsAccess {
  return {
    async create(accountId, rawInput) {
      const input = createTestGapInputSchema.parse(rawInput);
      const created = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new TestGapProjectReadOnlyError(input.projectId);
          }
          const now = new Date().toISOString();
          const stored: TestGapStoredRecord = {
            createdAt: now,
            id: crypto.randomUUID(),
            projectId: input.projectId,
            rationale: input.rationale,
            relations: await bindRelations(
              transaction.resolver,
              input.relations,
            ),
            title: input.title,
            updatedAt: now,
          };
          await transaction.insertGap(stored);
          return await toGapRecord(transaction.resolver, stored);
        },
      );
      if (!created) {
        throw new TestGapProjectNotFoundError(input.projectId);
      }
      return created;
    },

    async list(accountId, rawProjectId) {
      const { projectId } = testGapProjectInputSchema.parse({
        projectId: rawProjectId,
      });
      const listed = await store.run(
        accountId,
        projectId,
        "read",
        async (transaction) => ({
          gaps: await Promise.all(
            (await transaction.listGaps()).map((stored) =>
              toGapRecord(transaction.resolver, stored),
            ),
          ),
          readOnly: transaction.readOnly,
        }),
      );
      if (!listed) {
        throw new TestGapProjectNotFoundError(projectId);
      }
      return listed;
    },

    async relationTargets(accountId, rawInput) {
      const input = testGapRelationTargetsInputSchema.parse(rawInput);
      const targets = await store.run(
        accountId,
        input.projectId,
        "read",
        (transaction) => transaction.resolver.candidates(input.targetType),
      );
      if (!targets) {
        throw new TestGapProjectNotFoundError(input.projectId);
      }
      return targets;
    },
  };
}
