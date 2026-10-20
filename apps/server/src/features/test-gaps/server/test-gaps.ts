import {
  createTestGapInputSchema,
  duplicateTestGapRelation,
  stateAfterBind,
  stateAfterUnbind,
  type TestGapRecord,
  type TestGapRelationInput,
  type TestGapStore,
  type TestGapStoredRecord,
  type TestGapStoredRelation,
  type TestGapsAccess,
  type TestGapTargetResolver,
  type TestGapTransaction,
  testGapCaseBindInputSchema,
  testGapHandoffBindInputSchema,
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

export class TestGapNotFoundError extends Error {
  readonly code = "TEST_GAP_NOT_FOUND" as const;

  constructor(gapId: string) {
    super(`Test Gap ${gapId} was not found.`);
    this.name = "TestGapNotFoundError";
  }
}

/** The bind names no exact Planned Test Case version of this Project. */
export class TestGapCaseVersionNotFoundError extends Error {
  readonly code = "TEST_GAP_CASE_VERSION_NOT_FOUND" as const;

  constructor(caseId: string, version: number) {
    super(`Planned Test Case ${caseId} has no version ${version}.`);
    this.name = "TestGapCaseVersionNotFoundError";
  }
}

export class TestGapHandoffNotFoundError extends Error {
  readonly code = "TEST_GAP_HANDOFF_NOT_FOUND" as const;

  constructor(handoffId: string) {
    super(`Test Handoff ${handoffId} was not found.`);
    this.name = "TestGapHandoffNotFoundError";
  }
}

/** The Gap moved while the founder acted on the state they saw. */
export class TestGapStateConflictError extends Error {
  readonly code = "TEST_GAP_STATE_CONFLICT" as const;

  constructor(gapId: string) {
    super(`Test Gap ${gapId} changed since it was loaded.`);
    this.name = "TestGapStateConflictError";
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
    caseBinds: stored.caseBinds,
    createdAt: stored.createdAt,
    handoffBinds: stored.handoffBinds,
    id: stored.id,
    projectId: stored.projectId,
    rationale: stored.rationale,
    relations,
    state: stored.state,
    stateChangedAt: stored.stateChangedAt,
    title: stored.title,
    updatedAt: stored.updatedAt,
  };
}

async function requireGap(
  transaction: TestGapTransaction,
  gapId: string,
  lock: boolean,
) {
  const stored = await transaction.findGap(gapId, lock);
  if (!stored) {
    throw new TestGapNotFoundError(gapId);
  }
  return stored;
}

/**
 * Applies a planning change to a Gap and settles its state. A bind lifts
 * `Open` to `Planned` and nothing else; removing the last bind of a `Planned`
 * Gap returns it to `Open`. A closed Gap keeps its state and its closure.
 */
async function planGap(
  store: TestGapStore,
  accountId: string,
  projectId: string,
  gapId: string,
  change: (
    transaction: TestGapTransaction,
    gap: TestGapStoredRecord,
  ) => Promise<"bound" | "unbound" | "unchanged">,
) {
  const planned = await store.run(
    accountId,
    projectId,
    "write",
    async (transaction) => {
      if (transaction.readOnly) {
        throw new TestGapProjectReadOnlyError(projectId);
      }
      const before = await requireGap(transaction, gapId, true);
      const outcome = await change(transaction, before);
      if (outcome === "unchanged") {
        return await toGapRecord(transaction.resolver, before);
      }
      const after = await requireGap(transaction, gapId, true);
      const next =
        outcome === "bound"
          ? stateAfterBind(after.state)
          : stateAfterUnbind(
              after.state,
              after.caseBinds.length + after.handoffBinds.length,
            );
      if (next === after.state) {
        return await toGapRecord(transaction.resolver, after);
      }
      const changedAt = new Date().toISOString();
      if (
        !(await transaction.setGapState(gapId, after.state, next, changedAt))
      ) {
        throw new TestGapStateConflictError(gapId);
      }
      return await toGapRecord(transaction.resolver, {
        ...after,
        state: next,
        stateChangedAt: changedAt,
      });
    },
  );
  if (!planned) {
    throw new TestGapProjectNotFoundError(projectId);
  }
  return planned;
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
    async bindCase(accountId, rawInput) {
      const input = testGapCaseBindInputSchema.parse(rawInput);
      return await planGap(
        store,
        accountId,
        input.projectId,
        input.gapId,
        async (transaction) => {
          const ref = { caseId: input.caseId, version: input.version };
          if (!(await transaction.findCaseVersion(ref))) {
            throw new TestGapCaseVersionNotFoundError(
              input.caseId,
              input.version,
            );
          }
          return (await transaction.addCaseBind(input.gapId, ref))
            ? "bound"
            : "unchanged";
        },
      );
    },

    async bindHandoff(accountId, rawInput) {
      const input = testGapHandoffBindInputSchema.parse(rawInput);
      return await planGap(
        store,
        accountId,
        input.projectId,
        input.gapId,
        async (transaction) => {
          if (!(await transaction.findHandoff(input.handoffId))) {
            throw new TestGapHandoffNotFoundError(input.handoffId);
          }
          return (await transaction.addHandoffBind(
            input.gapId,
            input.handoffId,
          ))
            ? "bound"
            : "unchanged";
        },
      );
    },

    async unbindCase(accountId, rawInput) {
      const input = testGapCaseBindInputSchema.parse(rawInput);
      return await planGap(
        store,
        accountId,
        input.projectId,
        input.gapId,
        async (transaction) =>
          (await transaction.removeCaseBind(input.gapId, {
            caseId: input.caseId,
            version: input.version,
          }))
            ? "unbound"
            : "unchanged",
      );
    },

    async unbindHandoff(accountId, rawInput) {
      const input = testGapHandoffBindInputSchema.parse(rawInput);
      return await planGap(
        store,
        accountId,
        input.projectId,
        input.gapId,
        async (transaction) =>
          (await transaction.removeHandoffBind(input.gapId, input.handoffId))
            ? "unbound"
            : "unchanged",
      );
    },

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
            caseBinds: [],
            createdAt: now,
            handoffBinds: [],
            id: crypto.randomUUID(),
            projectId: input.projectId,
            rationale: input.rationale,
            relations: await bindRelations(
              transaction.resolver,
              input.relations,
            ),
            state: "Open",
            stateChangedAt: now,
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
