import type {
  TestSummaryFacts,
  TestSummaryScopeInput,
} from "@cantiara/api/test-review-summary";
import {
  plannedTestCase,
  plannedTestCaseRelation,
  plannedTestCaseVersion,
  sessionTest,
  testHandoff,
  testHandoffContextRef,
  testHandoffScenario,
  testHandoffSessionTest,
  testSession,
} from "@cantiara/db/schema/planned-test";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { workRelation } from "@cantiara/db/schema/relation";
import { testAssessment } from "@cantiara/db/schema/test-assessment";
import {
  testGap,
  testGapCaseBind,
  testGapHandoffBind,
  testGapRelation,
} from "@cantiara/db/schema/test-gap";
import { work } from "@cantiara/db/schema/work";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import type { FeedbackExecutor } from "../../feedback/server/feedback-database";

type Executor = FeedbackExecutor;
type Scope = TestSummaryFacts["scope"];

const HANDOFF_SUBJECT_KINDS = ["Feature", "Work"];

function unique(values: string[]) {
  return [...new Set(values)];
}

/**
 * Feature scope: the Feature and the İş it `Includes` (open relations only).
 * Trashed or archived Works are not related records.
 */
async function featureScope(
  executor: Executor,
  projectId: string,
  featureId: string,
): Promise<{ label: string; subjects: string[] } | null> {
  const [feature] = await executor
    .select({
      archivedAt: work.archivedAt,
      status: work.status,
      title: work.title,
      trashedAt: work.trashedAt,
      type: work.type,
    })
    .from(work)
    .where(and(eq(work.id, featureId), eq(work.projectId, projectId)));
  if (
    feature?.type !== "Feature" ||
    feature.trashedAt ||
    feature.archivedAt ||
    feature.status === "Archived"
  ) {
    return null;
  }
  const included = await executor
    .select({ id: workRelation.targetRecordId })
    .from(workRelation)
    .where(
      and(
        eq(workRelation.sourceWorkId, featureId),
        eq(workRelation.kind, "Includes"),
        eq(workRelation.targetRecordType, "Work"),
        isNull(workRelation.deletedAt),
      ),
    );
  return {
    label: feature.title,
    subjects: unique([featureId, ...included.map(({ id }) => id)]),
  };
}

/**
 * Project Release scope. The in-scope Feature/İş membership is owned by
 * Release Planning (spec 63), which has no scope record yet, so the Release
 * contributes its direct links only (Test Gaps and Test Assessments that name
 * it) until that owner exists.
 */
async function releaseScope(
  executor: Executor,
  projectId: string,
  releaseId: string,
): Promise<{ label: string; subjects: string[] } | null> {
  const [release] = await executor
    .select({ name: projectRelease.name })
    .from(projectRelease)
    .where(
      and(
        eq(projectRelease.id, releaseId),
        eq(projectRelease.projectId, projectId),
      ),
    );
  return release ? { label: release.name, subjects: [] } : null;
}

/** Planned Test Cases whose current version names a subject. */
async function scopedCases(
  executor: Executor,
  projectId: string,
  subjects: string[],
) {
  if (subjects.length === 0) {
    return [];
  }
  return await executor
    .select({
      id: plannedTestCase.id,
      title: plannedTestCaseVersion.title,
      version: plannedTestCaseVersion.version,
    })
    .from(plannedTestCaseRelation)
    .innerJoin(
      plannedTestCaseVersion,
      eq(plannedTestCaseVersion.id, plannedTestCaseRelation.versionId),
    )
    .innerJoin(
      plannedTestCase,
      and(
        eq(plannedTestCase.id, plannedTestCaseVersion.caseId),
        eq(plannedTestCase.currentVersion, plannedTestCaseVersion.version),
      ),
    )
    .where(
      and(
        eq(plannedTestCase.projectId, projectId),
        inArray(plannedTestCaseRelation.targetType, HANDOFF_SUBJECT_KINDS),
        inArray(plannedTestCaseRelation.targetId, subjects),
      ),
    );
}

async function scopedHandoffIds(
  executor: Executor,
  projectId: string,
  subjects: string[],
  caseIds: string[],
) {
  const found: string[] = [];
  if (caseIds.length > 0) {
    found.push(
      ...(
        await executor
          .select({ id: testHandoff.id })
          .from(testHandoffScenario)
          .innerJoin(
            testHandoff,
            eq(testHandoff.id, testHandoffScenario.handoffId),
          )
          .where(
            and(
              eq(testHandoff.projectId, projectId),
              inArray(testHandoffScenario.caseId, caseIds),
            ),
          )
      ).map(({ id }) => id),
    );
  }
  if (subjects.length > 0) {
    found.push(
      ...(
        await executor
          .select({ id: testHandoff.id })
          .from(testHandoffContextRef)
          .innerJoin(
            testHandoff,
            eq(testHandoff.id, testHandoffContextRef.handoffId),
          )
          .where(
            and(
              eq(testHandoff.projectId, projectId),
              inArray(testHandoffContextRef.kind, HANDOFF_SUBJECT_KINDS),
              inArray(testHandoffContextRef.targetId, subjects),
            ),
          )
      ).map(({ id }) => id),
    );
  }
  return unique(found);
}

async function scopedGapIds(
  executor: Executor,
  projectId: string,
  scope: { id: string; kind: Scope["kind"] },
  subjects: string[],
  caseIds: string[],
  handoffIds: string[],
) {
  const found: string[] = [];
  const relationTargets = [
    ...(subjects.length > 0
      ? [
          and(
            inArray(testGapRelation.targetType, HANDOFF_SUBJECT_KINDS),
            inArray(testGapRelation.targetId, subjects),
          ),
        ]
      : []),
    ...(scope.kind === "Project Release"
      ? [
          and(
            eq(testGapRelation.targetType, "Project Release"),
            eq(testGapRelation.targetId, scope.id),
          ),
        ]
      : []),
  ];
  if (relationTargets.length > 0) {
    found.push(
      ...(
        await executor
          .select({ id: testGap.id })
          .from(testGapRelation)
          .innerJoin(testGap, eq(testGap.id, testGapRelation.gapId))
          .where(and(eq(testGap.projectId, projectId), or(...relationTargets)))
      ).map(({ id }) => id),
    );
  }
  if (caseIds.length > 0) {
    found.push(
      ...(
        await executor
          .select({ id: testGap.id })
          .from(testGapCaseBind)
          .innerJoin(testGap, eq(testGap.id, testGapCaseBind.gapId))
          .where(
            and(
              eq(testGap.projectId, projectId),
              inArray(testGapCaseBind.caseId, caseIds),
            ),
          )
      ).map(({ id }) => id),
    );
  }
  if (handoffIds.length > 0) {
    found.push(
      ...(
        await executor
          .select({ id: testGap.id })
          .from(testGapHandoffBind)
          .innerJoin(testGap, eq(testGap.id, testGapHandoffBind.gapId))
          .where(
            and(
              eq(testGap.projectId, projectId),
              inArray(testGapHandoffBind.handoffId, handoffIds),
            ),
          )
      ).map(({ id }) => id),
    );
  }
  return unique(found);
}

async function assessmentLabels(
  executor: Executor,
  projectId: string,
  rows: { contextId: string; contextKind: string }[],
) {
  const labels = new Map<string, string>();
  const idsOf = (kind: string) =>
    unique(
      rows.filter((row) => row.contextKind === kind).map((r) => r.contextId),
    );
  const handoffs = idsOf("Handoff");
  const releases = idsOf("Project Release");
  const features = idsOf("Feature");
  if (handoffs.length > 0) {
    for (const row of await executor
      .select({ id: testHandoff.id, title: testHandoff.title })
      .from(testHandoff)
      .where(
        and(
          eq(testHandoff.projectId, projectId),
          inArray(testHandoff.id, handoffs),
        ),
      )) {
      labels.set(`Handoff:${row.id}`, row.title);
    }
  }
  if (releases.length > 0) {
    for (const row of await executor
      .select({ id: projectRelease.id, name: projectRelease.name })
      .from(projectRelease)
      .where(
        and(
          eq(projectRelease.projectId, projectId),
          inArray(projectRelease.id, releases),
        ),
      )) {
      labels.set(`Project Release:${row.id}`, row.name);
    }
  }
  if (features.length > 0) {
    for (const row of await executor
      .select({ id: work.id, title: work.title })
      .from(work)
      .where(and(eq(work.projectId, projectId), inArray(work.id, features)))) {
      labels.set(`Feature:${row.id}`, row.title);
    }
  }
  return labels;
}

async function readGaps(
  executor: Executor,
  projectId: string,
  ids: string[] | null,
): Promise<TestSummaryFacts["gaps"]> {
  if (ids !== null && ids.length === 0) {
    return [];
  }
  const rows = await executor
    .select({
      createdAt: testGap.createdAt,
      id: testGap.id,
      state: testGap.state,
      title: testGap.title,
    })
    .from(testGap)
    .where(
      ids
        ? and(eq(testGap.projectId, projectId), inArray(testGap.id, ids))
        : eq(testGap.projectId, projectId),
    )
    .orderBy(desc(testGap.updatedAt), testGap.id);
  return rows.map((row) => ({
    id: row.id,
    recordedAt: row.createdAt.toISOString(),
    state: row.state,
    title: row.title,
  }));
}

async function readHandoffs(
  executor: Executor,
  projectId: string,
  ids: string[] | null,
): Promise<TestSummaryFacts["handoffs"]> {
  if (ids !== null && ids.length === 0) {
    return [];
  }
  return await executor
    .select({
      id: testHandoff.id,
      state: testHandoff.state,
      title: testHandoff.title,
    })
    .from(testHandoff)
    .where(
      ids
        ? and(
            eq(testHandoff.projectId, projectId),
            inArray(testHandoff.id, ids),
          )
        : eq(testHandoff.projectId, projectId),
    )
    .orderBy(desc(testHandoff.updatedAt), testHandoff.id);
}

async function readAssessments(
  executor: Executor,
  projectId: string,
  scope: Scope,
): Promise<TestSummaryFacts["assessments"]> {
  const rows = await executor
    .select({
      assessedAt: testAssessment.assessedAt,
      contextId: testAssessment.contextId,
      contextKind: testAssessment.contextKind,
      decision: testAssessment.decision,
      id: testAssessment.id,
    })
    .from(testAssessment)
    .where(
      scope.kind === "Project"
        ? eq(testAssessment.projectId, projectId)
        : and(
            eq(testAssessment.projectId, projectId),
            eq(testAssessment.contextKind, scope.kind),
            eq(testAssessment.contextId, scope.id ?? ""),
          ),
    )
    .orderBy(desc(testAssessment.assessedAt), testAssessment.id);
  const labels = await assessmentLabels(executor, projectId, rows);
  return rows.map((row) => ({
    assessedAt: row.assessedAt.toISOString(),
    decision: row.decision,
    id: row.id,
    label:
      labels.get(`${row.contextKind}:${row.contextId}`) ??
      `${row.contextKind} assessment`,
  }));
}

/** Session Tests and Test Sessions related through scenarios or Handoffs. */
async function scopedSessions(
  executor: Executor,
  projectId: string,
  caseIds: string[],
  handoffIds: string[],
) {
  const sessionTestIds: string[] = [];
  const sessionIds: string[] = [];
  if (caseIds.length > 0) {
    sessionTestIds.push(
      ...(
        await executor
          .select({ id: sessionTest.id })
          .from(sessionTest)
          .where(
            and(
              eq(sessionTest.projectId, projectId),
              inArray(sessionTest.scenarioId, caseIds),
            ),
          )
      ).map(({ id }) => id),
    );
  }
  if (handoffIds.length > 0) {
    sessionTestIds.push(
      ...(
        await executor
          .select({ id: testHandoffSessionTest.sessionTestId })
          .from(testHandoffSessionTest)
          .where(inArray(testHandoffSessionTest.handoffId, handoffIds))
      ).map(({ id }) => id),
    );
    sessionIds.push(
      ...(
        await executor
          .select({ id: testSession.id })
          .from(testSession)
          .where(
            and(
              eq(testSession.projectId, projectId),
              inArray(testSession.handoffId, handoffIds),
            ),
          )
      ).map(({ id }) => id),
    );
  }
  return {
    sessionIds: unique(sessionIds),
    sessionTestIds: unique(sessionTestIds),
  };
}

/**
 * Read-only facts of other features for one summary scope. Nothing in this
 * file inserts, updates or deletes, and no GitHub check is read: checks are
 * external facts that never become Test Sessions.
 */
export async function readSummaryFacts(
  executor: Executor,
  projectId: string,
  projectName: string,
  input: TestSummaryScopeInput,
): Promise<TestSummaryFacts | null> {
  if (input.kind === "Project") {
    const scope: Scope = { id: null, kind: "Project", label: projectName };
    return {
      assessments: await readAssessments(executor, projectId, scope),
      gaps: await readGaps(executor, projectId, null),
      handoffs: await readHandoffs(executor, projectId, null),
      scenarios: [],
      scope,
      sessionIds: [],
      sessionTestIds: [],
    };
  }
  const resolved =
    input.kind === "Feature"
      ? await featureScope(executor, projectId, input.id)
      : await releaseScope(executor, projectId, input.id);
  if (!resolved) {
    return null;
  }
  const scope: Scope = {
    id: input.id,
    kind: input.kind,
    label: resolved.label,
  };
  const cases = await scopedCases(executor, projectId, resolved.subjects);
  const caseIds = unique(cases.map(({ id }) => id));
  const handoffIds = await scopedHandoffIds(
    executor,
    projectId,
    resolved.subjects,
    caseIds,
  );
  const gapIds = await scopedGapIds(
    executor,
    projectId,
    { id: input.id, kind: input.kind },
    resolved.subjects,
    caseIds,
    handoffIds,
  );
  const sessions = await scopedSessions(
    executor,
    projectId,
    caseIds,
    handoffIds,
  );
  return {
    assessments: await readAssessments(executor, projectId, scope),
    gaps: await readGaps(executor, projectId, gapIds),
    handoffs: await readHandoffs(executor, projectId, handoffIds),
    scenarios: [
      ...new Map(cases.map((entry) => [entry.id, entry] as const)).values(),
    ].sort(
      (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    ),
    scope,
    ...sessions,
  };
}
