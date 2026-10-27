import type { ProjectUpdateLinkInput } from "@cantiara/api/project-updates";

import {
  type ProjectUpdateLinkFact,
  type ProjectUpdateReminderScheduler,
  type ProjectUpdatesStore,
  projectUpdateLinkKey,
  type StoredProjectUpdate,
  type StoredProjectUpdateReminder,
} from "./project-updates";

/**
 * In-memory harness for the Manual Project Updates seam: one account's
 * Projects and their live owner records, plus the append-only entry list.
 */
export function createMemoryProjectUpdates(options: {
  accountId: string;
  projects: Map<
    string,
    { archived?: boolean; records: Map<string, ProjectUpdateLinkFact> }
  >;
}) {
  const entries: StoredProjectUpdate[] = [];
  const reminderSettings = new Map<string, StoredProjectUpdateReminder>();
  const store: ProjectUpdatesStore = {
    find: (projectId, updateId) =>
      Promise.resolve(
        entries.find(
          (entry) => entry.projectId === projectId && entry.id === updateId,
        ) ?? null,
      ),
    insert: (update) => {
      if (entries.some((entry) => entry.id === update.id)) {
        return Promise.resolve(false);
      }
      entries.push(structuredClone(update));
      return Promise.resolve(true);
    },
    linkFacts: (projectId, links: readonly ProjectUpdateLinkInput[]) => {
      const records = options.projects.get(projectId)?.records;
      const facts = new Map<string, ProjectUpdateLinkFact>();
      for (const link of links) {
        const fact = records?.get(projectUpdateLinkKey(link));
        if (fact) {
          facts.set(projectUpdateLinkKey(link), fact);
        }
      }
      return Promise.resolve(facts);
    },
    list: (projectId) =>
      Promise.resolve(
        entries
          .filter((entry) => entry.projectId === projectId)
          .map((entry) => structuredClone(entry)),
      ),
    reminder: (projectId) =>
      Promise.resolve(structuredClone(reminderSettings.get(projectId)) ?? null),
    saveReminder: (reminder) => {
      reminderSettings.set(reminder.projectId, structuredClone(reminder));
      return Promise.resolve();
    },
    project: (accountId, projectId) => {
      const project = options.projects.get(projectId);
      return Promise.resolve(
        accountId === options.accountId && project
          ? { archived: Boolean(project.archived) }
          : null,
      );
    },
  };
  return { entries, store };
}

/**
 * In-memory stand-in for Personal Reminders: planned `Remind me` rows for a
 * Project and the fired `personal-reminder` signals. `fire` plays the due
 * worker; the module under test never emits a signal itself.
 */
export function createMemoryReminderScheduler() {
  const planned = new Map<
    string,
    { fireAt: Date; id: string; projectId: string; status: string }
  >();
  const signals: {
    dismissed: boolean;
    projectId: string;
    signalType: "personal-reminder";
    sourcePath: string;
  }[] = [];
  let sequence = 0;
  const scheduler: ProjectUpdateReminderScheduler = {
    acknowledge: (_accountId, projectId) => {
      const open = signals.filter(
        (signal) => signal.projectId === projectId && !signal.dismissed,
      );
      for (const signal of open) {
        signal.dismissed = true;
      }
      return Promise.resolve(open.length);
    },
    cancel: (_accountId, reminderId) => {
      const reminder = planned.get(reminderId);
      if (reminder?.status === "Planned") {
        reminder.status = "Cancelled";
      }
      return Promise.resolve();
    },
    openCount: (_accountId, projectId) =>
      Promise.resolve(
        signals.filter(
          (signal) => signal.projectId === projectId && !signal.dismissed,
        ).length,
      ),
    schedule: (_accountId, projectId, fireAt) => {
      sequence += 1;
      const id = `reminder-${sequence}`;
      planned.set(id, { fireAt, id, projectId, status: "Planned" });
      return Promise.resolve({ id });
    },
  };
  return {
    /** Fires every planned reminder due at `at`, as the Personal Reminders worker does. */
    fire: (at: Date) => {
      for (const reminder of planned.values()) {
        if (reminder.status === "Planned" && reminder.fireAt <= at) {
          reminder.status = "Triggered";
          signals.push({
            dismissed: false,
            projectId: reminder.projectId,
            signalType: "personal-reminder",
            sourcePath: `/projects/${reminder.projectId}#project-updates`,
          });
        }
      }
    },
    planned: () =>
      [...planned.values()].filter((reminder) => reminder.status === "Planned"),
    scheduler,
    signals,
  };
}
