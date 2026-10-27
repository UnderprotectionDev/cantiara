import type { PersonalRemindersAccess } from "@cantiara/api/personal-reminders";
import {
  type ProjectUpdateLinkInput,
  type ProjectUpdateLinkType,
  type ProjectUpdatesAccess,
  projectUpdateLinkKey,
  projectUpdateSnapshotSchema,
} from "@cantiara/api/project-updates";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import {
  projectUpdate,
  projectUpdateLink,
  projectUpdateReminder,
} from "@cantiara/db/schema/project-update";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray } from "drizzle-orm";
import {
  createProjectUpdates,
  type ProjectUpdateLinkFact,
  type ProjectUpdateReminderScheduler,
  type ProjectUpdatesStore,
  type StoredProjectUpdate,
  type StoredProjectUpdateReminder,
} from "./project-updates";

/** Reads of the Project's records by link type; one query per type. */
async function factsOfType(
  database: Database,
  projectId: string,
  type: ProjectUpdateLinkType,
  ids: string[],
): Promise<[string, ProjectUpdateLinkFact][]> {
  const entry = (id: string, fact: ProjectUpdateLinkFact) =>
    [projectUpdateLinkKey({ targetId: id, targetType: type }), fact] as [
      string,
      ProjectUpdateLinkFact,
    ];
  switch (type) {
    case "Risk": {
      const rows = await database
        .select({ id: risk.id, life: risk.life, title: risk.title })
        .from(risk)
        .where(and(eq(risk.projectId, projectId), inArray(risk.id, ids)));
      return rows.map((row) =>
        entry(row.id, {
          label: row.title,
          status: row.life,
          unavailable: false,
        }),
      );
    }
    case "Decision": {
      const rows = await database
        .select({ id: decision.id, life: decision.life, title: decision.title })
        .from(decision)
        .where(
          and(eq(decision.projectId, projectId), inArray(decision.id, ids)),
        );
      return rows.map((row) =>
        entry(row.id, {
          label: row.title,
          status: row.life,
          unavailable: false,
        }),
      );
    }
    case "Milestone": {
      const rows = await database
        .select({
          id: projectMilestone.id,
          status: projectMilestone.status,
          title: projectMilestone.title,
        })
        .from(projectMilestone)
        .where(
          and(
            eq(projectMilestone.projectId, projectId),
            inArray(projectMilestone.id, ids),
          ),
        );
      return rows.map((row) =>
        entry(row.id, {
          label: row.title,
          status: row.status,
          unavailable: false,
        }),
      );
    }
    case "Work": {
      const rows = await database
        .select({
          archivedAt: work.archivedAt,
          id: work.id,
          key: work.key,
          status: work.status,
          title: work.title,
          trashedAt: work.trashedAt,
        })
        .from(work)
        .where(and(eq(work.projectId, projectId), inArray(work.id, ids)));
      return rows.map((row) =>
        entry(row.id, {
          label: `${row.key} ${row.title}`,
          status: row.status,
          unavailable: Boolean(row.archivedAt || row.trashedAt),
        }),
      );
    }
    default: {
      // Exhaustive: a new link type fails to compile here until it is handled.
      const unhandled: never = type;
      return unhandled;
    }
  }
}

function createStore(database: Database): ProjectUpdatesStore {
  return {
    async find(projectId, updateId) {
      const [row] = await database
        .select()
        .from(projectUpdate)
        .where(
          and(
            eq(projectUpdate.id, updateId),
            eq(projectUpdate.projectId, projectId),
          ),
        )
        .limit(1);
      if (!row) {
        return null;
      }
      return (await storedOf(database, [row]))[0] ?? null;
    },

    // One transaction: the entry and its links commit together or not at all.
    insert(update) {
      return database.transaction(async (executor) => {
        const inserted = await executor
          .insert(projectUpdate)
          .values({
            createdAt: new Date(update.savedAt),
            id: update.id,
            mark: update.mark,
            narrative: update.narrative,
            projectId: update.projectId,
            snapshot: update.snapshot,
          })
          .onConflictDoNothing()
          .returning({ id: projectUpdate.id });
        if (inserted.length === 0) {
          return false;
        }
        if (update.links.length > 0) {
          await executor.insert(projectUpdateLink).values(
            update.links.map((link) => ({
              projectId: update.projectId,
              projectUpdateId: update.id,
              targetId: link.targetId,
              targetType: link.targetType,
            })),
          );
        }
        return true;
      });
    },

    async linkFacts(projectId, links) {
      const byType = new Map<ProjectUpdateLinkType, string[]>();
      for (const link of links) {
        byType.set(link.targetType, [
          ...(byType.get(link.targetType) ?? []),
          link.targetId,
        ]);
      }
      const resolved = await Promise.all(
        [...byType].map(([type, ids]) =>
          factsOfType(database, projectId, type, [...new Set(ids)]),
        ),
      );
      return new Map(resolved.flat());
    },

    async list(projectId) {
      const rows = await database
        .select()
        .from(projectUpdate)
        .where(eq(projectUpdate.projectId, projectId));
      return storedOf(database, rows);
    },

    async reminder(projectId) {
      const [row] = await database
        .select()
        .from(projectUpdateReminder)
        .where(eq(projectUpdateReminder.projectId, projectId))
        .limit(1);
      return row
        ? {
            intervalDays: row.intervalDays,
            nextDueAt: row.nextDueAt?.toISOString() ?? null,
            personalReminderId: row.personalReminderId,
            projectId: row.projectId,
            question: row.question,
            state: row.state as StoredProjectUpdateReminder["state"],
          }
        : null;
    },

    async saveReminder(reminder) {
      const values = {
        intervalDays: reminder.intervalDays,
        nextDueAt: reminder.nextDueAt ? new Date(reminder.nextDueAt) : null,
        personalReminderId: reminder.personalReminderId,
        question: reminder.question,
        state: reminder.state,
      };
      await database
        .insert(projectUpdateReminder)
        .values({ ...values, projectId: reminder.projectId })
        .onConflictDoUpdate({
          set: values,
          target: projectUpdateReminder.projectId,
        });
    },

    async project(accountId, projectId) {
      const [row] = await database
        .select({ archivedAt: project.archivedAt })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      return row ? { archived: row.archivedAt !== null } : null;
    },
  };
}

async function storedOf(
  database: Database,
  rows: readonly (typeof projectUpdate.$inferSelect)[],
): Promise<StoredProjectUpdate[]> {
  if (rows.length === 0) {
    return [];
  }
  const linkRows = await database
    .select()
    .from(projectUpdateLink)
    .where(
      inArray(
        projectUpdateLink.projectUpdateId,
        rows.map((row) => row.id),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    links: linkRows
      .filter((link) => link.projectUpdateId === row.id)
      .map(
        (link): ProjectUpdateLinkInput => ({
          targetId: link.targetId,
          targetType: link.targetType as ProjectUpdateLinkType,
        }),
      )
      .sort((a, b) =>
        projectUpdateLinkKey(a).localeCompare(projectUpdateLinkKey(b)),
      ),
    mark: row.mark as StoredProjectUpdate["mark"],
    narrative: row.narrative,
    projectId: row.projectId,
    savedAt: row.createdAt.toISOString(),
    snapshot: projectUpdateSnapshotSchema.parse(row.snapshot),
  }));
}

/**
 * Plans the update reminder through Personal Reminders: one `Remind me` on the
 * Project with the `Create Project Update` purpose, so the fired
 * `personal-reminder` signal opens `Project Updates`. No signal id is added.
 */
export function createPersonalReminderUpdateScheduler(
  personalReminders: PersonalRemindersAccess,
): ProjectUpdateReminderScheduler {
  const isUpdateSignal = (
    signal: Awaited<ReturnType<PersonalRemindersAccess["listSignals"]>>[number],
    projectId: string,
  ) =>
    signal.signalType === "personal-reminder" &&
    signal.sourceRecordType === "Project" &&
    signal.sourceRecordId === projectId &&
    signal.sourcePath.endsWith("#project-updates") &&
    signal.dismissedAt === null;
  return {
    async acknowledge(accountId, projectId) {
      const open = (await personalReminders.listSignals(accountId)).filter(
        (signal) => isUpdateSignal(signal, projectId),
      );
      await Promise.all(
        open.map((signal) =>
          personalReminders.dismissSignal(accountId, signal.signalId),
        ),
      );
      return open.length;
    },
    async cancel(accountId, reminderId) {
      await personalReminders.cancel(accountId, reminderId, {
        action: "Remind me",
        sourceRecordType: "Project",
      });
    },
    async openCount(accountId, projectId) {
      return (await personalReminders.listSignals(accountId)).filter((signal) =>
        isUpdateSignal(signal, projectId),
      ).length;
    },
    async schedule(accountId, projectId, fireAt) {
      const reminder = await personalReminders.create(accountId, {
        action: "Remind me",
        clientIdempotencyKey: `project-update-reminder:${projectId}:${crypto.randomUUID()}`,
        fireAt: fireAt.toISOString(),
        purpose: "Create Project Update",
        sourceRecordId: projectId,
        sourceRecordType: "Project",
      });
      return reminder ? { id: reminder.id } : null;
    },
  };
}

export function createDatabaseProjectUpdates(
  database: Database,
  personalReminders: PersonalRemindersAccess,
): ProjectUpdatesAccess {
  return createProjectUpdates(createStore(database), {
    reminders: createPersonalReminderUpdateScheduler(personalReminders),
  });
}
