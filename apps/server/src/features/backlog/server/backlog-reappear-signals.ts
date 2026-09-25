import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { WORK_OPEN_STATUS_OPTIONS } from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogReappearAttentionSignal } from "@cantiara/db/schema/backlog";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

interface ReappearWork {
  archivedAt: Date | null;
  id: string;
  projectId: string;
  reappearDate: string | null;
  status: string;
  trashedAt: Date | null;
}

export function dueReappearSignal(
  source: ReappearWork,
  enabled: boolean,
  today: string,
) {
  if (
    !(enabled && source.reappearDate) ||
    source.reappearDate > today ||
    source.archivedAt ||
    source.trashedAt ||
    !WORK_OPEN_STATUS_OPTIONS.includes(
      source.status as (typeof WORK_OPEN_STATUS_OPTIONS)[number],
    )
  ) {
    return null;
  }
  return {
    presentation: "Action needed" as const,
    projectId: source.projectId,
    reappearDate: source.reappearDate,
    signalId: `reappear-date:${source.id}:${source.reappearDate}`,
    signalType: "reappear-date" as const,
    sourcePath: `/projects/${encodeURIComponent(source.projectId)}#work-${encodeURIComponent(source.id)}`,
    sourceWorkId: source.id,
  };
}

function dateInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function sweepDueReappearSignals(
  database: Database,
  now = new Date(),
) {
  const candidates = await database
    .select({
      archivedAt: work.archivedAt,
      id: work.id,
      ownerAccountId: workspace.ownerAccountId,
      projectId: work.projectId,
      reappearDate: work.reappearDate,
      status: work.status,
      timeZone: accountPreferences.timeZone,
      trashedAt: work.trashedAt,
    })
    .from(work)
    .innerJoin(project, eq(project.id, work.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .leftJoin(
      accountPreferences,
      eq(accountPreferences.accountId, workspace.ownerAccountId),
    )
    .where(
      and(
        isNotNull(work.reappearDate),
        isNull(work.archivedAt),
        isNull(work.trashedAt),
        inArray(work.status, WORK_OPEN_STATUS_OPTIONS),
        sql`${project.configuration}->>'notifyOnReappearDate' = 'true'`,
      ),
    );

  const due = candidates.flatMap((candidate) => {
    const signal = dueReappearSignal(
      candidate,
      true,
      dateInTimeZone(
        now,
        candidate.timeZone ?? DEFAULT_ACCOUNT_PREFERENCES.timeZone,
      ),
    );
    return signal
      ? [
          {
            ...signal,
            ownerAccountId: candidate.ownerAccountId,
            occurredAt: now,
          },
        ]
      : [];
  });
  if (due.length === 0) {
    return 0;
  }
  const created = await database
    .insert(projectBacklogReappearAttentionSignal)
    .values(due)
    .onConflictDoNothing({
      target: projectBacklogReappearAttentionSignal.signalId,
    })
    .returning({ signalId: projectBacklogReappearAttentionSignal.signalId });
  return created.length;
}
