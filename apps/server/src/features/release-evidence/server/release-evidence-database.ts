import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  projectReleaseChecklistItem,
  projectReleaseSignalClose,
} from "@cantiara/db/schema/release-evidence";
import { risk, riskContextRelation } from "@cantiara/db/schema/risk";
import { testAssessment } from "@cantiara/db/schema/test-assessment";
import { testGap, testGapRelation } from "@cantiara/db/schema/test-gap";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  createReleaseEvidence,
  type ReleaseEvidenceSources,
  type ReleaseEvidenceStore,
} from "./release-evidence";

type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];

const MAX_CHECKLIST_ITEMS = 200;

export class ReleaseEvidenceChecklistFullError extends Error {
  readonly code = "RELEASE_EVIDENCE_CHECKLIST_FULL" as const;

  constructor() {
    super(`A release checklist holds at most ${MAX_CHECKLIST_ITEMS} items.`);
    this.name = "ReleaseEvidenceChecklistFullError";
  }
}

const toItem = (row: typeof projectReleaseChecklistItem.$inferSelect) => ({
  checked: row.checked,
  id: row.id,
  text: row.text,
});

/** The Project when the account owns it; a write locks the row. */
async function findProject(
  executor: Executor,
  accountId: string,
  projectId: string,
  mode: "read" | "write",
) {
  const query = executor
    .select({ archivedAt: project.archivedAt, id: project.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  const [owned] =
    mode === "write" ? await query.for("update", { of: project }) : await query;
  return owned ?? null;
}

export function createDatabaseReleaseEvidenceStore(
  database: Database,
): ReleaseEvidenceStore {
  return {
    run(accountId, projectId, releaseId, mode, unitOfWork) {
      return database.transaction(async (executor) => {
        const owned = await findProject(executor, accountId, projectId, mode);
        if (!owned) {
          return null;
        }
        const ownRelease = and(
          eq(projectRelease.id, releaseId),
          eq(projectRelease.projectId, owned.id),
        );
        return await unitOfWork({
          addChecklistItem: async (text) => {
            const existing = await executor
              .select({ id: projectReleaseChecklistItem.id })
              .from(projectReleaseChecklistItem)
              .where(eq(projectReleaseChecklistItem.releaseId, releaseId));
            if (existing.length >= MAX_CHECKLIST_ITEMS) {
              throw new ReleaseEvidenceChecklistFullError();
            }
            const [row] = await executor
              .insert(projectReleaseChecklistItem)
              .values({
                id: crypto.randomUUID(),
                position: existing.length,
                projectId: owned.id,
                releaseId,
                text,
              })
              .returning();
            if (!row) {
              throw new Error("Checklist item was not stored.");
            }
            return toItem(row);
          },
          checklist: async () =>
            (
              await executor
                .select()
                .from(projectReleaseChecklistItem)
                .where(eq(projectReleaseChecklistItem.releaseId, releaseId))
                .orderBy(
                  asc(projectReleaseChecklistItem.position),
                  asc(projectReleaseChecklistItem.createdAt),
                )
            ).map(toItem),
          closeSignal: async (signalId) => {
            await executor
              .insert(projectReleaseSignalClose)
              .values({ projectId: owned.id, releaseId, signalId })
              .onConflictDoNothing();
          },
          readOnly: owned.archivedAt !== null,
          release: async () => {
            const [row] = await executor
              .select()
              .from(projectRelease)
              .where(ownRelease);
            return row
              ? {
                  id: row.id,
                  name: row.name,
                  projectId: row.projectId,
                  status: row.status,
                  versionLabel: row.versionLabel,
                }
              : null;
          },
          removeChecklistItem: async (itemId) => {
            const removed = await executor
              .delete(projectReleaseChecklistItem)
              .where(
                and(
                  eq(projectReleaseChecklistItem.id, itemId),
                  eq(projectReleaseChecklistItem.releaseId, releaseId),
                ),
              )
              .returning({ id: projectReleaseChecklistItem.id });
            return removed.length > 0;
          },
          setChecklistItem: async (itemId, checked) => {
            const [row] = await executor
              .update(projectReleaseChecklistItem)
              .set({ checked })
              .where(
                and(
                  eq(projectReleaseChecklistItem.id, itemId),
                  eq(projectReleaseChecklistItem.releaseId, releaseId),
                ),
              )
              .returning();
            return row ? toItem(row) : null;
          },
          signalClosed: async (signalId) => {
            const [row] = await executor
              .select({ signalId: projectReleaseSignalClose.signalId })
              .from(projectReleaseSignalClose)
              .where(
                and(
                  eq(projectReleaseSignalClose.releaseId, releaseId),
                  eq(projectReleaseSignalClose.signalId, signalId),
                ),
              );
            return Boolean(row);
          },
        });
      });
    },
  };
}

const OPEN_GAP_STATES = ["Open", "Planned"];
const CLOSED_RISK_LIVES = ["Resolved", "Accepted"];

/** Owner modules that have not shipped a release-linked read yet (63, 65, 14). */
const PENDING_OWNER = (owner: string) =>
  `${owner} has not provided a read for this Project Release yet.`;

async function releaseRisks(
  executor: Executor,
  projectId: string,
  releaseId: string,
) {
  const rows = await executor
    .select({ id: risk.id, life: risk.life, title: risk.title })
    .from(riskContextRelation)
    .innerJoin(risk, eq(risk.id, riskContextRelation.riskId))
    .where(
      and(
        eq(riskContextRelation.projectReleaseId, releaseId),
        eq(risk.projectId, projectId),
      ),
    )
    .orderBy(asc(risk.title));
  return rows.map((row) => ({
    id: row.id,
    open: !CLOSED_RISK_LIVES.includes(row.life),
    state: row.life,
    title: row.title,
  }));
}

async function releaseOpenGaps(
  executor: Executor,
  projectId: string,
  releaseId: string,
) {
  const related = await executor
    .select({ gapId: testGapRelation.gapId })
    .from(testGapRelation)
    .where(
      and(
        eq(testGapRelation.targetType, "Project Release"),
        eq(testGapRelation.targetId, releaseId),
      ),
    );
  if (related.length === 0) {
    return [];
  }
  const rows = await executor
    .select({ id: testGap.id, state: testGap.state, title: testGap.title })
    .from(testGap)
    .where(
      and(
        eq(testGap.projectId, projectId),
        inArray(
          testGap.id,
          related.map(({ gapId }) => gapId),
        ),
        inArray(testGap.state, OPEN_GAP_STATES),
      ),
    )
    .orderBy(asc(testGap.title));
  return rows;
}

async function latestAssessment(
  executor: Executor,
  projectId: string,
  releaseId: string,
) {
  const [row] = await executor
    .select()
    .from(testAssessment)
    .where(
      and(
        eq(testAssessment.projectId, projectId),
        eq(testAssessment.contextKind, "Project Release"),
        eq(testAssessment.contextId, releaseId),
      ),
    )
    .orderBy(desc(testAssessment.assessedAt))
    .limit(1);
  return row
    ? {
        assessedAt: row.assessedAt.toISOString(),
        decision: row.decision,
        id: row.id,
        // Test context events arrive with the Test Session owners (specs 54,
        // 57); until they report any, nothing is claimed as new context.
        newContextCount: 0,
      }
    : null;
}

/**
 * Reads the owner records that already relate to a Project Release: related
 * Risks (spec 40 context relation), open Test Gaps related to it (spec 55) and
 * its latest Test Assessment (spec 56). The scope, Pull request, Karar, test
 * record and publish diff owners (63, 61, 57, 65, 14) have no release-linked
 * read yet; each is reported as unavailable so the pack shows a source-linked
 * attention row for it instead of omitting it.
 */
export function createDatabaseReleaseEvidenceSources(
  database: Database,
): ReleaseEvidenceSources {
  return {
    read: async (_accountId, projectId, releaseId) => {
      const [risks, gaps, assessment] = await database.transaction(
        async (executor) => [
          await releaseRisks(executor, projectId, releaseId),
          await releaseOpenGaps(executor, projectId, releaseId),
          await latestAssessment(executor, projectId, releaseId),
        ],
      );
      return {
        assessment: { available: true, value: assessment },
        decisions: {
          available: false,
          reason: PENDING_OWNER("Karar relations"),
        },
        gaps: { available: true, value: gaps },
        inconsistencies: {
          available: false,
          reason: PENDING_OWNER("GitHub Work–Pull request comparison"),
        },
        publishDiff: {
          available: false,
          reason: PENDING_OWNER("The approved snapshot and changelog"),
        },
        pullRequests: {
          available: false,
          reason: PENDING_OWNER("Release scope"),
        },
        risks: { available: true, value: risks },
        scope: {
          available: false,
          reason: PENDING_OWNER("Project Release Planning"),
        },
        tests: {
          available: false,
          reason: PENDING_OWNER("Test records by release scope"),
        },
      };
    },
  };
}

export function createDatabaseReleaseEvidence(database: Database) {
  return createReleaseEvidence(
    createDatabaseReleaseEvidenceStore(database),
    createDatabaseReleaseEvidenceSources(database),
  );
}
