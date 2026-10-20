import {
  createPlannedTestCaseInputSchema,
  createPlannedTestCaseVersionInputSchema,
  duplicatePlannedTestRelation,
  isSamePlannedTestContent,
  type PlannedTestCaseRecord,
  type PlannedTestCaseVersionRecord,
  type PlannedTestRelationInput,
  type PlannedTestStore,
  type PlannedTestStoredCase,
  type PlannedTestStoredRelation,
  type PlannedTestStoredVersion,
  type PlannedTestsAccess,
  type PlannedTestTargetResolver,
  plannedTestCaseProjectInputSchema,
  plannedTestCaseVersionInputSchema,
  plannedTestRelationTargetsInputSchema,
  relationKey,
} from "@cantiara/api/planned-tests";

export class PlannedTestProjectNotFoundError extends Error {
  readonly code = "PLANNED_TEST_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "PlannedTestProjectNotFoundError";
  }
}

export class PlannedTestCaseNotFoundError extends Error {
  readonly code = "PLANNED_TEST_CASE_NOT_FOUND" as const;

  constructor(caseId: string) {
    super(`Planned Test Case ${caseId} was not found.`);
    this.name = "PlannedTestCaseNotFoundError";
  }
}

export class PlannedTestVersionNotFoundError extends Error {
  readonly code = "PLANNED_TEST_VERSION_NOT_FOUND" as const;

  constructor(caseId: string, version: number) {
    super(`Planned Test Case ${caseId} has no version ${version}.`);
    this.name = "PlannedTestVersionNotFoundError";
  }
}

/** The version the founder edited from is no longer the head. */
export class PlannedTestVersionConflictError extends Error {
  readonly code = "PLANNED_TEST_VERSION_CONFLICT" as const;

  constructor(caseId: string) {
    super(`Planned Test Case ${caseId} changed since it was loaded.`);
    this.name = "PlannedTestVersionConflictError";
  }
}

/** A version needs a difference; an identical save would only add noise. */
export class PlannedTestNoChangeError extends Error {
  readonly code = "PLANNED_TEST_NO_CHANGE" as const;

  constructor(caseId: string) {
    super(`Nothing changed in Planned Test Case ${caseId}.`);
    this.name = "PlannedTestNoChangeError";
  }
}

export class PlannedTestProjectReadOnlyError extends Error {
  readonly code = "PLANNED_TEST_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "PlannedTestProjectReadOnlyError";
  }
}

/** The relation names no existing, active record of this Project (or repeats one). */
export class PlannedTestRelationTargetError extends Error {
  readonly code = "PLANNED_TEST_RELATION_TARGET_UNAVAILABLE" as const;

  constructor(
    relation: Pick<PlannedTestRelationInput, "targetType" | "targetId">,
  ) {
    super(
      `${relation.targetType} ${relation.targetId} is not an available relation target.`,
    );
    this.name = "PlannedTestRelationTargetError";
  }
}

async function toVersionRecord(
  resolver: PlannedTestTargetResolver,
  version: PlannedTestStoredVersion,
): Promise<PlannedTestCaseVersionRecord> {
  const relations = await Promise.all(
    version.relations.map(async (relation) => {
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
    caseId: version.caseId,
    changeKind: version.changeKind,
    createdAt: version.createdAt,
    expectedBehavior: version.expectedBehavior,
    id: version.id,
    notes: version.notes,
    preconditions: version.preconditions,
    purpose: version.purpose,
    relations,
    scope: version.scope,
    title: version.title,
    version: version.version,
  };
}

async function toCaseRecord(
  resolver: PlannedTestTargetResolver,
  stored: PlannedTestStoredCase,
): Promise<PlannedTestCaseRecord> {
  const versions = await Promise.all(
    stored.versions.map((version) => toVersionRecord(resolver, version)),
  );
  const current = versions.find(
    (version) => version.version === stored.currentVersion,
  );
  if (!current) {
    throw new Error(`Planned Test Case ${stored.id} lost its head version.`);
  }
  return {
    createdAt: stored.createdAt,
    current,
    id: stored.id,
    projectId: stored.projectId,
    updatedAt: stored.updatedAt,
    versions,
  };
}

function relationInputKey(relation: PlannedTestRelationInput) {
  return relationKey({
    documentRevision:
      "documentRevision" in relation ? relation.documentRevision : null,
    sectionId: "sectionId" in relation ? (relation.sectionId ?? null) : null,
    targetId: relation.targetId,
    targetType: relation.targetType,
  });
}

/**
 * Binds relations for a new version. A relation the previous version already
 * held is carried over as is, so a target that has since gone away cannot make
 * the rest of the case uneditable; every other relation must resolve live.
 */
async function bindRelations(
  resolver: PlannedTestTargetResolver,
  relations: readonly PlannedTestRelationInput[],
  carried: readonly PlannedTestStoredRelation[],
): Promise<PlannedTestStoredRelation[]> {
  const duplicate = duplicatePlannedTestRelation(relations);
  if (duplicate) {
    throw new PlannedTestRelationTargetError(duplicate);
  }
  const carriedKeys = new Set(carried.map(relationKey));
  return await Promise.all(
    relations.map(async (relation) => {
      if (!carriedKeys.has(relationInputKey(relation))) {
        const bound = await resolver.bind(relation);
        if (!bound) {
          throw new PlannedTestRelationTargetError(relation);
        }
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
 * Planned Tests and Handoff seam, case half. A Planned Test Case is versioned
 * intent: the only writes are `create` (version 1) and `createVersion`, which
 * appends a full immutable version. There is no run, result, status or step
 * operation, and `version` reads one exact version, never "latest".
 */
export function createPlannedTests(
  store: PlannedTestStore,
): PlannedTestsAccess {
  return {
    async create(accountId, rawInput) {
      const input = createPlannedTestCaseInputSchema.parse(rawInput);
      const created = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const now = new Date().toISOString();
          const caseId = crypto.randomUUID();
          const relations = await bindRelations(
            transaction.resolver,
            input.relations,
            [],
          );
          const stored: PlannedTestStoredCase = {
            createdAt: now,
            currentVersion: 1,
            id: caseId,
            projectId: input.projectId,
            updatedAt: now,
            versions: [
              {
                caseId,
                changeKind: "Initial version",
                createdAt: now,
                expectedBehavior: input.expectedBehavior,
                id: crypto.randomUUID(),
                notes: input.notes,
                preconditions: input.preconditions,
                purpose: input.purpose,
                relations,
                scope: input.scope,
                title: input.title,
                version: 1,
              },
            ],
          };
          await transaction.insertCase(stored);
          return await toCaseRecord(transaction.resolver, stored);
        },
      );
      if (!created) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return created;
    },

    async createVersion(accountId, rawInput) {
      const input = createPlannedTestCaseVersionInputSchema.parse(rawInput);
      const saved = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const current = await transaction.findCase(input.caseId, true);
          if (!current) {
            throw new PlannedTestCaseNotFoundError(input.caseId);
          }
          if (input.expectedVersion !== current.currentVersion) {
            throw new PlannedTestVersionConflictError(current.id);
          }
          const head = current.versions.find(
            ({ version }) => version === current.currentVersion,
          );
          if (!head) {
            throw new Error(`Planned Test Case ${current.id} has no head.`);
          }
          const relations = await bindRelations(
            transaction.resolver,
            input.relations,
            head.relations,
          );
          const next: PlannedTestStoredVersion = {
            caseId: current.id,
            changeKind: input.changeKind,
            createdAt: new Date().toISOString(),
            expectedBehavior: input.expectedBehavior,
            id: crypto.randomUUID(),
            notes: input.notes,
            preconditions: input.preconditions,
            purpose: input.purpose,
            relations,
            scope: input.scope,
            title: input.title,
            version: current.currentVersion + 1,
          };
          if (isSamePlannedTestContent(head, next)) {
            throw new PlannedTestNoChangeError(current.id);
          }
          await transaction.appendVersion(current.id, next, next.createdAt);
          return await toCaseRecord(transaction.resolver, {
            ...current,
            currentVersion: next.version,
            updatedAt: next.createdAt,
            versions: [...current.versions, next],
          });
        },
      );
      if (!saved) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return saved;
    },

    async list(accountId, projectId) {
      const parsed = plannedTestCaseProjectInputSchema.parse({ projectId });
      const listed = await store.run(
        accountId,
        parsed.projectId,
        "read",
        async (transaction) => {
          const stored = await transaction.listCases();
          const cases = await Promise.all(
            stored.map((record) => toCaseRecord(transaction.resolver, record)),
          );
          return { cases, readOnly: transaction.readOnly };
        },
      );
      if (!listed) {
        throw new PlannedTestProjectNotFoundError(parsed.projectId);
      }
      return listed;
    },

    async relationTargets(accountId, rawInput) {
      const input = plannedTestRelationTargetsInputSchema.parse(rawInput);
      const targets = await store.run(
        accountId,
        input.projectId,
        "read",
        (transaction) => transaction.resolver.candidates(input.targetType),
      );
      if (!targets) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return targets;
    },

    async version(accountId, rawInput) {
      const input = plannedTestCaseVersionInputSchema.parse(rawInput);
      const found = await store.run(
        accountId,
        input.projectId,
        "read",
        async (transaction) => {
          const record = await transaction.findCase(input.caseId, false);
          if (!record) {
            throw new PlannedTestCaseNotFoundError(input.caseId);
          }
          const version = record.versions.find(
            (item) => item.version === input.version,
          );
          if (!version) {
            throw new PlannedTestVersionNotFoundError(
              input.caseId,
              input.version,
            );
          }
          return await toVersionRecord(transaction.resolver, version);
        },
      );
      if (!found) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return found;
    },
  };
}
