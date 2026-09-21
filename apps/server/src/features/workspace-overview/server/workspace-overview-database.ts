import { projectLifecycleStatusSchema } from "@cantiara/api/project-shell";
import { workStatusSchema, workTypeSchema } from "@cantiara/api/work-lifecycle";
import {
  buildWorkspaceOverview,
  DEFAULT_WORKSPACE_OVERVIEW_LAYOUT,
  normalizeWorkspaceOverviewLayout,
  WORKSPACE_OVERVIEW_BLOCKED_WORK_LIMIT,
  WORKSPACE_OVERVIEW_CONFIGURATION_VERSION,
  WORKSPACE_OVERVIEW_RECENT_WORK_LIMIT,
  type WorkspaceOverviewAccess,
  workspaceOverviewPresentationSchema,
  workspaceOverviewWorkHref,
} from "@cantiara/api/workspace-overview";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import { project, work } from "@cantiara/db/schema/index";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

const DEFAULT_WORKSPACE_TIME_ZONE = "Europe/Istanbul";

function todayInTimeZone(timeZone: string | null | undefined) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timeZone ?? DEFAULT_WORKSPACE_TIME_ZONE,
      year: "numeric",
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts
        .filter(({ type }) => ["day", "month", "year"].includes(type))
        .map(({ type, value }) => [type, value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function createDatabaseWorkspaceOverview(
  database: Database,
): WorkspaceOverviewAccess {
  function distinctLiveBlockSources(
    sources: readonly {
      recordId: string;
      recordType: string;
      viewId?: string;
    }[],
  ) {
    const seen = new Set<string>();
    return sources.slice(0, 4).filter((source) => {
      const key = `${source.recordType}:${source.recordId}:${source.viewId ?? ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async function read(accountId: string) {
    const [ownedWorkspace] = await database
      .select({
        id: workspace.id,
        overviewConfiguration: workspace.overviewConfiguration,
        timeZone: accountPreferences.timeZone,
      })
      .from(workspace)
      .leftJoin(
        accountPreferences,
        eq(accountPreferences.accountId, workspace.ownerAccountId),
      )
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);

    if (!ownedWorkspace) {
      return buildWorkspaceOverview({ projects: [] });
    }

    const projects = await database
      .select({
        createdAt: project.createdAt,
        id: project.id,
        name: project.name,
        status: project.status,
        targetDate: project.targetDate,
        updatedAt: project.updatedAt,
      })
      .from(project)
      .where(eq(project.workspaceId, ownedWorkspace.id))
      .orderBy(asc(project.createdAt));

    const works = await database
      .select({
        archivedAt: work.archivedAt,
        id: work.id,
        key: work.key,
        projectId: work.projectId,
        status: work.status,
        title: work.title,
        type: work.type,
        updatedAt: work.updatedAt,
      })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .where(
        and(
          eq(project.workspaceId, ownedWorkspace.id),
          isNull(work.archivedAt),
        ),
      )
      .orderBy(desc(work.updatedAt), asc(work.number))
      .limit(WORKSPACE_OVERVIEW_RECENT_WORK_LIMIT);

    // Open risk, reminder, and goal sources are not persisted yet; registered
    // attention starts from Blocked Work so older blockers stay in Attention
    // Required even when they fall outside the Recent Work limit.
    const blockedWorks = await database
      .select({
        id: work.id,
        projectId: work.projectId,
        projectName: project.name,
        status: work.status,
        title: work.title,
        type: work.type,
        updatedAt: work.updatedAt,
      })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .where(
        and(
          eq(project.workspaceId, ownedWorkspace.id),
          isNull(work.archivedAt),
          eq(work.status, "Blocked"),
        ),
      )
      .orderBy(desc(work.updatedAt), asc(work.number))
      .limit(WORKSPACE_OVERVIEW_BLOCKED_WORK_LIMIT);

    const presentation = workspaceOverviewPresentationSchema.safeParse(
      ownedWorkspace.overviewConfiguration,
    );
    const savedPresentation = presentation.success
      ? presentation.data
      : {
          layout: DEFAULT_WORKSPACE_OVERVIEW_LAYOUT,
          liveBlockSources: [],
          version: WORKSPACE_OVERVIEW_CONFIGURATION_VERSION,
        };

    return buildWorkspaceOverview({
      asOf: todayInTimeZone(ownedWorkspace.timeZone),
      attention: blockedWorks.map((record) => ({
        category: "Blocker",
        href: workspaceOverviewWorkHref(record.projectId, record.id),
        id: record.id,
        projectId: record.projectId,
        projectName: record.projectName,
        status: workStatusSchema.parse(record.status),
        title: record.title,
        type: workTypeSchema.parse(record.type),
        updatedAt: record.updatedAt.toISOString(),
      })),
      layout: savedPresentation.layout,
      liveBlockSources: savedPresentation.liveBlockSources,
      projects: projects.map((record) => ({
        createdAt: record.createdAt.toISOString(),
        id: record.id,
        name: record.name,
        status: projectLifecycleStatusSchema.parse(record.status),
        targetDate: record.targetDate,
        updatedAt: record.updatedAt.toISOString(),
      })),
      works: works.map((record) => ({
        archivedAt: record.archivedAt?.toISOString() ?? null,
        id: record.id,
        key: record.key,
        projectId: record.projectId,
        status: workStatusSchema.parse(record.status),
        title: record.title,
        type: workTypeSchema.parse(record.type),
        updatedAt: record.updatedAt.toISOString(),
      })),
    });
  }

  return {
    get: (accountId) => read(accountId),
    async savePresentation(accountId, presentation) {
      const [ownedWorkspace] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);

      if (!ownedWorkspace) {
        return buildWorkspaceOverview({ projects: [] });
      }

      const normalizedPresentation = {
        layout: (() => {
          const normalized = normalizeWorkspaceOverviewLayout(
            presentation.layout,
          );
          return {
            hidden: [...normalized.hidden],
            order: [...normalized.order],
          };
        })(),
        liveBlockSources: distinctLiveBlockSources(
          presentation.liveBlockSources,
        ).map((source) => ({ ...source })),
        version: WORKSPACE_OVERVIEW_CONFIGURATION_VERSION,
      };
      await database
        .update(workspace)
        .set({
          overviewConfiguration: normalizedPresentation,
          updatedAt: new Date(),
        })
        .where(eq(workspace.id, ownedWorkspace.id));

      return read(accountId);
    },
  };
}
