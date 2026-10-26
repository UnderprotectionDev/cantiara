import {
  type MutationPayload,
  mutationActorSchema,
  mutationOriginSchema,
  mutationUndoKindSchema,
} from "@cantiara/api/mutation-and-undo";
import type {
  ProjectActivityFacts,
  ProjectActivityHistoryFact,
  ProjectActivityRecordType,
} from "@cantiara/api/project-activity";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, desc, eq } from "drizzle-orm";

import type { ProjectActivityStore } from "./project-activity";

/** Newest entries read per source; a reached window is reported to the reader. */
export const PROJECT_ACTIVITY_SOURCE_WINDOW = 2000;

/**
 * History the owners write under a target id that is not a Work, Document,
 * Decision or Risk id (or a relation of a Work). It cannot be attributed to a
 * Project record type here, so it is reported and never guessed.
 */
export const PROJECT_ACTIVITY_UNATTRIBUTED = [
  "Backlog order and presentation (keyed by Project)",
  "Milestone, Project Release, Assumption, Open Question and Validation Record history",
  "Project goals, tags, custom fields, Smart Collections and prioritization sessions",
  "Document, Work and Decision relation graphs other than Work relations",
  "Focus Period, Feedback, Moodboard, Screen, User Flow and diagram history",
] as const;

type HistoryRow = typeof mutationHistory.$inferSelect;

function toFact(
  row: HistoryRow,
  source: ProjectActivityHistoryFact["source"],
  relation: boolean,
): ProjectActivityHistoryFact | null {
  const actor = mutationActorSchema.safeParse({
    actorId: row.actorId,
    ...(row.authorizingUserId
      ? { authorizingUserId: row.authorizingUserId }
      : {}),
    type: row.actorType,
  });
  const origin = mutationOriginSchema.safeParse(
    row.originKind === "human"
      ? {
          clientIdempotencyKey: row.clientIdempotencyKey,
          kind: "human",
        }
      : {
          deliveryId: row.deliveryId,
          kind: "source",
          sourceId: row.sourceId,
        },
  );
  if (!(actor.success && origin.success)) {
    return null;
  }
  const undoKind =
    typeof row.undo === "object" && row.undo !== null && "kind" in row.undo
      ? mutationUndoKindSchema.safeParse(row.undo.kind)
      : null;
  return {
    actor: actor.data,
    id: row.id,
    nextValue: row.nextValue as MutationPayload,
    occurredAt: row.occurredAt.toISOString(),
    origin: origin.data,
    previousValue: row.previousValue as MutationPayload,
    relation,
    revision: row.revision,
    source,
    undo: undoKind?.success ? { kind: undoKind.data } : undefined,
    undoOf: row.undoOf ?? undefined,
  };
}

export function createDatabaseProjectActivityStore(
  database: Database,
): ProjectActivityStore {
  return {
    read(accountId, projectId) {
      return database.transaction(async (executor) => {
        const [owned] = await executor
          .select({ id: project.id })
          .from(project)
          .innerJoin(workspace, eq(workspace.id, project.workspaceId))
          .where(
            and(
              eq(project.id, projectId),
              eq(workspace.ownerAccountId, accountId),
            ),
          );
        if (!owned) {
          return null;
        }
        const window = PROJECT_ACTIVITY_SOURCE_WINDOW;
        const ordered = [desc(mutationHistory.occurredAt)];
        // The owners form their Mutation Contract target id from the record id
        // itself, so the record table is the attribution: a history row counts
        // only when its target id is a current record of this Project.
        const [works, documents, decisions, risks, relations] =
          await Promise.all([
            executor
              .select({
                history: mutationHistory,
                label: work.title,
                recordKey: work.key,
                recordId: work.id,
              })
              .from(mutationHistory)
              .innerJoin(work, eq(work.id, mutationHistory.targetId))
              .where(eq(work.projectId, projectId))
              .orderBy(...ordered)
              .limit(window),
            executor
              .select({
                history: mutationHistory,
                label: document.title,
                recordId: document.id,
              })
              .from(mutationHistory)
              .innerJoin(document, eq(document.id, mutationHistory.targetId))
              .where(eq(document.projectId, projectId))
              .orderBy(...ordered)
              .limit(window),
            executor
              .select({
                history: mutationHistory,
                label: decision.title,
                recordId: decision.id,
              })
              .from(mutationHistory)
              .innerJoin(decision, eq(decision.id, mutationHistory.targetId))
              .where(eq(decision.projectId, projectId))
              .orderBy(...ordered)
              .limit(window),
            executor
              .select({
                history: mutationHistory,
                label: risk.title,
                recordId: risk.id,
              })
              .from(mutationHistory)
              .innerJoin(risk, eq(risk.id, mutationHistory.targetId))
              .where(eq(risk.projectId, projectId))
              .orderBy(...ordered)
              .limit(window),
            executor
              .select({
                history: mutationHistory,
                label: work.title,
                recordKey: work.key,
                recordId: work.id,
              })
              .from(mutationHistory)
              .innerJoin(
                workRelation,
                eq(workRelation.id, mutationHistory.targetId),
              )
              .innerJoin(work, eq(work.id, workRelation.sourceWorkId))
              .where(
                and(
                  eq(work.projectId, projectId),
                  eq(workRelation.sourceRecordType, "Work"),
                ),
              )
              .orderBy(...ordered)
              .limit(window),
          ]);

        const history: ProjectActivityHistoryFact[] = [];
        const push = (fact: ProjectActivityHistoryFact | null): void => {
          if (fact) {
            history.push(fact);
          }
        };
        const workLabel = (row: { label: string; recordKey: string }) =>
          `${row.recordKey} ${row.label}`;
        for (const row of works) {
          push(
            toFact(
              row.history,
              {
                label: workLabel(row),
                recordId: row.recordId,
                recordType: "Work",
              },
              false,
            ),
          );
        }
        for (const row of relations) {
          push(
            toFact(
              row.history,
              {
                label: workLabel(row),
                recordId: row.recordId,
                recordType: "Work",
              },
              true,
            ),
          );
        }
        const simple: [typeof documents, ProjectActivityRecordType][] = [
          [documents, "Document"],
          [decisions, "Decision"],
          [risks, "Risk"],
        ];
        for (const [rows, recordType] of simple) {
          for (const row of rows) {
            push(
              toFact(
                row.history,
                { label: row.label, recordId: row.recordId, recordType },
                false,
              ),
            );
          }
        }
        const facts: ProjectActivityFacts = {
          history,
          unattributed: [...PROJECT_ACTIVITY_UNATTRIBUTED],
          windowReached: [works, documents, decisions, risks, relations].some(
            (rows) => rows.length >= window,
          ),
        };
        return facts;
      });
    },
  };
}
