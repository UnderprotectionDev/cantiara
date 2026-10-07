import type {
  ReturnChanges,
  ReturnContext,
  ReturnEvent,
  ReturnEventKind,
  ReturnEventSource,
} from "@cantiara/api/return-to-work";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  projectLastVisit,
  workLastVisit,
} from "@cantiara/db/schema/return-to-work";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";

interface EventSource {
  createdAt: Date;
  createdKind: ReturnEventKind | null;
  publish: boolean;
  snapshotKey: "work" | "decision" | "risk" | "document" | "projectRelease";
  source: ReturnEventSource;
  updatedKind: ReturnEventKind;
}
export async function readReturnChanges(
  database: Database,
  accountId: string,
  context: ReturnContext,
): Promise<ReturnChanges> {
  const [visit] = context.workId
    ? await database
        .select({ viewedAt: workLastVisit.viewedAt })
        .from(workLastVisit)
        .where(
          and(
            eq(workLastVisit.accountId, accountId),
            eq(workLastVisit.workId, context.workId),
          ),
        )
    : await database
        .select({ viewedAt: projectLastVisit.viewedAt })
        .from(projectLastVisit)
        .where(
          and(
            eq(projectLastVisit.accountId, accountId),
            eq(projectLastVisit.projectId, context.projectId),
          ),
        );
  if (!visit) {
    return { lastViewedAt: null, events: [] };
  }
  const sources = await readEventSources(database, context);
  const events: ReturnEvent[] = sources.flatMap((record) =>
    record.createdKind !== null && record.createdAt > visit.viewedAt
      ? [
          {
            id: `created:${record.snapshotKey}:${record.source.id}`,
            kind: record.createdKind,
            occurredAt: record.createdAt.toISOString(),
            source: record.source,
          },
        ]
      : [],
  );
  const sourceIds = [...new Set(sources.map((record) => record.source.id))];
  const history =
    sources.length === 0
      ? []
      : await database
          .select()
          .from(mutationHistory)
          .where(
            and(
              inArray(mutationHistory.targetId, sourceIds),
              gt(mutationHistory.occurredAt, visit.viewedAt),
            ),
          );
  events.push(...eventsFromHistory(history, sources));
  return { lastViewedAt: visit.viewedAt.toISOString(), events };
}

async function readEventSources(
  database: Database,
  context: ReturnContext,
): Promise<EventSource[]> {
  const projectPath = `/projects/${encodeURIComponent(context.projectId)}`;
  const records = await database
    .select()
    .from(work)
    .where(
      and(
        eq(work.projectId, context.projectId),
        isNull(work.archivedAt),
        isNull(work.trashedAt),
        context.workId ? eq(work.id, context.workId) : undefined,
      ),
    );
  const sources: EventSource[] = records.map((record) => ({
    source: {
      id: record.id,
      projectId: context.projectId,
      title: `${record.key} · ${record.title}`,
      sourcePath: `${projectPath}#work-${encodeURIComponent(record.id)}`,
    },
    createdAt: record.createdAt,
    createdKind: "Work created",
    updatedKind: "Work updated",
    snapshotKey: "work",
    publish: false,
  }));
  if (!context.workId) {
    const [decisions, risks, documents, releases] = await Promise.all([
      database
        .select()
        .from(decision)
        .where(eq(decision.projectId, context.projectId)),
      database.select().from(risk).where(eq(risk.projectId, context.projectId)),
      database
        .select()
        .from(document)
        .where(
          and(
            eq(document.projectId, context.projectId),
            isNull(document.archivedAt),
          ),
        ),
      database
        .select()
        .from(projectRelease)
        .where(eq(projectRelease.projectId, context.projectId)),
    ]);
    for (const record of decisions) {
      sources.push({
        source: {
          id: record.id,
          projectId: context.projectId,
          title: record.title,
          sourcePath: `${projectPath}#source-decision-${encodeURIComponent(record.id)}`,
        },
        createdAt: record.createdAt,
        createdKind: "Decision recorded",
        updatedKind: "Decision updated",
        snapshotKey: "decision",
        publish: false,
      });
    }
    for (const record of risks) {
      sources.push({
        source: {
          id: record.id,
          projectId: context.projectId,
          title: record.title,
          sourcePath: `${projectPath}#source-risk-${encodeURIComponent(record.id)}`,
        },
        createdAt: record.createdAt,
        createdKind: "Risk recorded",
        updatedKind: "Risk updated",
        snapshotKey: "risk",
        publish: false,
      });
    }
    for (const record of documents) {
      sources.push({
        source: {
          id: record.id,
          projectId: context.projectId,
          title: record.title,
          sourcePath: `${projectPath}#document-${encodeURIComponent(record.id)}`,
        },
        createdAt: record.createdAt,
        createdKind: "Document created",
        updatedKind: "Document updated",
        snapshotKey: "document",
        publish: false,
      });
    }
    for (const record of releases) {
      sources.push({
        source: {
          id: record.id,
          projectId: context.projectId,
          title: record.name,
          sourcePath: `${projectPath}#source-project-release-${encodeURIComponent(record.id)}`,
        },
        createdAt: record.createdAt,
        createdKind: null,
        updatedKind: "Project Release published",
        snapshotKey: "projectRelease",
        publish: true,
      });
    }
  }

  return sources;
}

function eventsFromHistory(
  history: (typeof mutationHistory.$inferSelect)[],
  sources: EventSource[],
): ReturnEvent[] {
  const byId = new Map<string, EventSource[]>();
  for (const record of sources) {
    const matches = byId.get(record.source.id) ?? [];
    matches.push(record);
    byId.set(record.source.id, matches);
  }
  const events: ReturnEvent[] = [];
  for (const entry of history) {
    const record = byId
      .get(entry.targetId)
      ?.find(
        (source) =>
          recordSnapshot(entry.nextValue, source.snapshotKey) !== null,
      );
    if (!record) {
      continue;
    }
    if (
      record.publish &&
      !(
        releaseStatus(entry.nextValue) === "Published" &&
        releaseStatus(entry.previousValue) !== "Published"
      )
    ) {
      continue;
    }
    // Creation has its own source timestamp; do not count its receipt twice.
    if (
      entry.revision === 1 &&
      record.createdAt.getTime() === entry.occurredAt.getTime() &&
      !record.publish
    ) {
      continue;
    }
    events.push({
      id: entry.id,
      kind:
        entry.actorType === "GitHub" && record.updatedKind === "Work updated"
          ? "GitHub development signal"
          : record.updatedKind,
      occurredAt: entry.occurredAt.toISOString(),
      source: record.source,
    });
  }

  return events;
}

function recordSnapshot(
  value: unknown,
  key: string,
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const record = (value as Record<string, unknown>)[key];
  return typeof record === "object" && record !== null
    ? (record as Record<string, unknown>)
    : null;
}
function releaseStatus(value: unknown): unknown {
  return recordSnapshot(value, "projectRelease")?.status ?? null;
}
