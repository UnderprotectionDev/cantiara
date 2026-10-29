import type {
  MutationContract,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  isTerminalProjectReleaseStatus,
  type ProjectReleaseAudienceLink,
  type ProjectReleaseAudienceTarget,
  type ProjectReleaseAudienceType,
  type ProjectReleaseLink,
  type ProjectReleaseLinkKind,
  type ProjectReleasePlanningAccess,
  ProjectReleasePlanningConflictError,
  type ProjectReleaseRecord,
  type ProjectReleaseRepository,
  type ProjectReleaseScopeMember,
  type ProjectReleaseWork,
  projectReleasePlanningInputSchema,
  projectReleasePlanningProjectInputSchema,
  projectReleaseScopeCounts,
  projectReleaseStatusSuggestion,
  setProjectReleaseAudienceInputSchema,
  setProjectReleaseLinkInputSchema,
  setProjectReleaseScopeInputSchema,
} from "@cantiara/api/project-release-planning";
import { projectReleaseRecordSchema } from "@cantiara/api/project-source-records";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  workspaceCompany,
  workspaceContact,
} from "@cantiara/db/schema/contact";
import { document } from "@cantiara/db/schema/document";
import { githubRepositoryLink } from "@cantiara/db/schema/github-integration";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  projectReleaseAudience,
  projectReleaseLink,
  projectReleaseScope,
} from "@cantiara/db/schema/project-release-planning";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull, or, type SQL } from "drizzle-orm";

/** The database surface a planning write runs on inside the commit barrier. */
export type ProjectReleasePlanningExecutor = Pick<
  Database,
  "delete" | "insert" | "select" | "update"
>;

export interface ProjectReleasePlanningTarget<TValue> {
  find: (
    executor: ProjectReleasePlanningExecutor,
    targetId: string,
    lock: boolean,
  ) => Promise<MutationTarget<TValue> | null>;
  update: (
    executor: ProjectReleasePlanningExecutor,
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
export interface ProjectReleasePlanningPorts {
  mutationContract: <TValue>(
    target: ProjectReleasePlanningTarget<TValue>,
  ) => MutationContract<TValue>;
  mutationFailure: (error: unknown) => "conflict" | "not-found" | null;
}

type WorkRow = Pick<
  typeof work.$inferSelect,
  | "archivedAt"
  | "closureResult"
  | "id"
  | "key"
  | "status"
  | "title"
  | "trashedAt"
  | "type"
>;

const workColumns = {
  archivedAt: work.archivedAt,
  closureResult: work.closureResult,
  id: work.id,
  key: work.key,
  status: work.status,
  title: work.title,
  trashedAt: work.trashedAt,
  type: work.type,
};

function toWork(row: WorkRow): ProjectReleaseWork {
  const unavailable = Boolean(row.archivedAt || row.trashedAt);
  return {
    closureResult: row.closureResult,
    id: row.id,
    key: row.key,
    status: row.status,
    title: unavailable ? null : row.title,
    type: row.type,
    unavailable,
  };
}

function toRelease(row: typeof projectRelease.$inferSelect) {
  return projectReleaseRecordSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    sourceType: "Project Release",
    updatedAt: row.updatedAt.toISOString(),
  }) as ProjectReleaseRecord;
}

async function stableId(kind: string, parts: readonly string[]) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(parts)),
  );
  return `${kind}:${Buffer.from(digest).toString("hex")}`;
}

async function ownedProject(
  executor: ProjectReleasePlanningExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({
      archivedAt: project.archivedAt,
      id: project.id,
      workspaceId: project.workspaceId,
    })
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

/** The release must belong to the founder's Project named in the command. */
async function ownedRelease(
  executor: ProjectReleasePlanningExecutor,
  accountId: string,
  projectId: string,
  releaseId: string,
  lock: boolean,
) {
  const owned = await ownedProject(executor, accountId, projectId, lock);
  if (!owned) {
    return null;
  }
  const query = executor
    .select()
    .from(projectRelease)
    .where(
      and(
        eq(projectRelease.id, releaseId),
        eq(projectRelease.projectId, projectId),
      ),
    )
    .limit(1);
  const [release] = lock ? await query.for("share") : await query;
  return release ? { project: owned, release } : null;
}

/**
 * A planning write locks the release and needs it open: `Published` and
 * `Cancelled` freeze scope, references and audience links. The release row
 * share lock serializes this check with an explicit status change.
 */
async function plannableRelease(
  executor: ProjectReleasePlanningExecutor,
  accountId: string,
  projectId: string,
  releaseId: string,
) {
  const owned = await ownedRelease(
    executor,
    accountId,
    projectId,
    releaseId,
    true,
  );
  if (
    owned &&
    isTerminalProjectReleaseStatus(
      owned.release.status as ProjectReleaseRecord["status"],
    )
  ) {
    throw new ProjectReleasePlanningConflictError(releaseId);
  }
  return owned;
}

/** Scope members are Work of the same Project that is neither archived nor trashed. */
async function availableWork(
  executor: ProjectReleasePlanningExecutor,
  projectId: string,
  workId: string,
  lock: boolean,
) {
  const query = executor
    .select({ id: work.id })
    .from(work)
    .where(
      and(
        eq(work.id, workId),
        eq(work.projectId, projectId),
        isNull(work.archivedAt),
        isNull(work.trashedAt),
      ),
    )
    .limit(1);
  const [row] = lock ? await query.for("share") : await query;
  return row ?? null;
}

async function activeRepository(
  executor: ProjectReleasePlanningExecutor,
  projectId: string,
  repositoryLinkId: string,
) {
  const [row] = await executor
    .select({ id: githubRepositoryLink.id })
    .from(githubRepositoryLink)
    .where(
      and(
        eq(githubRepositoryLink.id, repositoryLinkId),
        eq(githubRepositoryLink.projectId, projectId),
        isNull(githubRepositoryLink.disconnectedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

function personaScope(projectId: string, workspaceId: string): SQL {
  return and(
    eq(document.type, "Persona"),
    isNull(document.archivedAt),
    isNull(document.trashedAt),
    or(
      eq(document.projectId, projectId),
      eq(document.workspaceId, workspaceId),
    ),
  ) as SQL;
}

async function audienceTargets(
  executor: ProjectReleasePlanningExecutor,
  projectId: string,
  workspaceId: string,
  only?: { type: ProjectReleaseAudienceType; id: string },
) {
  const result: ProjectReleaseAudienceTarget[] = [];
  if (!only || only.type === "Persona") {
    const rows = await executor
      .select({ id: document.id, title: document.title })
      .from(document)
      .where(
        and(
          personaScope(projectId, workspaceId),
          only ? eq(document.id, only.id) : undefined,
        ),
      )
      .orderBy(asc(document.title), asc(document.id));
    result.push(...rows.map((row) => ({ ...row, type: "Persona" as const })));
  }
  if (!only || only.type === "Contact") {
    const rows = await executor
      .select({ id: workspaceContact.id, title: workspaceContact.displayName })
      .from(workspaceContact)
      .where(
        and(
          eq(workspaceContact.workspaceId, workspaceId),
          isNull(workspaceContact.archivedAt),
          only ? eq(workspaceContact.id, only.id) : undefined,
        ),
      )
      .orderBy(asc(workspaceContact.displayName), asc(workspaceContact.id));
    result.push(
      ...rows.map((row) => ({
        id: row.id,
        title: row.title ?? "Unnamed Contact",
        type: "Contact" as const,
      })),
    );
  }
  if (!only || only.type === "Company") {
    const rows = await executor
      .select({ id: workspaceCompany.id, title: workspaceCompany.name })
      .from(workspaceCompany)
      .where(
        and(
          eq(workspaceCompany.workspaceId, workspaceId),
          isNull(workspaceCompany.archivedAt),
          only ? eq(workspaceCompany.id, only.id) : undefined,
        ),
      )
      .orderBy(asc(workspaceCompany.name), asc(workspaceCompany.id));
    result.push(...rows.map((row) => ({ ...row, type: "Company" as const })));
  }
  return result;
}

interface ScopeValue {
  scope: {
    attached: boolean;
    projectId: string;
    releaseId: string;
    workId: string;
  } | null;
}

function scopeTarget(
  accountId: string,
  input: { projectId: string; releaseId: string; workId: string },
  attaching: boolean,
): ProjectReleasePlanningTarget<ScopeValue> {
  return {
    async find(executor, targetId, lock) {
      const owned = await ownedRelease(
        executor,
        accountId,
        input.projectId,
        input.releaseId,
        lock,
      );
      if (
        !owned ||
        (attaching &&
          !(await availableWork(executor, input.projectId, input.workId, lock)))
      ) {
        return null;
      }
      const query = executor
        .select()
        .from(projectReleaseScope)
        .where(
          and(
            eq(projectReleaseScope.id, targetId),
            eq(projectReleaseScope.projectId, input.projectId),
          ),
        )
        .limit(1);
      const [row] = lock ? await query.for("update") : await query;
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: {
          scope: row
            ? {
                attached: row.removedAt === null,
                projectId: row.projectId,
                releaseId: row.releaseId,
                workId: row.workId,
              }
            : null,
        },
      };
    },
    async update(executor, update) {
      const value = update.nextValue.scope;
      if (
        !(
          value &&
          (await plannableRelease(
            executor,
            accountId,
            value.projectId,
            value.releaseId,
          ))
        ) ||
        (value.attached &&
          !(await availableWork(executor, value.projectId, value.workId, true)))
      ) {
        return null;
      }
      const values = {
        removedAt: value.attached ? null : update.committedAt,
        revision: update.expectedRevision + 1,
      };
      const [row] =
        update.expectedRevision === 0
          ? await executor
              .insert(projectReleaseScope)
              .values({
                ...values,
                createdAt: update.committedAt,
                id: update.targetId,
                projectId: value.projectId,
                releaseId: value.releaseId,
                workId: value.workId,
              })
              .onConflictDoNothing()
              .returning()
          : await executor
              .update(projectReleaseScope)
              .set(values)
              .where(
                and(
                  eq(projectReleaseScope.id, update.targetId),
                  eq(projectReleaseScope.revision, update.expectedRevision),
                ),
              )
              .returning();
      return row
        ? { id: row.id, revision: row.revision, value: { scope: value } }
        : null;
    },
  };
}

interface LinkValue {
  link: {
    attached: boolean;
    kind: ProjectReleaseLinkKind;
    label: string;
    projectId: string;
    releaseId: string;
    repositoryLinkId: string | null;
    url: string | null;
  } | null;
}

function linkTarget(
  accountId: string,
  input: LinkValue["link"] & object,
): ProjectReleasePlanningTarget<LinkValue> {
  async function allowed(
    executor: ProjectReleasePlanningExecutor,
    value: NonNullable<LinkValue["link"]>,
    lock: boolean,
    write = false,
  ) {
    const owned = write
      ? await plannableRelease(
          executor,
          accountId,
          value.projectId,
          value.releaseId,
        )
      : await ownedRelease(
          executor,
          accountId,
          value.projectId,
          value.releaseId,
          lock,
        );
    if (!owned) {
      return false;
    }
    // A reference names only a repository linked to the same Project.
    return !(
      value.attached &&
      value.repositoryLinkId &&
      !(await activeRepository(
        executor,
        value.projectId,
        value.repositoryLinkId,
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
        .from(projectReleaseLink)
        .where(
          and(
            eq(projectReleaseLink.id, targetId),
            eq(projectReleaseLink.projectId, input.projectId),
            eq(projectReleaseLink.releaseId, input.releaseId),
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
                kind: row.kind as ProjectReleaseLinkKind,
                label: row.label,
                projectId: row.projectId,
                releaseId: row.releaseId,
                repositoryLinkId: row.repositoryLinkId,
                url: row.url,
              }
            : null,
        },
      };
    },
    async update(executor, update) {
      const value = update.nextValue.link;
      if (!(value && (await allowed(executor, value, true, true)))) {
        return null;
      }
      const values = {
        kind: value.kind,
        label: value.label,
        removedAt: value.attached ? null : update.committedAt,
        repositoryLinkId: value.repositoryLinkId,
        revision: update.expectedRevision + 1,
        url: value.url,
      };
      const [row] =
        update.expectedRevision === 0
          ? await executor
              .insert(projectReleaseLink)
              .values({
                ...values,
                createdAt: update.committedAt,
                id: update.targetId,
                projectId: value.projectId,
                releaseId: value.releaseId,
              })
              .onConflictDoNothing()
              .returning()
          : await executor
              .update(projectReleaseLink)
              .set(values)
              .where(
                and(
                  eq(projectReleaseLink.id, update.targetId),
                  eq(projectReleaseLink.projectId, value.projectId),
                  eq(projectReleaseLink.releaseId, value.releaseId),
                  eq(projectReleaseLink.revision, update.expectedRevision),
                ),
              )
              .returning();
      return row
        ? { id: row.id, revision: row.revision, value: { link: value } }
        : null;
    },
  };
}

interface AudienceValue {
  audience: {
    attached: boolean;
    projectId: string;
    releaseId: string;
    targetId: string;
    targetType: ProjectReleaseAudienceType;
  } | null;
}

function audienceTarget(
  accountId: string,
  input: NonNullable<AudienceValue["audience"]>,
): ProjectReleasePlanningTarget<AudienceValue> {
  async function allowed(
    executor: ProjectReleasePlanningExecutor,
    value: NonNullable<AudienceValue["audience"]>,
    lock: boolean,
    write = false,
  ) {
    const owned = write
      ? await plannableRelease(
          executor,
          accountId,
          value.projectId,
          value.releaseId,
        )
      : await ownedRelease(
          executor,
          accountId,
          value.projectId,
          value.releaseId,
          lock,
        );
    if (!owned) {
      return false;
    }
    if (!value.attached) {
      return true;
    }
    // Persona Documents of this Project or its Wiki; Contacts and Companies of its workspace.
    const [target] = await audienceTargets(
      executor,
      value.projectId,
      owned.project.workspaceId,
      { id: value.targetId, type: value.targetType },
    );
    return Boolean(target);
  }
  return {
    async find(executor, targetId, lock) {
      if (!(await allowed(executor, input, lock))) {
        return null;
      }
      const query = executor
        .select()
        .from(projectReleaseAudience)
        .where(
          and(
            eq(projectReleaseAudience.id, targetId),
            eq(projectReleaseAudience.projectId, input.projectId),
          ),
        )
        .limit(1);
      const [row] = lock ? await query.for("update") : await query;
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: {
          audience: row ? { ...input, attached: row.removedAt === null } : null,
        },
      };
    },
    async update(executor, update) {
      const value = update.nextValue.audience;
      if (!(value && (await allowed(executor, value, true, true)))) {
        return null;
      }
      const values = {
        removedAt: value.attached ? null : update.committedAt,
        revision: update.expectedRevision + 1,
      };
      const [row] =
        update.expectedRevision === 0
          ? await executor
              .insert(projectReleaseAudience)
              .values({
                ...values,
                companyId:
                  value.targetType === "Company" ? value.targetId : null,
                contactId:
                  value.targetType === "Contact" ? value.targetId : null,
                createdAt: update.committedAt,
                id: update.targetId,
                personaDocumentId:
                  value.targetType === "Persona" ? value.targetId : null,
                projectId: value.projectId,
                releaseId: value.releaseId,
                targetType: value.targetType,
              })
              .onConflictDoNothing()
              .returning()
          : await executor
              .update(projectReleaseAudience)
              .set(values)
              .where(
                and(
                  eq(projectReleaseAudience.id, update.targetId),
                  eq(projectReleaseAudience.revision, update.expectedRevision),
                ),
              )
              .returning();
      return row
        ? { id: row.id, revision: row.revision, value: { audience: value } }
        : null;
    },
  };
}

function latest(...dates: (Date | null | undefined)[]) {
  return dates.reduce<Date | null>(
    (current, date) => (date && (!current || date > current) ? date : current),
    null,
  );
}

function audienceTargetId(row: typeof projectReleaseAudience.$inferSelect) {
  return row.personaDocumentId ?? row.contactId ?? row.companyId ?? "";
}

export function createDatabaseProjectReleasePlanning(
  database: Database,
  ports: ProjectReleasePlanningPorts,
): ProjectReleasePlanningAccess {
  async function commit<TValue>(
    target: ProjectReleasePlanningTarget<TValue>,
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
        if (cause instanceof ProjectReleasePlanningConflictError) {
          throw cause;
        }
      }
      const kind = ports.mutationFailure(error);
      if (kind === "not-found") {
        return null;
      }
      if (kind === "conflict") {
        throw new ProjectReleasePlanningConflictError(input.targetId, {
          cause: error,
        });
      }
      throw error;
    }
  }

  async function scopeMember(
    id: string,
    revision: number,
    attached: boolean,
    workId: string,
  ): Promise<ProjectReleaseScopeMember> {
    const [row] = await database
      .select(workColumns)
      .from(work)
      .where(eq(work.id, workId))
      .limit(1);
    return {
      attached,
      id,
      revision,
      work: row
        ? toWork(row)
        : {
            closureResult: null,
            id: workId,
            key: "",
            status: "",
            title: null,
            type: "",
            unavailable: true,
          },
    };
  }

  return {
    async setScope(accountId, rawInput) {
      const input = setProjectReleaseScopeInputSchema.parse(rawInput);
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      const id = await stableId("release-scope", [
        input.projectId,
        input.releaseId,
        input.workId,
      ]);
      const receipt = await commit(
        scopeTarget(accountId, input, input.attached),
        {
          accountId,
          baseRevision,
          clientIdempotencyKey,
          payload,
          targetId: id,
        },
        (current) => {
          if (!(current.scope || input.attached)) {
            throw new ProjectReleasePlanningConflictError(id);
          }
          return { scope: payload };
        },
      );
      return receipt?.nextValue.scope
        ? scopeMember(
            id,
            receipt.revision,
            receipt.nextValue.scope.attached,
            input.workId,
          )
        : null;
    },

    async setLink(accountId, rawInput) {
      const input = setProjectReleaseLinkInputSchema.parse(rawInput);
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      // The row id comes from the full payload, so an identical add reuses it.
      const id = await stableId("release-link", [
        input.projectId,
        input.releaseId,
        input.kind,
        input.repositoryLinkId ?? "",
        input.label,
        input.url ?? "",
      ]);
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
            throw new ProjectReleasePlanningConflictError(id);
          }
          return { link: payload };
        },
      );
      const value = receipt?.nextValue.link;
      if (!(receipt && value)) {
        return null;
      }
      const [repository] = value.repositoryLinkId
        ? await database
            .select({
              id: githubRepositoryLink.id,
              name: githubRepositoryLink.name,
              owner: githubRepositoryLink.owner,
            })
            .from(githubRepositoryLink)
            .where(eq(githubRepositoryLink.id, value.repositoryLinkId))
            .limit(1)
        : [];
      return {
        attached: value.attached,
        id,
        kind: value.kind,
        label: value.label,
        repository: repository ?? null,
        revision: receipt.revision,
        url: value.url,
      };
    },

    async setAudience(accountId, rawInput) {
      const input = setProjectReleaseAudienceInputSchema.parse(rawInput);
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      const id = await stableId("release-audience", [
        input.projectId,
        input.releaseId,
        input.targetType,
        input.targetId,
      ]);
      const receipt = await commit(
        audienceTarget(accountId, payload),
        {
          accountId,
          baseRevision,
          clientIdempotencyKey,
          payload,
          targetId: id,
        },
        (current) => {
          if (!(current.audience || input.attached)) {
            throw new ProjectReleasePlanningConflictError(id);
          }
          return { audience: payload };
        },
      );
      const value = receipt?.nextValue.audience;
      if (!(receipt && value)) {
        return null;
      }
      const owned = await ownedProject(
        database,
        accountId,
        input.projectId,
        false,
      );
      const [target] = owned
        ? await audienceTargets(database, input.projectId, owned.workspaceId, {
            id: input.targetId,
            type: input.targetType,
          })
        : [];
      return {
        attached: value.attached,
        id,
        revision: receipt.revision,
        target: target ?? {
          id: input.targetId,
          title: "Unavailable",
          type: input.targetType,
        },
      };
    },

    async overview(accountId, projectId) {
      const input = projectReleasePlanningProjectInputSchema.parse({
        projectId,
      });
      const owned = await ownedProject(
        database,
        accountId,
        input.projectId,
        false,
      );
      if (!owned) {
        return null;
      }
      const [releases, scope, links, audience] = await Promise.all([
        database
          .select()
          .from(projectRelease)
          .where(eq(projectRelease.projectId, input.projectId))
          .orderBy(asc(projectRelease.name), asc(projectRelease.id)),
        database
          .select({ row: projectReleaseScope, work: workColumns })
          .from(projectReleaseScope)
          .innerJoin(
            work,
            and(
              eq(work.id, projectReleaseScope.workId),
              eq(work.projectId, projectReleaseScope.projectId),
            ),
          )
          .where(eq(projectReleaseScope.projectId, input.projectId)),
        database
          .select()
          .from(projectReleaseLink)
          .where(eq(projectReleaseLink.projectId, input.projectId)),
        database
          .select()
          .from(projectReleaseAudience)
          .where(eq(projectReleaseAudience.projectId, input.projectId)),
      ]);
      return {
        readOnly: owned.archivedAt !== null,
        releases: releases.map((row) => {
          const ownScope = scope.filter(
            (member) => member.row.releaseId === row.id,
          );
          const ownLinks = links.filter((link) => link.releaseId === row.id);
          const ownAudience = audience.filter(
            (link) => link.releaseId === row.id,
          );
          const lastChangedAt = latest(
            row.updatedAt,
            ...[
              ...ownScope.map((member) => member.row),
              ...ownLinks,
              ...ownAudience,
            ].flatMap((change) => [change.createdAt, change.removedAt]),
          );
          return {
            githubReferences: ownLinks.filter(
              (link) =>
                link.removedAt === null && link.kind !== "Environment link",
            ).length,
            lastChangedAt: (lastChangedAt ?? row.updatedAt).toISOString(),
            release: toRelease(row),
            scope: projectReleaseScopeCounts(
              ownScope.map((member) => ({
                attached: member.row.removedAt === null,
                work: toWork(member.work),
              })),
            ),
          };
        }),
      };
    },

    detail(accountId, rawInput) {
      const input = projectReleasePlanningInputSchema.parse(rawInput);
      // One snapshot keeps the scope and the current Work statuses consistent.
      return database.transaction(
        async (executor) => {
          const owned = await ownedRelease(
            executor,
            accountId,
            input.projectId,
            input.releaseId,
            false,
          );
          if (!owned) {
            return null;
          }
          const [scopeRows, projectWork, linkRows, repositories, audienceRows] =
            await Promise.all([
              executor
                .select({ row: projectReleaseScope, work: workColumns })
                .from(projectReleaseScope)
                .innerJoin(
                  work,
                  and(
                    eq(work.id, projectReleaseScope.workId),
                    eq(work.projectId, projectReleaseScope.projectId),
                  ),
                )
                .where(
                  and(
                    eq(projectReleaseScope.projectId, input.projectId),
                    eq(projectReleaseScope.releaseId, input.releaseId),
                  ),
                )
                .orderBy(asc(work.number)),
              executor
                .select(workColumns)
                .from(work)
                .where(
                  and(
                    eq(work.projectId, input.projectId),
                    isNull(work.archivedAt),
                    isNull(work.trashedAt),
                  ),
                )
                .orderBy(asc(work.number)),
              executor
                .select()
                .from(projectReleaseLink)
                .where(
                  and(
                    eq(projectReleaseLink.projectId, input.projectId),
                    eq(projectReleaseLink.releaseId, input.releaseId),
                  ),
                )
                .orderBy(
                  asc(projectReleaseLink.createdAt),
                  asc(projectReleaseLink.id),
                ),
              executor
                .select({
                  disconnectedAt: githubRepositoryLink.disconnectedAt,
                  id: githubRepositoryLink.id,
                  name: githubRepositoryLink.name,
                  owner: githubRepositoryLink.owner,
                })
                .from(githubRepositoryLink)
                .where(eq(githubRepositoryLink.projectId, input.projectId))
                .orderBy(
                  asc(githubRepositoryLink.owner),
                  asc(githubRepositoryLink.name),
                ),
              executor
                .select()
                .from(projectReleaseAudience)
                .where(
                  and(
                    eq(projectReleaseAudience.projectId, input.projectId),
                    eq(projectReleaseAudience.releaseId, input.releaseId),
                  ),
                )
                .orderBy(
                  asc(projectReleaseAudience.createdAt),
                  asc(projectReleaseAudience.id),
                ),
            ]);
          const audienceCandidates = await audienceTargets(
            executor,
            input.projectId,
            owned.project.workspaceId,
          );
          const scope = scopeRows.map(({ row, work: member }) => ({
            attached: row.removedAt === null,
            id: row.id,
            revision: row.revision,
            work: toWork(member),
          }));
          const inScope = new Set(
            scope.filter((member) => member.attached).map((m) => m.work.id),
          );
          const repositoryOf = new Map<string, ProjectReleaseRepository>(
            repositories.map(({ id, name, owner }) => [
              id,
              { id, name, owner },
            ]),
          );
          const links: ProjectReleaseLink[] = linkRows.map((row) => ({
            attached: row.removedAt === null,
            id: row.id,
            kind: row.kind as ProjectReleaseLinkKind,
            label: row.label,
            repository: row.repositoryLinkId
              ? (repositoryOf.get(row.repositoryLinkId) ?? null)
              : null,
            revision: row.revision,
            url: row.url,
          }));
          const audience: ProjectReleaseAudienceLink[] = audienceRows.map(
            (row) => {
              const targetId = audienceTargetId(row);
              const type = row.targetType as ProjectReleaseAudienceType;
              return {
                attached: row.removedAt === null,
                id: row.id,
                revision: row.revision,
                target: audienceCandidates.find(
                  (candidate) =>
                    candidate.type === type && candidate.id === targetId,
                ) ?? { id: targetId, title: "Unavailable", type },
              };
            },
          );
          const release = toRelease(owned.release);
          return {
            audience,
            audienceCandidates,
            links,
            readOnly: owned.project.archivedAt !== null,
            release,
            repositories: repositories
              .filter((repository) => repository.disconnectedAt === null)
              .map(({ id, name, owner }) => ({ id, name, owner })),
            scope,
            scopeCandidates: projectWork
              .filter((row) => !inScope.has(row.id))
              .map(toWork),
            // Read-only: a linked GitHub Release never writes the status.
            suggestion: projectReleaseStatusSuggestion(release, links),
          };
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },
  };
}
