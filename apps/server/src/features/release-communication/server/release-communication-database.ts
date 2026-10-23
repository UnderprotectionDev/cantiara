import {
  type ChangelogEntry,
  type Observation,
  type ObservationEvidenceRef,
  type ReleaseCommunicationAccess,
  ReleaseCommunicationError,
  type ReleaseNote,
  releaseNoteSchema,
} from "@cantiara/api/release-communication";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { feedback } from "@cantiara/db/schema/feedback";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectGoalRelation } from "@cantiara/db/schema/project-goal-relation";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  releaseChangelogSnapshot,
  releaseNote,
  releaseObservation,
  releaseObservationRevision,
  releaseReassessmentRound,
} from "@cantiara/db/schema/release-communication";
import { source } from "@cantiara/db/schema/source";
import { workspaceTag } from "@cantiara/db/schema/tags";
import { validationRecord } from "@cantiara/db/schema/validation-record";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  type ApprovedSnapshot,
  createReleaseCommunication,
  type LookAgainReminders,
  type ObservationWrite,
  type ReleaseCommunicationFacts,
  type ReleaseCommunicationStore,
  type StoredRound,
} from "./release-communication";

type Executor = Pick<Database, "insert" | "select" | "update">;

const stale = () =>
  new ReleaseCommunicationError(
    "RELEASE_COMMUNICATION_STALE_REVISION",
    "Release communication changed. Reload and try again.",
  );

function toNote(row: typeof releaseNote.$inferSelect): ReleaseNote {
  return releaseNoteSchema.parse({
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    projectId: row.projectId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    releaseId: row.releaseId,
    revision: row.revision,
    scopeWorkIds: row.scopeWorkIds,
    status: row.status,
    tagIds: row.tagIds,
    updatedAt: row.updatedAt.toISOString(),
    whyTrail: row.whyTrail,
  });
}

function toObservation(
  row: typeof releaseObservation.$inferSelect,
  previous: (typeof releaseObservationRevision.$inferSelect)[],
): Observation {
  return {
    assessment: row.assessment as Observation["assessment"],
    authorId: row.authorId,
    evidence: row.evidence as ObservationEvidenceRef[],
    id: row.id,
    kind: row.kind as Observation["kind"],
    observedAt: row.observedAt.toISOString(),
    previous: [...previous]
      .sort((left, right) => left.revision - right.revision)
      .map((entry) => ({
        assessment: entry.assessment as Observation["assessment"],
        authorId: entry.authorId,
        evidence: entry.evidence as ObservationEvidenceRef[],
        observedAt: entry.observedAt.toISOString(),
        revision: entry.revision,
        savedAt: entry.savedAt.toISOString(),
        text: entry.text,
      })),
    revision: row.revision,
    roundId: row.roundId,
    savedAt: row.savedAt.toISOString(),
    text: row.text,
  };
}

async function loadRounds(
  executor: Executor,
  rounds: (typeof releaseReassessmentRound.$inferSelect)[],
): Promise<StoredRound[]> {
  if (rounds.length === 0) {
    return [];
  }
  const ids = rounds.map((round) => round.id);
  const observations = await executor
    .select()
    .from(releaseObservation)
    .where(inArray(releaseObservation.roundId, ids));
  const revisions =
    observations.length === 0
      ? []
      : await executor
          .select()
          .from(releaseObservationRevision)
          .where(
            inArray(
              releaseObservationRevision.observationId,
              observations.map((row) => row.id),
            ),
          );
  return rounds.map((round) => {
    const own = observations.filter((row) => row.roundId === round.id);
    const pick = (kind: string) => {
      const row = own.find((entry) => entry.kind === kind);
      return row
        ? toObservation(
            row,
            revisions.filter((entry) => entry.observationId === row.id),
          )
        : null;
    };
    return {
      access: pick("access"),
      closeReason: round.closeReason as StoredRound["closeReason"],
      closedAt: round.closedAt?.toISOString() ?? null,
      id: round.id,
      outcome: pick("outcome"),
      releaseId: round.releaseId,
      sequence: round.sequence,
      startedAt: round.startedAt.toISOString(),
    };
  });
}

export function createDatabaseReleaseStore(
  database: Database,
): ReleaseCommunicationStore {
  async function round(executor: Executor, roundId: string) {
    const rows = await executor
      .select()
      .from(releaseReassessmentRound)
      .where(eq(releaseReassessmentRound.id, roundId))
      .limit(1);
    const [loaded] = await loadRounds(executor, rows);
    return loaded ?? null;
  }

  return {
    async changelog(projectId) {
      const rows = await database
        .select()
        .from(releaseChangelogSnapshot)
        .where(eq(releaseChangelogSnapshot.projectId, projectId))
        .orderBy(desc(releaseChangelogSnapshot.approvedAt));
      return rows.map((row) => ({
        ...(row.snapshot as Omit<ChangelogEntry, "revision">),
        revision: row.revision,
      }));
    },

    async closeRound(roundId, closedAt) {
      return await database.transaction(async (transaction) => {
        await transaction
          .update(releaseReassessmentRound)
          .set({
            closeReason: "Close assessment",
            closedAt: new Date(closedAt),
          })
          .where(
            and(
              eq(releaseReassessmentRound.id, roundId),
              isNull(releaseReassessmentRound.closedAt),
            ),
          );
        const closed = await round(transaction, roundId);
        if (!closed) {
          throw stale();
        }
        return closed;
      });
    },

    async createRound({ projectId, releaseId, startedAt }) {
      return await database.transaction(async (transaction) => {
        const [latest] = await transaction
          .select({ sequence: releaseReassessmentRound.sequence })
          .from(releaseReassessmentRound)
          .where(eq(releaseReassessmentRound.releaseId, releaseId))
          .orderBy(desc(releaseReassessmentRound.sequence))
          .limit(1);
        const id = crypto.randomUUID();
        await transaction.insert(releaseReassessmentRound).values({
          id,
          projectId,
          releaseId,
          sequence: (latest?.sequence ?? 0) + 1,
          startedAt: new Date(startedAt),
        });
        const created = await round(transaction, id);
        if (!created) {
          throw stale();
        }
        return created;
      });
    },

    async findNote(noteId) {
      const [row] = await database
        .select()
        .from(releaseNote)
        .where(eq(releaseNote.id, noteId))
        .limit(1);
      return row ? toNote(row) : null;
    },

    findRound: (roundId) => round(database, roundId),

    async listNotes(releaseId) {
      const rows = await database
        .select()
        .from(releaseNote)
        .where(eq(releaseNote.releaseId, releaseId))
        .orderBy(desc(releaseNote.createdAt));
      return rows.map(toNote);
    },

    async listRounds(releaseId) {
      return await loadRounds(
        database,
        await database
          .select()
          .from(releaseReassessmentRound)
          .where(eq(releaseReassessmentRound.releaseId, releaseId))
          .orderBy(asc(releaseReassessmentRound.sequence)),
      );
    },

    async openRounds(projectId) {
      return await loadRounds(
        database,
        await database
          .select()
          .from(releaseReassessmentRound)
          .where(
            and(
              eq(releaseReassessmentRound.projectId, projectId),
              isNull(releaseReassessmentRound.closedAt),
            ),
          )
          .orderBy(asc(releaseReassessmentRound.startedAt)),
      );
    },

    async publish(snapshot: ApprovedSnapshot) {
      return await database.transaction(async (transaction) => {
        const approvedAt = new Date(snapshot.approvedAt);
        const published = await transaction
          .update(releaseNote)
          .set({ publishedAt: approvedAt, status: "Published" })
          .where(
            and(
              eq(releaseNote.id, snapshot.noteId),
              eq(releaseNote.status, "Draft"),
            ),
          )
          .returning({ projectId: releaseNote.projectId });
        const [row] = published;
        if (!row) {
          throw new ReleaseCommunicationError(
            "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
            "These Release notes are already published.",
          );
        }
        await transaction.insert(releaseChangelogSnapshot).values({
          approvedAt,
          id: crypto.randomUUID(),
          noteId: snapshot.noteId,
          projectId: row.projectId,
          releaseId: snapshot.releaseId,
          revision: 1,
          snapshot,
        });
        return { ...snapshot, revision: 1 };
      });
    },

    async saveNote(write) {
      const savedAt = new Date(write.savedAt);
      const values = {
        body: write.body,
        scopeWorkIds: write.scopeWorkIds,
        tagIds: write.tagIds,
        updatedAt: savedAt,
        whyTrail: write.whyTrail,
      };
      if (write.noteId === null) {
        if (write.baseRevision !== 0) {
          throw stale();
        }
        const [created] = await database
          .insert(releaseNote)
          .values({
            ...values,
            authorId: write.authorId,
            createdAt: savedAt,
            id: crypto.randomUUID(),
            projectId: write.projectId,
            releaseId: write.releaseId,
          })
          .returning();
        if (!created) {
          throw stale();
        }
        return toNote(created);
      }
      const [updated] = await database
        .update(releaseNote)
        .set({ ...values, revision: write.baseRevision + 1 })
        .where(
          and(
            eq(releaseNote.id, write.noteId),
            eq(releaseNote.revision, write.baseRevision),
            eq(releaseNote.status, "Draft"),
          ),
        )
        .returning();
      if (!updated) {
        throw stale();
      }
      return toNote(updated);
    },

    async saveObservation(write: ObservationWrite) {
      return await database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select()
          .from(releaseObservation)
          .where(
            and(
              eq(releaseObservation.roundId, write.roundId),
              eq(releaseObservation.kind, write.kind),
            ),
          )
          .limit(1);
        const savedAt = new Date(write.savedAt);
        const next = {
          assessment: write.assessment,
          authorId: write.authorId,
          evidence: write.evidence,
          observedAt: new Date(write.observedAt),
          savedAt,
          text: write.text,
        };
        if (existing) {
          if (existing.revision !== write.baseRevision) {
            throw stale();
          }
          await transaction.insert(releaseObservationRevision).values({
            assessment: existing.assessment,
            authorId: existing.authorId,
            evidence: existing.evidence,
            observationId: existing.id,
            observedAt: existing.observedAt,
            revision: existing.revision,
            savedAt: existing.savedAt,
            text: existing.text,
          });
          await transaction
            .update(releaseObservation)
            .set({ ...next, revision: existing.revision + 1 })
            .where(eq(releaseObservation.id, existing.id));
        } else {
          if (write.baseRevision !== 0) {
            throw stale();
          }
          await transaction.insert(releaseObservation).values({
            ...next,
            id: crypto.randomUUID(),
            kind: write.kind,
            roundId: write.roundId,
          });
        }
        const saved = await round(transaction, write.roundId);
        if (!saved) {
          throw stale();
        }
        return saved;
      });
    },
  };
}

/**
 * Facts the other specs own. Scope, hypothesis, Build in Public events and
 * Why-trail records stay empty until 63, 75 and 45 ship their read models;
 * with no scope the seam accepts no Release notes.
 */
export function createDatabaseReleaseFacts(
  database: Database,
): ReleaseCommunicationFacts {
  async function owned(accountId: string, projectId: string) {
    const [row] = await database
      .select({ id: project.id })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
      )
      .limit(1);
    return Boolean(row);
  }

  return {
    buildInPublicEvents: () => Promise.resolve([]),
    changelogLinks: () => Promise.resolve([]),

    async evidenceExists(projectId, ref) {
      const lookups = {
        "File Attachment": () =>
          database
            .select({ id: fileAttachment.id })
            .from(fileAttachment)
            .where(
              and(
                eq(fileAttachment.id, ref.sourceId),
                eq(fileAttachment.projectId, projectId),
              ),
            )
            .limit(1),
        Feedback: () =>
          database
            .select({ id: feedback.id })
            .from(feedback)
            .where(
              and(
                eq(feedback.id, ref.sourceId),
                eq(feedback.projectId, projectId),
              ),
            )
            .limit(1),
        Source: () =>
          database
            .select({ id: source.id })
            .from(source)
            .where(
              and(eq(source.id, ref.sourceId), eq(source.projectId, projectId)),
            )
            .limit(1),
        "Validation Record": () =>
          database
            .select({ id: validationRecord.id })
            .from(validationRecord)
            .where(
              and(
                eq(validationRecord.id, ref.sourceId),
                eq(validationRecord.projectId, projectId),
              ),
            )
            .limit(1),
      } as const;
      const [row] = await lookups[ref.sourceType]();
      return Boolean(row);
    },

    projectOwned: owned,
    projectWorkKeys: () => Promise.resolve([]),

    async release(accountId, releaseId) {
      const [row] = await database
        .select({
          id: projectRelease.id,
          projectId: projectRelease.projectId,
          status: projectRelease.status,
        })
        .from(projectRelease)
        .innerJoin(project, eq(projectRelease.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(projectRelease.id, releaseId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!row) {
        return null;
      }
      const [goal] = await database
        .select({ id: projectGoal.id, title: projectGoal.title })
        .from(projectGoalRelation)
        .innerJoin(projectGoal, eq(projectGoalRelation.goalId, projectGoal.id))
        .where(
          and(
            eq(projectGoalRelation.memberType, "Project Release"),
            eq(projectGoalRelation.memberId, releaseId),
            eq(projectGoalRelation.kind, "Contributes to Goal"),
            isNull(projectGoalRelation.removedAt),
          ),
        )
        .limit(1);
      return {
        goal: goal
          ? {
              id: goal.id,
              sourcePath: `/projects/${row.projectId}`,
              title: goal.title,
            }
          : null,
        hypothesis: null,
        id: row.id,
        projectId: row.projectId,
        status: row.status,
      };
    },

    scopeWorks: () => Promise.resolve([]),

    async tagsExist(projectId, tagIds) {
      if (tagIds.length === 0) {
        return true;
      }
      const rows = await database
        .select({ id: workspaceTag.id })
        .from(workspaceTag)
        .innerJoin(workspace, eq(workspaceTag.workspaceId, workspace.id))
        .innerJoin(project, eq(project.workspaceId, workspace.id))
        .where(
          and(eq(project.id, projectId), inArray(workspaceTag.id, tagIds)),
        );
      return rows.length === new Set(tagIds).size;
    },

    whyTrailRecord: () => Promise.resolve(null),
  };
}

export function createDatabaseReleaseCommunication(
  database: Database,
  reminders: LookAgainReminders,
): ReleaseCommunicationAccess {
  return createReleaseCommunication({
    facts: createDatabaseReleaseFacts(database),
    reminders,
    store: createDatabaseReleaseStore(database),
  });
}
