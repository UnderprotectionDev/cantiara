import { createHash } from "node:crypto";

import {
  canTransitionTestHandoff,
  createPlannedTestCaseInputSchema,
  createPlannedTestCaseVersionInputSchema,
  createTestHandoffInputSchema,
  duplicatePlannedTestRelation,
  isSamePlannedTestContent,
  linkSessionTestInputSchema,
  linkTestHandoffSessionTestInputSchema,
  type PlannedTestCaseRecord,
  type PlannedTestCaseVersionRecord,
  type PlannedTestCaseVersionRef,
  type PlannedTestRelationInput,
  type PlannedTestStore,
  type PlannedTestStoredCase,
  type PlannedTestStoredRelation,
  type PlannedTestStoredVersion,
  type PlannedTestsAccess,
  type PlannedTestTargetResolver,
  type PlannedTestTransaction,
  plannedTestCaseProjectInputSchema,
  plannedTestCaseVersionInputSchema,
  plannedTestRelationTargetsInputSchema,
  produceTestHandoffPackageInputSchema,
  recordSessionTestInputSchema,
  relationKey,
  type SessionTestStoredRecord,
  sessionTestProjectInputSchema,
  TEST_HANDOFF_EDITABLE_STATES,
  TEST_HANDOFF_LABEL,
  TEST_HANDOFF_PACKAGE_EXCLUDED,
  TEST_HANDOFF_PACKAGE_STATES,
  type TestHandoffContextLive,
  type TestHandoffContextRef,
  type TestHandoffPackageBlocker,
  type TestHandoffPackagePreview,
  type TestHandoffPackageRecord,
  type TestHandoffPackageStored,
  type TestHandoffRecord,
  type TestHandoffState,
  type TestHandoffStoredRecord,
  testHandoffContextRefKey,
  testHandoffContextTargetsInputSchema,
  testHandoffPackageInputSchema,
  testHandoffProjectInputSchema,
  toSessionTestRecord,
  toTestHandoffRecord,
  transitionTestHandoffInputSchema,
  updateTestHandoffInputSchema,
} from "@cantiara/api/planned-tests";
import {
  buildTestHandoffPackage,
  renderTestHandoffPackageJson,
  renderTestHandoffPackageMarkdown,
  scanTestHandoffPackageForSecrets,
  type TestHandoffPackageJson,
  type TestHandoffPackageSource,
} from "@cantiara/api/test-handoff-package";

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

export class SessionTestNotFoundError extends Error {
  readonly code = "SESSION_TEST_NOT_FOUND" as const;

  constructor(sessionTestId: string) {
    super(`Session Test ${sessionTestId} was not found.`);
    this.name = "SessionTestNotFoundError";
  }
}

/** A bind is exact and final: it is never moved to another version or case. */
export class SessionTestAlreadyBoundError extends Error {
  readonly code = "SESSION_TEST_ALREADY_BOUND" as const;

  constructor(sessionTestId: string) {
    super(`Session Test ${sessionTestId} is already bound and cannot move.`);
    this.name = "SessionTestAlreadyBoundError";
  }
}

export class TestHandoffNotFoundError extends Error {
  readonly code = "TEST_HANDOFF_NOT_FOUND" as const;

  constructor(handoffId: string) {
    super(`Test Handoff ${handoffId} was not found.`);
    this.name = "TestHandoffNotFoundError";
  }
}

/** The move is not in the process table. */
export class TestHandoffTransitionError extends Error {
  readonly code = "TEST_HANDOFF_TRANSITION_NOT_ALLOWED" as const;

  constructor(from: TestHandoffState, to: TestHandoffState) {
    super(`A Test Handoff cannot move from ${from} to ${to}.`);
    this.name = "TestHandoffTransitionError";
  }
}

/** The founder acted on a state the Handoff is no longer in. */
export class TestHandoffStateConflictError extends Error {
  readonly code = "TEST_HANDOFF_STATE_CONFLICT" as const;

  constructor(handoffId: string) {
    super(`Test Handoff ${handoffId} changed since it was loaded.`);
    this.name = "TestHandoffStateConflictError";
  }
}

/** Shared and later Handoffs are history; their content is not rewritten. */
export class TestHandoffLockedError extends Error {
  readonly code = "TEST_HANDOFF_LOCKED" as const;

  constructor(handoffId: string) {
    super(`Test Handoff ${handoffId} is shared and its content is fixed.`);
    this.name = "TestHandoffLockedError";
  }
}

/** A bound Session Test names a version this Handoff did not select. */
export class TestHandoffScopeMismatchError extends Error {
  readonly code = "TEST_HANDOFF_SCOPE_MISMATCH" as const;

  constructor(sessionTestId: string, handoffId: string) {
    super(
      `Session Test ${sessionTestId} is bound to a version Test Handoff ${handoffId} did not select.`,
    );
    this.name = "TestHandoffScopeMismatchError";
  }
}

/** A Session Test arrives on one Handoff, once. */
export class SessionTestAlreadyInHandoffError extends Error {
  readonly code = "SESSION_TEST_ALREADY_IN_HANDOFF" as const;

  constructor(sessionTestId: string) {
    super(`Session Test ${sessionTestId} already arrived on a Test Handoff.`);
    this.name = "SessionTestAlreadyInHandoffError";
  }
}

/** A Draft, finished or canceled Handoff is not shareable, so it makes no package. */
export class TestHandoffPackageStateError extends Error {
  readonly code = "TEST_HANDOFF_PACKAGE_STATE" as const;

  constructor(state: TestHandoffState) {
    super(
      `A ${TEST_HANDOFF_LABEL} in ${state} cannot produce a package. Mark it Ready to share first.`,
    );
    this.name = "TestHandoffPackageStateError";
  }
}

/** Something in the package is unavailable or looks like a secret. */
export class TestHandoffPackageBlockedError extends Error {
  readonly code = "TEST_HANDOFF_PACKAGE_BLOCKED" as const;
  readonly blockers: TestHandoffPackageBlocker[];

  constructor(blockers: TestHandoffPackageBlocker[]) {
    super(
      `The package was not produced: ${blockers.map(({ message }) => message).join(" ")}`,
    );
    this.name = "TestHandoffPackageBlockedError";
    this.blockers = blockers;
  }
}

/** The previewed package version or content is no longer what would be produced. */
export class TestHandoffPackageStaleError extends Error {
  readonly code = "TEST_HANDOFF_PACKAGE_STALE" as const;

  constructor(handoffId: string) {
    super(
      `The package of ${TEST_HANDOFF_LABEL} ${handoffId} changed since the preview. Preview it again.`,
    );
    this.name = "TestHandoffPackageStaleError";
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

/** The case holding exactly this version, or the matching not-found refusal. */
async function requireExactVersion(
  transaction: PlannedTestTransaction,
  ref: PlannedTestCaseVersionRef,
): Promise<PlannedTestStoredCase> {
  const scenario = await transaction.findCase(ref.caseId, false);
  if (!scenario) {
    throw new PlannedTestCaseNotFoundError(ref.caseId);
  }
  if (!scenario.versions.some(({ version }) => version === ref.version)) {
    throw new PlannedTestVersionNotFoundError(ref.caseId, ref.version);
  }
  return scenario;
}

async function resolveContext(
  resolver: PlannedTestTargetResolver,
  refs: readonly TestHandoffContextRef[],
) {
  const entries = await Promise.all(
    refs.map(
      async (ref): Promise<[string, TestHandoffContextLive]> => [
        testHandoffContextRefKey(ref),
        await resolver.readContext(ref),
      ],
    ),
  );
  return new Map(entries);
}

/**
 * Every context record a Handoff selects must be an existing, active record of
 * this Project, pinned exactly. A record the Handoff already held is carried
 * over untouched, so one that later went away cannot make the rest uneditable.
 */
async function bindContextRefs(
  resolver: PlannedTestTargetResolver,
  refs: readonly TestHandoffContextRef[],
  carried: readonly TestHandoffContextRef[],
) {
  const carriedKeys = new Set(carried.map(testHandoffContextRefKey));
  await Promise.all(
    refs.map(async (ref) => {
      if (carriedKeys.has(testHandoffContextRefKey(ref))) {
        return;
      }
      if ((await resolver.bindContext(ref)) === null) {
        throw new PlannedTestRelationTargetError({
          targetId: ref.targetId,
          targetType: ref.kind === "Wireframe" ? "Screen" : ref.kind,
        });
      }
    }),
  );
}

const PACKAGE_INCLUDED_SECTIONS = [
  ["scenarios", (pkg: TestHandoffPackageJson) => pkg.scenarios.length],
  ["ad_hoc_scope", (pkg: TestHandoffPackageJson) => pkg.ad_hoc_scope.length],
  ["work_context", (pkg: TestHandoffPackageJson) => pkg.work_context.length],
  [
    "document_context",
    (pkg: TestHandoffPackageJson) => pkg.document_context.length,
  ],
  [
    "design_references",
    (pkg: TestHandoffPackageJson) => pkg.design_references.length,
  ],
] as const;

/** Content fingerprint: everything the founder previewed except the clock. */
function packageFingerprint(pkg: TestHandoffPackageJson) {
  return createHash("sha256")
    .update(JSON.stringify({ ...pkg, created_at: null }))
    .digest("hex");
}

interface CollectedPackage {
  blockers: TestHandoffPackageBlocker[];
  package: TestHandoffPackageJson | null;
}

const CONTEXT_SECTION: Record<TestHandoffContextRef["kind"], string> = {
  Document: "document_context",
  Feature: "work_context",
  Wireframe: "design_references",
  Work: "work_context",
};

/**
 * Builds the package of one Handoff from exact stored selections only. Case
 * content is read from the exact `(case_id, version)` row, never the head, and
 * every selected record must still resolve; an unavailable record or anything
 * that looks like a secret is a blocker and the package is not built.
 */
async function collectPackage(
  transaction: PlannedTestTransaction,
  handoff: TestHandoffStoredRecord,
  packageVersion: number,
  createdAt: string,
): Promise<CollectedPackage> {
  const blockers: TestHandoffPackageBlocker[] = [];
  if (!TEST_HANDOFF_PACKAGE_STATES.includes(handoff.state)) {
    blockers.push({
      kind: "state",
      message: new TestHandoffPackageStateError(handoff.state).message,
      path: null,
    });
    return { blockers, package: null };
  }
  const scenarios: TestHandoffPackageSource["scenarios"] = await Promise.all(
    handoff.scenarios.map(async (ref) => {
      const scenario = await requireExactVersion(transaction, ref);
      const version = scenario.versions.find(
        (item) => item.version === ref.version,
      );
      if (!version) {
        throw new PlannedTestVersionNotFoundError(ref.caseId, ref.version);
      }
      return {
        caseId: ref.caseId,
        expectedBehavior: version.expectedBehavior,
        notes: version.notes,
        preconditions: version.preconditions,
        purpose: version.purpose,
        scope: version.scope,
        title: version.title,
        version: version.version,
      };
    }),
  );
  const workContext: TestHandoffPackageSource["workContext"] = [];
  const documentContext: TestHandoffPackageSource["documentContext"] = [];
  const designReferences: TestHandoffPackageSource["designReferences"] = [];
  const live = await resolveContext(transaction.resolver, handoff.contextRefs);
  for (const ref of handoff.contextRefs) {
    const resolved = live.get(testHandoffContextRefKey(ref));
    if (resolved?.state !== "resolved") {
      blockers.push({
        kind: "unavailable",
        message: `A selected ${ref.kind} is ${(resolved?.state === "broken" ? resolved.reason : "unavailable").toLowerCase()} and cannot enter the package. Remove it from the ${TEST_HANDOFF_LABEL}.`,
        path: CONTEXT_SECTION[ref.kind],
      });
      continue;
    }
    if (ref.kind === "Document") {
      documentContext.push({
        documentId: ref.targetId,
        revision: ref.documentRevision,
        sectionId: ref.sectionId,
        title: resolved.label,
      });
    } else if (ref.kind === "Wireframe") {
      designReferences.push({
        screenId: ref.targetId,
        title: resolved.label,
        wireframeVersion: ref.wireframeVersion,
      });
    } else {
      workContext.push({ id: ref.targetId, title: resolved.label });
    }
  }
  if (blockers.length > 0) {
    return { blockers, package: null };
  }
  const built = buildTestHandoffPackage({
    adHocScope: handoff.adHocScope,
    buildContext: handoff.buildContext,
    createdAt,
    designReferences,
    documentContext,
    environmentPreconditions: handoff.environmentPreconditions,
    handoffId: handoff.id,
    packageVersion,
    project: transaction.project,
    purpose: handoff.purpose,
    scenarios,
    title: handoff.title,
    workContext,
  });
  for (const finding of scanTestHandoffPackageForSecrets(built)) {
    blockers.push({
      kind: "secret",
      message: `${finding.path} looks like it contains a secret (${finding.kind}). Remove it from the source; a package never carries secrets.`,
      path: finding.path,
    });
  }
  return { blockers, package: blockers.length > 0 ? null : built };
}

function toPackageRecord(
  stored: TestHandoffPackageStored,
): TestHandoffPackageRecord {
  const parsed = JSON.parse(stored.json) as TestHandoffPackageJson;
  return { ...stored, package: parsed, schemaVersion: parsed.schema_version };
}

async function presentHandoff(
  transaction: PlannedTestTransaction,
  stored: TestHandoffStoredRecord,
): Promise<TestHandoffRecord> {
  const cases = new Map(
    (await transaction.listCases()).map((record) => [record.id, record]),
  );
  const sessionTests = new Map(
    (await transaction.listSessionTests()).map((record) => [record.id, record]),
  );
  return toTestHandoffRecord(
    stored,
    cases,
    sessionTests,
    await resolveContext(transaction.resolver, stored.contextRefs),
  );
}

async function requireHandoff(
  transaction: PlannedTestTransaction,
  handoffId: string,
  lock: boolean,
) {
  const stored = await transaction.findHandoff(handoffId, lock);
  if (!stored) {
    throw new TestHandoffNotFoundError(handoffId);
  }
  return stored;
}

/** Every selected ref must be an existing exact version of this Project. */
async function requireSelectedVersions(
  transaction: PlannedTestTransaction,
  refs: readonly PlannedTestCaseVersionRef[],
) {
  await Promise.all(refs.map((ref) => requireExactVersion(transaction, ref)));
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

    async contextTargets(accountId, rawInput) {
      const input = testHandoffContextTargetsInputSchema.parse(rawInput);
      const targets = await store.run(
        accountId,
        input.projectId,
        "read",
        (transaction) => transaction.resolver.contextCandidates(input.kind),
      );
      if (!targets) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return targets;
    },

    async packages(accountId, rawInput) {
      const input = testHandoffPackageInputSchema.parse(rawInput);
      const listed = await store.run(
        accountId,
        input.projectId,
        "read",
        async (transaction) => {
          const handoff = await requireHandoff(
            transaction,
            input.handoffId,
            false,
          );
          return (await transaction.listPackages(handoff.id)).map(
            toPackageRecord,
          );
        },
      );
      if (!listed) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return { handoffId: input.handoffId, packages: listed };
    },

    async previewPackage(accountId, rawInput) {
      const input = testHandoffPackageInputSchema.parse(rawInput);
      const preview = await store.run(
        accountId,
        input.projectId,
        "read",
        async (transaction): Promise<TestHandoffPackagePreview> => {
          const handoff = await requireHandoff(
            transaction,
            input.handoffId,
            false,
          );
          const nextPackageVersion = handoff.packageVersion + 1;
          const { blockers, package: built } = await collectPackage(
            transaction,
            handoff,
            nextPackageVersion,
            new Date().toISOString(),
          );
          // A blocked preview withholds the rendering, so it cannot be copied
          // out as if it were a package.
          return {
            blockers,
            canProduce: built !== null && !transaction.readOnly,
            excluded: [...TEST_HANDOFF_PACKAGE_EXCLUDED],
            fingerprint: built ? packageFingerprint(built) : null,
            handoffId: handoff.id,
            included: built
              ? PACKAGE_INCLUDED_SECTIONS.map(([section, count]) => ({
                  count: count(built),
                  section,
                }))
              : [],
            json: built ? renderTestHandoffPackageJson(built) : null,
            markdown: built ? renderTestHandoffPackageMarkdown(built) : null,
            nextPackageVersion,
          };
        },
      );
      if (!preview) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return preview;
    },

    async producePackage(accountId, rawInput) {
      const input = produceTestHandoffPackageInputSchema.parse(rawInput);
      const produced = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const handoff = await requireHandoff(
            transaction,
            input.handoffId,
            true,
          );
          if (!TEST_HANDOFF_PACKAGE_STATES.includes(handoff.state)) {
            throw new TestHandoffPackageStateError(handoff.state);
          }
          const packageVersion = handoff.packageVersion + 1;
          if (input.expectedPackageVersion !== packageVersion) {
            throw new TestHandoffPackageStaleError(handoff.id);
          }
          const createdAt = new Date().toISOString();
          const { blockers, package: built } = await collectPackage(
            transaction,
            handoff,
            packageVersion,
            createdAt,
          );
          if (!built) {
            throw new TestHandoffPackageBlockedError(blockers);
          }
          if (packageFingerprint(built) !== input.previewFingerprint) {
            throw new TestHandoffPackageStaleError(handoff.id);
          }
          // Counter and stored package move together or not at all. Only the
          // package is written: the Handoff state and content stay as they are.
          const bumped = await transaction.bumpPackageVersion(
            handoff.id,
            handoff.packageVersion,
          );
          if (!bumped) {
            throw new TestHandoffPackageStaleError(handoff.id);
          }
          const stored: TestHandoffPackageStored = {
            createdAt,
            handoffId: handoff.id,
            json: renderTestHandoffPackageJson(built),
            markdown: renderTestHandoffPackageMarkdown(built),
            packageVersion,
          };
          await transaction.insertPackage(stored);
          return toPackageRecord(stored);
        },
      );
      if (!produced) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return produced;
    },

    async createHandoff(accountId, rawInput) {
      const input = createTestHandoffInputSchema.parse(rawInput);
      const created = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          await requireSelectedVersions(transaction, input.scenarios);
          await bindContextRefs(transaction.resolver, input.contextRefs, []);
          const now = new Date().toISOString();
          const stored: TestHandoffStoredRecord = {
            adHocScope: input.adHocScope,
            buildContext: input.buildContext,
            contextRefs: input.contextRefs,
            createdAt: now,
            dueDate: input.dueDate,
            environmentPreconditions: input.environmentPreconditions,
            id: crypto.randomUUID(),
            packageVersion: 0,
            projectId: input.projectId,
            purpose: input.purpose,
            scenarios: input.scenarios,
            sessionTests: [],
            state: "Draft",
            stateChangedAt: now,
            targetExecutor: input.targetExecutor,
            title: input.title,
            updatedAt: now,
          };
          await transaction.insertHandoff(stored);
          return await presentHandoff(transaction, stored);
        },
      );
      if (!created) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return created;
    },

    async handoffs(accountId, projectId) {
      const parsed = testHandoffProjectInputSchema.parse({ projectId });
      const listed = await store.run(
        accountId,
        parsed.projectId,
        "read",
        async (transaction) => {
          const cases = new Map(
            (await transaction.listCases()).map((record) => [
              record.id,
              record,
            ]),
          );
          const sessionTests = new Map(
            (await transaction.listSessionTests()).map((record) => [
              record.id,
              record,
            ]),
          );
          const handoffs = await Promise.all(
            (await transaction.listHandoffs()).map(async (stored) =>
              toTestHandoffRecord(
                stored,
                cases,
                sessionTests,
                await resolveContext(transaction.resolver, stored.contextRefs),
              ),
            ),
          );
          return { handoffs, readOnly: transaction.readOnly };
        },
      );
      if (!listed) {
        throw new PlannedTestProjectNotFoundError(parsed.projectId);
      }
      return listed;
    },

    async linkHandoffSessionTest(accountId, rawInput) {
      const input = linkTestHandoffSessionTestInputSchema.parse(rawInput);
      const linked = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const handoff = await requireHandoff(
            transaction,
            input.handoffId,
            true,
          );
          const sessionTest = await transaction.findSessionTest(
            input.sessionTestId,
            true,
          );
          if (!sessionTest) {
            throw new SessionTestNotFoundError(input.sessionTestId);
          }
          if (
            sessionTest.scenarioId !== null &&
            !handoff.scenarios.some(
              ({ caseId, version }) =>
                caseId === sessionTest.scenarioId &&
                version === sessionTest.scenarioVersion,
            )
          ) {
            throw new TestHandoffScopeMismatchError(sessionTest.id, handoff.id);
          }
          const linkedAt = new Date().toISOString();
          // Only the link is written: state, content and package version stay.
          const attached = await transaction.linkHandoffSessionTest(
            handoff.id,
            sessionTest.id,
            linkedAt,
          );
          if (!attached) {
            throw new SessionTestAlreadyInHandoffError(sessionTest.id);
          }
          return await presentHandoff(transaction, {
            ...handoff,
            sessionTests: [
              ...handoff.sessionTests,
              { linkedAt, sessionTestId: sessionTest.id },
            ],
          });
        },
      );
      if (!linked) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return linked;
    },

    async linkSessionTest(accountId, rawInput) {
      const input = linkSessionTestInputSchema.parse(rawInput);
      const linked = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const stored = await transaction.findSessionTest(
            input.sessionTestId,
            true,
          );
          if (!stored) {
            throw new SessionTestNotFoundError(input.sessionTestId);
          }
          if (stored.scenarioId !== null) {
            throw new SessionTestAlreadyBoundError(stored.id);
          }
          const scenario = await requireExactVersion(transaction, input);
          const linkedAt = new Date().toISOString();
          const moved = await transaction.linkSessionTest(
            stored.id,
            { caseId: input.caseId, version: input.version },
            linkedAt,
          );
          if (!moved) {
            throw new SessionTestAlreadyBoundError(stored.id);
          }
          // Only the bind changes: the recorded content stays exactly as it was.
          return toSessionTestRecord(
            {
              ...stored,
              bindOrigin: "Linked later",
              linkedAt,
              scenarioId: input.caseId,
              scenarioVersion: input.version,
            },
            scenario,
          );
        },
      );
      if (!linked) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return linked;
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

    async recordSessionTest(accountId, rawInput) {
      const input = recordSessionTestInputSchema.parse(rawInput);
      const recorded = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const scenario = input.binding
            ? await requireExactVersion(transaction, input.binding)
            : null;
          const stored: SessionTestStoredRecord = {
            bindOrigin: input.binding ? "Bound when recorded" : null,
            createdAt: new Date().toISOString(),
            expectedBehavior: input.expectedBehavior ?? null,
            id: crypto.randomUUID(),
            linkedAt: null,
            projectId: input.projectId,
            purpose: input.purpose ?? null,
            scenarioId: input.binding?.caseId ?? null,
            scenarioVersion: input.binding?.version ?? null,
            title: input.title,
          };
          await transaction.insertSessionTest(stored);
          return toSessionTestRecord(stored, scenario);
        },
      );
      if (!recorded) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return recorded;
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

    async sessionTests(accountId, projectId) {
      const parsed = sessionTestProjectInputSchema.parse({ projectId });
      const listed = await store.run(
        accountId,
        parsed.projectId,
        "read",
        async (transaction) => {
          const cases = new Map(
            (await transaction.listCases()).map((record) => [
              record.id,
              record,
            ]),
          );
          const sessionTests = (await transaction.listSessionTests()).map(
            (stored) =>
              toSessionTestRecord(
                stored,
                stored.scenarioId
                  ? (cases.get(stored.scenarioId) ?? null)
                  : null,
              ),
          );
          return { readOnly: transaction.readOnly, sessionTests };
        },
      );
      if (!listed) {
        throw new PlannedTestProjectNotFoundError(parsed.projectId);
      }
      return listed;
    },

    async transitionHandoff(accountId, rawInput) {
      const input = transitionTestHandoffInputSchema.parse(rawInput);
      const moved = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const handoff = await requireHandoff(
            transaction,
            input.handoffId,
            true,
          );
          if (handoff.state !== input.expectedState) {
            throw new TestHandoffStateConflictError(handoff.id);
          }
          if (!canTransitionTestHandoff(handoff.state, input.to)) {
            throw new TestHandoffTransitionError(handoff.state, input.to);
          }
          const changedAt = new Date().toISOString();
          const set = await transaction.setHandoffState(
            handoff.id,
            handoff.state,
            input.to,
            changedAt,
          );
          if (!set) {
            throw new TestHandoffStateConflictError(handoff.id);
          }
          return await presentHandoff(transaction, {
            ...handoff,
            state: input.to,
            stateChangedAt: changedAt,
            updatedAt: changedAt,
          });
        },
      );
      if (!moved) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return moved;
    },

    async updateHandoff(accountId, rawInput) {
      const input = updateTestHandoffInputSchema.parse(rawInput);
      const saved = await store.run(
        accountId,
        input.projectId,
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw new PlannedTestProjectReadOnlyError(input.projectId);
          }
          const handoff = await requireHandoff(
            transaction,
            input.handoffId,
            true,
          );
          if (!TEST_HANDOFF_EDITABLE_STATES.includes(handoff.state)) {
            throw new TestHandoffLockedError(handoff.id);
          }
          await requireSelectedVersions(transaction, input.scenarios);
          await bindContextRefs(
            transaction.resolver,
            input.contextRefs,
            handoff.contextRefs,
          );
          const updatedAt = new Date().toISOString();
          const content = {
            adHocScope: input.adHocScope,
            buildContext: input.buildContext,
            contextRefs: input.contextRefs,
            dueDate: input.dueDate,
            environmentPreconditions: input.environmentPreconditions,
            purpose: input.purpose,
            scenarios: input.scenarios,
            targetExecutor: input.targetExecutor,
            title: input.title,
          };
          await transaction.replaceHandoffContent(
            handoff.id,
            content,
            updatedAt,
          );
          return await presentHandoff(transaction, {
            ...handoff,
            ...content,
            updatedAt,
          });
        },
      );
      if (!saved) {
        throw new PlannedTestProjectNotFoundError(input.projectId);
      }
      return saved;
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
