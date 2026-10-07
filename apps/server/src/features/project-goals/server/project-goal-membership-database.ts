import {
  ProjectGoalConflictError,
  type ProjectGoalDetail,
  type ProjectGoalMembershipAccess,
  type ProjectGoalRelation,
  type ProjectGoalRelationInput,
  type ProjectGoalSource,
  projectGoalRelationInputSchema,
} from "@cantiara/api/project-goals";
import type { RelationRecordType } from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectGoalRelation } from "@cantiara/db/schema/project-goal-relation";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { workRelation } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { ownedProject } from "./project-goal-access";

type StoredRelation = typeof projectGoalRelation.$inferSelect;
interface RelationValue {
  relation: {
    projectId: string;
    goalId: string;
    memberId: string;
    memberType: RelationRecordType;
    kind: "Related" | "Contributes to Goal";
    attached: boolean;
  } | null;
}

function sourceKey(source: Pick<ProjectGoalSource, "recordType" | "recordId">) {
  return JSON.stringify([source.recordType, source.recordId]);
}
async function relationId(input: ProjectGoalRelationInput) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      input.projectId,
      input.goalId,
      input.kind,
      input.memberType,
      input.memberId,
    ]),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `goal-relation:${Buffer.from(digest).toString("hex")}`;
}
function sourcePath(projectId: string, type: RelationRecordType, id: string) {
  const prefixes: Partial<Record<RelationRecordType, string>> = {
    Work: "work-",
    Milestone: "source-milestone-",
    "Project Release": "source-project-release-",
    Risk: "source-risk-",
    "Open Question": "source-open-question-",
  };
  const prefix = prefixes[type];
  return prefix
    ? `/projects/${encodeURIComponent(projectId)}#${prefix}${encodeURIComponent(id)}`
    : null;
}
async function sources(executor: MutationDatabaseExecutor, projectId: string) {
  const [works, milestones, releases, risks, questions] = await Promise.all([
    executor
      .select()
      .from(work)
      .where(eq(work.projectId, projectId))
      .orderBy(asc(work.number)),
    executor
      .select()
      .from(projectMilestone)
      .where(eq(projectMilestone.projectId, projectId))
      .orderBy(asc(projectMilestone.title)),
    executor
      .select()
      .from(projectRelease)
      .where(eq(projectRelease.projectId, projectId))
      .orderBy(asc(projectRelease.name)),
    executor
      .select()
      .from(risk)
      .where(eq(risk.projectId, projectId))
      .orderBy(asc(risk.title)),
    executor
      .select()
      .from(openQuestion)
      .where(eq(openQuestion.projectId, projectId))
      .orderBy(asc(openQuestion.title)),
  ]);
  const result: ProjectGoalSource[] = [];
  function add(
    recordType: RelationRecordType,
    recordId: string,
    title: string,
    status: string,
    workType: string | null = null,
    unavailable = false,
  ) {
    result.push({
      recordType,
      recordId,
      title: unavailable ? null : title,
      status: unavailable ? null : status,
      workType,
      openPath: sourcePath(projectId, recordType, recordId),
      unavailable,
    });
  }
  for (const row of works) {
    add(
      "Work",
      row.id,
      row.title,
      row.status,
      row.type,
      !!(row.archivedAt || row.trashedAt),
    );
  }
  for (const row of milestones) {
    add("Milestone", row.id, row.title, row.status);
  }
  for (const row of releases) {
    add("Project Release", row.id, row.name, row.status);
  }
  for (const row of risks) {
    add("Risk", row.id, row.title, row.life);
  }
  for (const row of questions) {
    add("Open Question", row.id, row.title, row.life);
  }
  return result;
}
function relationView(
  row: StoredRelation,
  records: readonly ProjectGoalSource[],
): ProjectGoalRelation {
  const source = records.find(
    (record) =>
      record.recordId === row.memberId && record.recordType === row.memberType,
  ) ?? {
    recordId: row.memberId,
    recordType: row.memberType as RelationRecordType,
    title: null,
    status: null,
    workType: null,
    openPath: null,
    unavailable: true,
  };
  return {
    id: row.id,
    kind: row.kind as ProjectGoalRelation["kind"],
    revision: row.revision,
    attached: row.removedAt === null,
    source,
  };
}
async function ownedGoal(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  id: string,
  lock: boolean,
) {
  const owned = await ownedProject(executor, accountId, projectId, lock);
  if (!owned) {
    return null;
  }
  const query = executor
    .select({ id: projectGoal.id })
    .from(projectGoal)
    .where(and(eq(projectGoal.id, id), eq(projectGoal.projectId, projectId)))
    .limit(1);
  const [goal] = lock ? await query.for("update") : await query;
  return goal ? owned : null;
}
function target(
  accountId: string,
  input: ProjectGoalRelationInput,
): MutationDatabaseTargetAdapter<RelationValue> {
  return {
    async find(executor, targetId, lock) {
      if (
        !(await ownedGoal(
          executor,
          accountId,
          input.projectId,
          input.goalId,
          lock,
        ))
      ) {
        return null;
      }
      if (
        input.attached &&
        !(await sources(executor, input.projectId)).some(
          (candidate) =>
            candidate.recordType === input.memberType &&
            candidate.recordId === input.memberId &&
            !candidate.unavailable,
        )
      ) {
        return null;
      }
      const query = executor
        .select()
        .from(projectGoalRelation)
        .where(
          and(
            eq(projectGoalRelation.id, targetId),
            eq(projectGoalRelation.projectId, input.projectId),
          ),
        )
        .limit(1);
      const [row] = lock ? await query.for("update") : await query;
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: {
          relation: row
            ? {
                projectId: row.projectId,
                goalId: row.goalId,
                memberId: row.memberId,
                memberType: row.memberType as RelationRecordType,
                kind: row.kind as "Related" | "Contributes to Goal",
                attached: row.removedAt === null,
              }
            : null,
        },
      };
    },
    async update(executor, update) {
      const value = update.nextValue.relation;
      if (
        !(
          value &&
          (await ownedGoal(
            executor,
            accountId,
            value.projectId,
            value.goalId,
            true,
          ))
        )
      ) {
        return null;
      }
      if (value.attached) {
        const tables = {
          Work: work,
          Milestone: projectMilestone,
          "Project Release": projectRelease,
          Risk: risk,
          "Open Question": openQuestion,
        };
        const table = tables[value.memberType as keyof typeof tables];
        if (!table) {
          return null;
        }
        const [locked] = await executor
          .select({ id: table.id })
          .from(table)
          .where(
            and(
              eq(table.id, value.memberId),
              eq(table.projectId, value.projectId),
            ),
          )
          .for("share");
        if (!locked) {
          return null;
        }
        const record = (await sources(executor, value.projectId)).find(
          (candidate) =>
            candidate.recordType === value.memberType &&
            candidate.recordId === value.memberId &&
            !candidate.unavailable,
        );
        if (!record) {
          return null;
        }
      }
      const { attached, ...identity } = value;
      const values = {
        removedAt: attached ? null : update.committedAt,
        revision: update.expectedRevision + 1,
      };
      const [row] =
        update.expectedRevision === 0
          ? await executor
              .insert(projectGoalRelation)
              .values({
                ...identity,
                ...values,
                id: update.targetId,
                createdAt: update.committedAt,
              })
              .onConflictDoNothing()
              .returning()
          : await executor
              .update(projectGoalRelation)
              .set(values)
              .where(
                and(
                  eq(projectGoalRelation.id, update.targetId),
                  eq(projectGoalRelation.revision, update.expectedRevision),
                ),
              )
              .returning();
      return row
        ? { id: row.id, revision: row.revision, value: { relation: value } }
        : null;
    },
  };
}
function statusDistribution(contributors: Iterable<ProjectGoalSource>) {
  const statusMix: ProjectGoalDetail["statusMix"] = [];
  for (const source of contributors) {
    let type: "Research" | "Feature" | "Milestone" | null = null;
    if (source.recordType === "Milestone") {
      type = "Milestone";
    } else if (
      source.recordType === "Work" &&
      (source.workType === "Research" || source.workType === "Feature")
    ) {
      type = source.workType;
    }
    if (!(type && source.status)) {
      continue;
    }
    const bucket = statusMix.find(
      (row) => row.recordType === type && row.status === source.status,
    );
    if (bucket) {
      bucket.count += 1;
    } else {
      statusMix.push({
        recordType: type,
        status: source.status,
        count: 1,
      });
    }
  }
  return statusMix;
}
function isOpenUncertainty(source: ProjectGoalSource) {
  if (source.unavailable) {
    return false;
  }
  if (source.recordType === "Risk") {
    return ["Open", "Mitigating", "Occurred"].includes(source.status ?? "");
  }
  return source.recordType === "Open Question" && source.status === "Open";
}
export function createDatabaseProjectGoalMembership(
  database: Database,
): ProjectGoalMembershipAccess {
  return {
    async setRelation(accountId, rawInput) {
      const input = projectGoalRelationInputSchema.parse(rawInput);
      const id = await relationId(input);
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      const mutation = createDatabaseMutationContract<RelationValue>(database, {
        target: target(accountId, input),
      });
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            kind: "human",
            targetId: id,
            baseRevision,
            clientIdempotencyKey,
            payload,
          },
          ({ currentValue }) => {
            if (!(currentValue.relation || input.attached)) {
              throw new MutationConflictError(id);
            }
            return {
              relation: {
                projectId: input.projectId,
                goalId: input.goalId,
                memberId: input.memberId,
                memberType: input.memberType,
                kind: input.kind,
                attached: input.attached,
              },
            };
          },
        );
        const value = receipt.nextValue.relation;
        return value
          ? relationView(
              {
                ...value,
                id,
                revision: receipt.revision,
                createdAt: new Date(receipt.committedAt),
                removedAt: value.attached
                  ? null
                  : new Date(receipt.committedAt),
              },
              await sources(database, input.projectId),
            )
          : null;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          throw new ProjectGoalConflictError(
            "Membership changed. Reload before saving.",
            { cause: error },
          );
        }
        throw error;
      }
    },
    detail(accountId, input) {
      // A single snapshot keeps the membership and its current source statuses consistent.
      return database.transaction(
        async (executor) => {
          const owned = await ownedGoal(
            executor,
            accountId,
            input.projectId,
            input.id,
            false,
          );
          if (!owned) {
            return null;
          }
          const records = await sources(executor, input.projectId);
          const rows = await executor
            .select()
            .from(projectGoalRelation)
            .where(
              and(
                eq(projectGoalRelation.projectId, input.projectId),
                eq(projectGoalRelation.goalId, input.id),
              ),
            )
            .orderBy(
              asc(projectGoalRelation.createdAt),
              asc(projectGoalRelation.id),
            );
          const relations = rows.map((row) => relationView(row, records));
          const contributors = new Map(
            relations
              .filter(
                (row) =>
                  row.attached &&
                  row.kind === "Contributes to Goal" &&
                  !row.source.unavailable,
              )
              .map((row) => [sourceKey(row.source), row.source]),
          );
          const statusMix = statusDistribution(contributors.values());
          const related = new Set(
            relations
              .filter((row) => row.attached && row.kind === "Related")
              .map((row) => sourceKey(row.source)),
          );
          const contributingWorkIds = [...contributors.values()]
            .filter((row) => row.recordType === "Work")
            .map((row) => row.recordId);
          if (contributingWorkIds.length) {
            const links = await executor
              .select()
              .from(workRelation)
              .where(
                and(
                  eq(workRelation.kind, "Related"),
                  eq(workRelation.sourceRecordType, "Work"),
                  eq(workRelation.targetProjectId, input.projectId),
                  inArray(workRelation.sourceWorkId, contributingWorkIds),
                  isNull(workRelation.deletedAt),
                  isNull(workRelation.brokenReason),
                ),
              );
            for (const link of links) {
              related.add(
                sourceKey({
                  recordType: link.targetRecordType as RelationRecordType,
                  recordId: link.targetRecordId,
                }),
              );
            }
          }
          return {
            relations,
            candidates: records.filter((row) => !row.unavailable),
            statusMix,
            openQuestionsAndRisks: records.filter(
              (source) =>
                related.has(sourceKey(source)) && isOpenUncertainty(source),
            ),
            readOnly: owned.archivedAt !== null,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
