import type {
  MutationContract,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  ProductionIncidentConflictError,
  type ProductionIncidentLink,
  type ProductionIncidentLinkTarget,
  type ProductionIncidentLinkType,
  type ProductionIncidentRecord,
  type ProductionIncidentsAccess,
  productionIncidentInputSchema,
  productionIncidentsInputSchema,
  setProductionIncidentLinkInputSchema,
} from "@cantiara/api/production-incidents";
import { productionIncidentRecordSchema } from "@cantiara/api/project-source-records";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import {
  githubExternalRecord,
  githubRepositoryLink,
} from "@cantiara/db/schema/github-integration";
import {
  productionIncident,
  productionIncidentLink,
} from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  bugTarget,
  decisionTarget,
  isBindableBug,
  isBindablePullRequest,
  missingTarget,
  productionIncidentLinkId,
  pullRequestTarget,
  releaseTarget,
  riskTarget,
} from "./production-incidents";

/** The database surface a link write runs on inside the commit barrier. */
export type ProductionIncidentExecutor = Pick<
  Database,
  "delete" | "insert" | "select" | "update"
>;

export interface ProductionIncidentTarget<TValue> {
  find: (
    executor: ProductionIncidentExecutor,
    targetId: string,
    lock: boolean,
  ) => Promise<MutationTarget<TValue> | null>;
  update: (
    executor: ProductionIncidentExecutor,
    input: {
      committedAt: Date;
      expectedRevision: number;
      nextValue: TValue;
      targetId: string;
    },
  ) => Promise<MutationTarget<TValue> | null>;
}

/**
 * Ports: the atomic idempotent Mutation Contract (ADR-0004) and its failure
 * classification, wired by the server root so this feature stays independent
 * of the mutation adapter.
 */
export interface ProductionIncidentPorts {
  mutationContract: <TValue>(
    target: ProductionIncidentTarget<TValue>,
  ) => MutationContract<TValue>;
  mutationFailure: (error: unknown) => "conflict" | "not-found" | null;
}

const CANDIDATE_LIMIT = 500;

interface LinkValue {
  link: {
    attached: boolean;
    incidentId: string;
    projectId: string;
    targetId: string;
    targetType: ProductionIncidentLinkType;
  } | null;
}

function toIncident(row: typeof productionIncident.$inferSelect) {
  return productionIncidentRecordSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    occurredAt: row.occurredAt.toISOString(),
    sourceType: "Production Incident",
    updatedAt: row.updatedAt.toISOString(),
  }) as ProductionIncidentRecord;
}

async function ownedProject(
  executor: ProductionIncidentExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ archivedAt: project.archivedAt, id: project.id })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  const [row] = lock ? await query.for("share", { of: project }) : await query;
  // Writes need an active Project; an archived Project stays readable.
  return row && (!lock || row.archivedAt === null) ? row : null;
}

/** The incident must belong to the founder's Project named in the command. */
async function ownedIncident(
  executor: ProductionIncidentExecutor,
  accountId: string,
  projectId: string,
  incidentId: string,
  lock: boolean,
) {
  const owned = await ownedProject(executor, accountId, projectId, lock);
  if (!owned) {
    return null;
  }
  const query = executor
    .select()
    .from(productionIncident)
    .where(
      and(
        eq(productionIncident.id, incidentId),
        eq(productionIncident.projectId, projectId),
      ),
    )
    .limit(1);
  const [row] = lock ? await query.for("share") : await query;
  return row ? { incident: row, project: owned } : null;
}

/**
 * A bound record is one of the same Project: a live Work of type `Bug`, a live
 * GitHub pull request, a Project Release, a Risk or a Decision.
 */
async function bindableTarget(
  executor: ProductionIncidentExecutor,
  projectId: string,
  type: ProductionIncidentLinkType,
  targetId: string,
) {
  switch (type) {
    case "Bug": {
      const [row] = await executor
        .select({
          archivedAt: work.archivedAt,
          id: work.id,
          key: work.key,
          status: work.status,
          title: work.title,
          trashedAt: work.trashedAt,
          type: work.type,
        })
        .from(work)
        .where(and(eq(work.id, targetId), eq(work.projectId, projectId)))
        .limit(1)
        .for("share");
      return Boolean(row && isBindableBug(row));
    }
    case "GitHub PR": {
      const [row] = await executor
        .select({
          archivedAt: githubExternalRecord.archivedAt,
          id: githubExternalRecord.id,
          kind: githubExternalRecord.kind,
          number: githubExternalRecord.number,
          repository: githubRepositoryLink.name,
          sourceState: githubExternalRecord.sourceState,
          title: githubExternalRecord.title,
          trashedAt: githubExternalRecord.trashedAt,
        })
        .from(githubExternalRecord)
        .innerJoin(
          githubRepositoryLink,
          eq(githubRepositoryLink.id, githubExternalRecord.linkId),
        )
        .where(
          and(
            eq(githubExternalRecord.id, targetId),
            eq(githubExternalRecord.projectId, projectId),
          ),
        )
        .limit(1)
        .for("share", { of: githubExternalRecord });
      return Boolean(row && isBindablePullRequest(row));
    }
    case "Project Release": {
      const [row] = await executor
        .select({ id: projectRelease.id })
        .from(projectRelease)
        .where(
          and(
            eq(projectRelease.id, targetId),
            eq(projectRelease.projectId, projectId),
          ),
        )
        .limit(1)
        .for("share");
      return Boolean(row);
    }
    case "Risk": {
      const [row] = await executor
        .select({ id: risk.id })
        .from(risk)
        .where(and(eq(risk.id, targetId), eq(risk.projectId, projectId)))
        .limit(1)
        .for("share");
      return Boolean(row);
    }
    case "Decision": {
      const [row] = await executor
        .select({ id: decision.id })
        .from(decision)
        .where(
          and(eq(decision.id, targetId), eq(decision.projectId, projectId)),
        )
        .limit(1)
        .for("share");
      return Boolean(row);
    }
    default:
      return false;
  }
}

function targetColumns(type: ProductionIncidentLinkType, targetId: string) {
  return {
    decisionId: type === "Decision" ? targetId : null,
    githubRecordId: type === "GitHub PR" ? targetId : null,
    releaseId: type === "Project Release" ? targetId : null,
    riskId: type === "Risk" ? targetId : null,
    workId: type === "Bug" ? targetId : null,
  };
}

function linkTargetId(row: typeof productionIncidentLink.$inferSelect) {
  return (
    row.workId ??
    row.githubRecordId ??
    row.releaseId ??
    row.riskId ??
    row.decisionId ??
    ""
  );
}

function linkTarget(
  accountId: string,
  input: NonNullable<LinkValue["link"]>,
): ProductionIncidentTarget<LinkValue> {
  async function allowed(
    executor: ProductionIncidentExecutor,
    value: NonNullable<LinkValue["link"]>,
    lock: boolean,
  ) {
    const owned = await ownedIncident(
      executor,
      accountId,
      value.projectId,
      value.incidentId,
      lock,
    );
    if (!owned) {
      return false;
    }
    // Unbinding never needs the target to still exist or stay bindable.
    return (
      !value.attached ||
      (await bindableTarget(
        executor,
        value.projectId,
        value.targetType,
        value.targetId,
      ))
    );
  }
  return {
    async find(executor, targetId, lock) {
      if (!(await allowed(executor, input, lock))) {
        return null;
      }
      const query = executor
        .select()
        .from(productionIncidentLink)
        .where(
          and(
            eq(productionIncidentLink.id, targetId),
            eq(productionIncidentLink.projectId, input.projectId),
            eq(productionIncidentLink.incidentId, input.incidentId),
          ),
        )
        .limit(1);
      const [row] = lock ? await query.for("update") : await query;
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: {
          link: row
            ? {
                attached: row.removedAt === null,
                incidentId: row.incidentId,
                projectId: row.projectId,
                targetId: linkTargetId(row),
                targetType: row.targetType as ProductionIncidentLinkType,
              }
            : null,
        },
      };
    },
    async update(executor, update) {
      const value = update.nextValue.link;
      if (!(value && (await allowed(executor, value, true)))) {
        return null;
      }
      const values = {
        removedAt: value.attached ? null : update.committedAt,
        revision: update.expectedRevision + 1,
      };
      const [row] =
        update.expectedRevision === 0
          ? await executor
              .insert(productionIncidentLink)
              .values({
                ...values,
                ...targetColumns(value.targetType, value.targetId),
                createdAt: update.committedAt,
                id: update.targetId,
                incidentId: value.incidentId,
                projectId: value.projectId,
                targetType: value.targetType,
              })
              .onConflictDoNothing()
              .returning()
          : await executor
              .update(productionIncidentLink)
              .set(values)
              .where(
                and(
                  eq(productionIncidentLink.id, update.targetId),
                  eq(productionIncidentLink.projectId, value.projectId),
                  eq(productionIncidentLink.revision, update.expectedRevision),
                ),
              )
              .returning();
      return row
        ? { id: row.id, revision: row.revision, value: { link: value } }
        : null;
    },
  };
}

/** Read-only facts of the bound records, resolved per type in one query each. */
async function resolveTargets(
  executor: ProductionIncidentExecutor,
  projectId: string,
  links: readonly (typeof productionIncidentLink.$inferSelect)[],
) {
  const idsOf = (type: ProductionIncidentLinkType) =>
    links.filter((link) => link.targetType === type).map(linkTargetId);
  const resolved = new Map<string, ProductionIncidentLinkTarget>();
  const key = (type: ProductionIncidentLinkType, id: string) => `${type}:${id}`;

  const bugIds = idsOf("Bug");
  if (bugIds.length) {
    const rows = await executor
      .select({
        archivedAt: work.archivedAt,
        id: work.id,
        key: work.key,
        status: work.status,
        title: work.title,
        trashedAt: work.trashedAt,
        type: work.type,
      })
      .from(work)
      .where(and(eq(work.projectId, projectId), inArray(work.id, bugIds)));
    for (const row of rows) {
      resolved.set(key("Bug", row.id), bugTarget(row));
    }
  }
  const pullIds = idsOf("GitHub PR");
  if (pullIds.length) {
    const rows = await executor
      .select({
        archivedAt: githubExternalRecord.archivedAt,
        id: githubExternalRecord.id,
        kind: githubExternalRecord.kind,
        number: githubExternalRecord.number,
        repository: githubRepositoryLink.name,
        sourceState: githubExternalRecord.sourceState,
        title: githubExternalRecord.title,
        trashedAt: githubExternalRecord.trashedAt,
      })
      .from(githubExternalRecord)
      .innerJoin(
        githubRepositoryLink,
        eq(githubRepositoryLink.id, githubExternalRecord.linkId),
      )
      .where(
        and(
          eq(githubExternalRecord.projectId, projectId),
          inArray(githubExternalRecord.id, pullIds),
        ),
      );
    for (const row of rows) {
      resolved.set(key("GitHub PR", row.id), pullRequestTarget(row));
    }
  }
  const releaseIds = idsOf("Project Release");
  if (releaseIds.length) {
    const rows = await executor
      .select({
        id: projectRelease.id,
        name: projectRelease.name,
        status: projectRelease.status,
      })
      .from(projectRelease)
      .where(
        and(
          eq(projectRelease.projectId, projectId),
          inArray(projectRelease.id, releaseIds),
        ),
      );
    for (const row of rows) {
      resolved.set(key("Project Release", row.id), releaseTarget(row));
    }
  }
  const riskIds = idsOf("Risk");
  if (riskIds.length) {
    const rows = await executor
      .select({ id: risk.id, life: risk.life, title: risk.title })
      .from(risk)
      .where(and(eq(risk.projectId, projectId), inArray(risk.id, riskIds)));
    for (const row of rows) {
      resolved.set(key("Risk", row.id), riskTarget(row));
    }
  }
  const decisionIds = idsOf("Decision");
  if (decisionIds.length) {
    const rows = await executor
      .select({
        id: decision.id,
        life: decision.life,
        title: decision.title,
      })
      .from(decision)
      .where(
        and(
          eq(decision.projectId, projectId),
          inArray(decision.id, decisionIds),
        ),
      );
    for (const row of rows) {
      resolved.set(key("Decision", row.id), decisionTarget(row));
    }
  }
  return (type: ProductionIncidentLinkType, id: string) =>
    resolved.get(key(type, id)) ?? missingTarget(type, id);
}

async function candidates(
  executor: ProductionIncidentExecutor,
  projectId: string,
): Promise<ProductionIncidentLinkTarget[]> {
  const [bugs, pulls, releases, risks, decisions] = await Promise.all([
    executor
      .select({
        archivedAt: work.archivedAt,
        id: work.id,
        key: work.key,
        status: work.status,
        title: work.title,
        trashedAt: work.trashedAt,
        type: work.type,
      })
      .from(work)
      .where(
        and(
          eq(work.projectId, projectId),
          eq(work.type, "Bug"),
          isNull(work.archivedAt),
          isNull(work.trashedAt),
        ),
      )
      .orderBy(desc(work.number))
      .limit(CANDIDATE_LIMIT),
    executor
      .select({
        archivedAt: githubExternalRecord.archivedAt,
        id: githubExternalRecord.id,
        kind: githubExternalRecord.kind,
        number: githubExternalRecord.number,
        repository: githubRepositoryLink.name,
        sourceState: githubExternalRecord.sourceState,
        title: githubExternalRecord.title,
        trashedAt: githubExternalRecord.trashedAt,
      })
      .from(githubExternalRecord)
      .innerJoin(
        githubRepositoryLink,
        eq(githubRepositoryLink.id, githubExternalRecord.linkId),
      )
      .where(
        and(
          eq(githubExternalRecord.projectId, projectId),
          eq(githubExternalRecord.kind, "Pull request"),
          isNull(githubExternalRecord.archivedAt),
          isNull(githubExternalRecord.trashedAt),
        ),
      )
      .orderBy(desc(githubExternalRecord.sourceUpdatedAt))
      .limit(CANDIDATE_LIMIT),
    executor
      .select({
        id: projectRelease.id,
        name: projectRelease.name,
        status: projectRelease.status,
      })
      .from(projectRelease)
      .where(eq(projectRelease.projectId, projectId))
      .orderBy(asc(projectRelease.name), asc(projectRelease.id))
      .limit(CANDIDATE_LIMIT),
    executor
      .select({ id: risk.id, life: risk.life, title: risk.title })
      .from(risk)
      .where(eq(risk.projectId, projectId))
      .orderBy(asc(risk.title), asc(risk.id))
      .limit(CANDIDATE_LIMIT),
    executor
      .select({
        id: decision.id,
        life: decision.life,
        title: decision.title,
      })
      .from(decision)
      .where(eq(decision.projectId, projectId))
      .orderBy(asc(decision.title), asc(decision.id))
      .limit(CANDIDATE_LIMIT),
  ]);
  return [
    ...bugs.map(bugTarget),
    ...pulls.map(pullRequestTarget),
    ...releases.map(releaseTarget),
    ...risks.map(riskTarget),
    ...decisions.map(decisionTarget),
  ];
}

export function createDatabaseProductionIncidents(
  database: Database,
  ports: ProductionIncidentPorts,
): ProductionIncidentsAccess {
  async function commit<TValue>(
    target: ProductionIncidentTarget<TValue>,
    input: {
      accountId: string;
      baseRevision: number;
      clientIdempotencyKey: string;
      payload: Record<string, string | boolean | null>;
      targetId: string;
    },
    next: (current: TValue) => TValue,
  ) {
    try {
      return await ports.mutationContract(target).mutate(
        {
          actor: { actorId: input.accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: input.payload,
          targetId: input.targetId,
        },
        ({ currentValue }) => next(currentValue),
      );
    } catch (error) {
      for (
        let cause: unknown = error;
        cause instanceof Error;
        { cause } = cause
      ) {
        if (cause instanceof ProductionIncidentConflictError) {
          throw cause;
        }
      }
      const kind = ports.mutationFailure(error);
      if (kind === "not-found") {
        return null;
      }
      if (kind === "conflict") {
        throw new ProductionIncidentConflictError(input.targetId, {
          cause: error,
        });
      }
      throw error;
    }
  }

  return {
    async setLink(accountId, rawInput) {
      const input = setProductionIncidentLinkInputSchema.parse(rawInput);
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      // The row id comes from the full payload, so an identical add reuses it.
      const id = await productionIncidentLinkId(input);
      const receipt = await commit(
        linkTarget(accountId, payload),
        {
          accountId,
          baseRevision,
          clientIdempotencyKey,
          payload,
          targetId: id,
        },
        (current) => {
          if (!(current.link || input.attached)) {
            throw new ProductionIncidentConflictError(id);
          }
          return { link: payload };
        },
      );
      const value = receipt?.nextValue.link;
      if (!(receipt && value)) {
        return null;
      }
      const [row] = await database
        .select()
        .from(productionIncidentLink)
        .where(eq(productionIncidentLink.id, id))
        .limit(1);
      const target = row
        ? (await resolveTargets(database, input.projectId, [row]))(
            value.targetType,
            value.targetId,
          )
        : missingTarget(value.targetType, value.targetId);
      return {
        attached: value.attached,
        id,
        revision: receipt.revision,
        target,
      } satisfies ProductionIncidentLink;
    },

    async overview(accountId, projectId) {
      const input = productionIncidentsInputSchema.parse({ projectId });
      const owned = await ownedProject(
        database,
        accountId,
        input.projectId,
        false,
      );
      if (!owned) {
        return null;
      }
      const [incidents, links] = await Promise.all([
        database
          .select()
          .from(productionIncident)
          .where(eq(productionIncident.projectId, input.projectId))
          .orderBy(
            desc(productionIncident.occurredAt),
            asc(productionIncident.id),
          ),
        database
          .select({
            incidentId: productionIncidentLink.incidentId,
            removedAt: productionIncidentLink.removedAt,
          })
          .from(productionIncidentLink)
          .where(eq(productionIncidentLink.projectId, input.projectId)),
      ]);
      return {
        incidents: incidents.map((row) => ({
          incident: toIncident(row),
          linkCount: links.filter(
            (link) => link.incidentId === row.id && link.removedAt === null,
          ).length,
        })),
        readOnly: owned.archivedAt !== null,
      };
    },

    detail(accountId, rawInput) {
      const input = productionIncidentInputSchema.parse(rawInput);
      // One snapshot keeps the links and the current target statuses consistent.
      return database.transaction(
        async (executor) => {
          const owned = await ownedIncident(
            executor,
            accountId,
            input.projectId,
            input.incidentId,
            false,
          );
          if (!owned) {
            return null;
          }
          const rows = await executor
            .select()
            .from(productionIncidentLink)
            .where(
              and(
                eq(productionIncidentLink.projectId, input.projectId),
                eq(productionIncidentLink.incidentId, input.incidentId),
              ),
            )
            .orderBy(
              asc(productionIncidentLink.createdAt),
              asc(productionIncidentLink.id),
            );
          const resolve = await resolveTargets(executor, input.projectId, rows);
          return {
            candidates: owned.project.archivedAt
              ? []
              : await candidates(executor, input.projectId),
            incident: toIncident(owned.incident),
            links: rows.map((row) => ({
              attached: row.removedAt === null,
              id: row.id,
              revision: row.revision,
              target: resolve(
                row.targetType as ProductionIncidentLinkType,
                linkTargetId(row),
              ),
            })),
            readOnly: owned.project.archivedAt !== null,
          };
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },
  };
}
