import {
  type CreateProjectUpdateInput,
  configureProjectUpdateReminderInputSchema,
  createProjectUpdateInputSchema,
  DEFAULT_PROJECT_UPDATE_REMINDER_QUESTION,
  type ProjectUpdate,
  ProjectUpdateConflictError,
  type ProjectUpdateLink,
  ProjectUpdateLinkError,
  type ProjectUpdateLinkInput,
  type ProjectUpdateMark,
  ProjectUpdateReadOnlyError,
  type ProjectUpdateReminder,
  type ProjectUpdateReminderState,
  type ProjectUpdateSnapshot,
  type ProjectUpdatesAccess,
  projectUpdateLinkKey,
  projectUpdatesInputSchema,
} from "@cantiara/api/project-updates";

/**
 * Manual Project Updates behavior (spec 69). Every save appends one entry; the
 * store port has no member that rewrites or removes an entry (`saveReminder`
 * replaces only the reminder preference, a setting), so a saved mark,
 * narrative and snapshot cannot change. The behavior derives no health, score
 * or "current" judgment: it only returns the dated entries, newest first.
 */

export interface StoredProjectUpdate {
  id: string;
  links: ProjectUpdateLinkInput[];
  mark: ProjectUpdateMark;
  narrative: string;
  projectId: string;
  savedAt: string;
  snapshot: ProjectUpdateSnapshot;
}

/** The stored reminder preference of one Project (spec 69 #471). */
export interface StoredProjectUpdateReminder {
  intervalDays: number;
  nextDueAt: string | null;
  /** The planned Personal Reminders `Remind me`, when one is planned. */
  personalReminderId: string | null;
  projectId: string;
  question: string;
  state: ProjectUpdateReminderState;
}

/**
 * Port to Personal Reminders, which owns emission of the `personal-reminder`
 * signal (35). This module only plans one source-linked `Remind me` on the
 * Project; it never emits or presents a signal itself.
 */
export interface ProjectUpdateReminderScheduler {
  /** Dismisses the Project's undismissed update-reminder signals; returns how many. */
  acknowledge: (accountId: string, projectId: string) => Promise<number>;
  /** Cancels a planned reminder; a fired or unknown one is left alone. */
  cancel: (accountId: string, reminderId: string) => Promise<void>;
  /** How many fired update-reminder signals await an answer. */
  openCount: (accountId: string, projectId: string) => Promise<number>;
  /** Plans the next reminder; `null` when the Project takes none. */
  schedule: (
    accountId: string,
    projectId: string,
    fireAt: Date,
  ) => Promise<{ id: string } | null>;
}

/** Live facts of one linked record; `null` when it no longer exists. */
export interface ProjectUpdateLinkFact {
  label: string;
  status: string | null;
  /** Archived or trashed: still listed, without content. */
  unavailable: boolean;
}

/**
 * Port to the stored entries and the owner records behind the links. It is
 * append-only by construction: `insert` adds, nothing updates or deletes.
 */
export interface ProjectUpdatesStore {
  /** The stored entry with this id in this Project, or `null`. */
  find: (
    projectId: string,
    updateId: string,
  ) => Promise<StoredProjectUpdate | null>;
  /** Appends the entry; `false` when the id was already taken (a race). */
  insert: (update: StoredProjectUpdate) => Promise<boolean>;
  /** Live owner-record facts of the same Project, by `type:id`. */
  linkFacts: (
    projectId: string,
    links: readonly ProjectUpdateLinkInput[],
  ) => Promise<Map<string, ProjectUpdateLinkFact>>;
  /** Every entry of the Project, in any order. */
  list: (projectId: string) => Promise<StoredProjectUpdate[]>;
  /** `null` when the account does not own the Project. */
  project: (
    accountId: string,
    projectId: string,
  ) => Promise<{ archived: boolean } | null>;
  /** The reminder preference of the Project, or `null` when never configured. */
  reminder: (projectId: string) => Promise<StoredProjectUpdateReminder | null>;
  /** Replaces the Project's reminder preference (a setting, not an update). */
  saveReminder: (reminder: StoredProjectUpdateReminder) => Promise<void>;
}

/**
 * Order-insensitive serialization for the replay comparison. PostgreSQL jsonb
 * canonicalizes object key order, so a stored snapshot read back never has the
 * exact key order the client sent; raw `JSON.stringify` would report identical
 * content as different. Arrays keep their order (the blocks lists it as shown).
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sameContent(
  stored: StoredProjectUpdate,
  input: CreateProjectUpdateInput,
) {
  const keys = (links: readonly ProjectUpdateLinkInput[]) =>
    links.map(projectUpdateLinkKey).sort();
  return (
    stored.mark === input.mark &&
    stored.narrative === input.narrative &&
    canonical(stored.snapshot) === canonical(input.snapshot) &&
    JSON.stringify(keys(stored.links)) === JSON.stringify(keys(input.links))
  );
}

function newestFirst(a: StoredProjectUpdate, b: StoredProjectUpdate) {
  return b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id);
}

/** A racing id must be the identical retried save; anything else conflicts. */
function savedContent(
  stored: StoredProjectUpdate | null,
  input: CreateProjectUpdateInput,
) {
  if (!(stored && sameContent(stored, input))) {
    throw new ProjectUpdateConflictError(input.updateId);
  }
  return stored;
}

async function replayOrNull(
  store: ProjectUpdatesStore,
  projectId: string,
  stored: StoredProjectUpdate,
): Promise<ProjectUpdate | null> {
  const [update] = await toUpdates(store, projectId, [stored]);
  return update ?? null;
}

async function toUpdates(
  store: ProjectUpdatesStore,
  projectId: string,
  stored: readonly StoredProjectUpdate[],
): Promise<ProjectUpdate[]> {
  const facts = await store.linkFacts(
    projectId,
    stored.flatMap((update) => update.links),
  );
  return stored.map((update) => ({
    id: update.id,
    links: update.links.map((link): ProjectUpdateLink => {
      const fact = facts.get(projectUpdateLinkKey(link));
      return {
        label: fact && !fact.unavailable ? fact.label : null,
        status: fact && !fact.unavailable ? fact.status : null,
        targetId: link.targetId,
        targetType: link.targetType,
        unavailable: !fact || fact.unavailable,
      };
    }),
    mark: update.mark,
    narrative: update.narrative,
    projectId: update.projectId,
    savedAt: update.savedAt,
    snapshot: update.snapshot,
  }));
}

const DAY_MS = 86_400_000;
const DEFAULT_REMINDER_INTERVAL_DAYS = 14;

export function createProjectUpdates(
  store: ProjectUpdatesStore,
  options: {
    now?: () => Date;
    reminders?: ProjectUpdateReminderScheduler;
  } = {},
): ProjectUpdatesAccess {
  const now = options.now ?? (() => new Date());
  const scheduler = () => {
    if (!options.reminders) {
      throw new Error("Project Update reminders are not configured.");
    }
    return options.reminders;
  };

  async function view(
    accountId: string,
    projectId: string,
    stored: StoredProjectUpdateReminder | null,
  ): Promise<ProjectUpdateReminder> {
    const due = stored
      ? (await scheduler().openCount(accountId, projectId)) > 0
      : false;
    return {
      due,
      intervalDays: stored?.intervalDays ?? DEFAULT_REMINDER_INTERVAL_DAYS,
      nextDueAt: stored?.state === "Enabled" ? stored.nextDueAt : null,
      projectId,
      question: stored?.question ?? DEFAULT_PROJECT_UPDATE_REMINDER_QUESTION,
      state: stored?.state ?? "Disabled",
    };
  }

  /** Plans the next one `intervalDays` from now, then cancels the old plan. */
  async function plan(
    accountId: string,
    settings: StoredProjectUpdateReminder,
  ): Promise<StoredProjectUpdateReminder> {
    const fireAt = new Date(now().valueOf() + settings.intervalDays * DAY_MS);
    const planned =
      settings.state === "Enabled"
        ? await scheduler().schedule(accountId, settings.projectId, fireAt)
        : null;
    const next = {
      ...settings,
      nextDueAt: planned ? fireAt.toISOString() : null,
      personalReminderId: planned?.id ?? null,
    };
    // The stored settings point at the new plan before the old reminder is
    // cancelled: a failure in between leaves at most one stale reminder that
    // fires once, instead of an `Enabled` setting that never plans again.
    await store.saveReminder(next);
    if (
      settings.personalReminderId &&
      settings.personalReminderId !== planned?.id
    ) {
      await scheduler().cancel(accountId, settings.personalReminderId);
    }
    return next;
  }

  /**
   * An explicit save answers a fired reminder, so the next one is planned. A
   * save in the rare state of an `Enabled` reminder without a live plan also
   * replans, so a failed earlier plan cannot leave the reminder silent.
   */
  async function answerDueReminder(accountId: string, projectId: string) {
    const current = await store.reminder(projectId);
    if (current?.state !== "Enabled") {
      return;
    }
    const answered = await scheduler().acknowledge(accountId, projectId);
    const hasPlan =
      current.personalReminderId !== null && current.nextDueAt !== null;
    if (answered > 0 || !hasPlan) {
      await plan(accountId, current);
    }
  }

  return {
    async configureReminder(accountId, rawInput) {
      const input = configureProjectUpdateReminderInputSchema.parse(rawInput);
      const owned = await store.project(accountId, input.projectId);
      if (!owned) {
        return null;
      }
      if (owned.archived) {
        throw new ProjectUpdateReadOnlyError(input.projectId);
      }
      const current = await store.reminder(input.projectId);
      const settings: StoredProjectUpdateReminder = {
        intervalDays: input.intervalDays,
        nextDueAt: current?.nextDueAt ?? null,
        personalReminderId: current?.personalReminderId ?? null,
        projectId: input.projectId,
        question: input.question,
        state: input.state,
      };
      // Editing only the question keeps the plan; a new interval or a state
      // change replans, and pausing or disabling plans nothing and clears
      // any fired signal so no stale nudge remains.
      const keepsPlan =
        input.state === "Enabled" &&
        current?.state === "Enabled" &&
        current.intervalDays === input.intervalDays;
      if (keepsPlan) {
        await store.saveReminder(settings);
      }
      const saved = keepsPlan ? settings : await plan(accountId, settings);
      if (input.state !== "Enabled") {
        await scheduler().acknowledge(accountId, input.projectId);
      }
      return view(accountId, input.projectId, saved);
    },

    async reminder(accountId, rawProjectId) {
      const { projectId } = projectUpdatesInputSchema.parse({
        projectId: rawProjectId,
      });
      if (!(await store.project(accountId, projectId))) {
        return null;
      }
      return view(accountId, projectId, await store.reminder(projectId));
    },

    async skipReminder(accountId, rawProjectId) {
      const { projectId } = projectUpdatesInputSchema.parse({
        projectId: rawProjectId,
      });
      const owned = await store.project(accountId, projectId);
      if (!owned) {
        return null;
      }
      // Skipping acknowledges the nudge and plans the next one; it never
      // appends a Project Update. On an archived Project Personal Reminders
      // takes no new reminder, so the existing plan is left untouched
      // instead of being replaced by a silent `Enabled` without one.
      await scheduler().acknowledge(accountId, projectId);
      const current = await store.reminder(projectId);
      return view(
        accountId,
        projectId,
        current?.state === "Enabled" && !owned.archived
          ? await plan(accountId, current)
          : current,
      );
    },

    async create(accountId, rawInput) {
      const input = createProjectUpdateInputSchema.parse(rawInput);
      const owned = await store.project(accountId, input.projectId);
      if (!owned) {
        return null;
      }
      const existing = await store.find(input.projectId, input.updateId);
      if (existing) {
        // The same save retried is replayed; a different one never rewrites it.
        const replayed = await replayOrNull(
          store,
          input.projectId,
          savedContent(existing, input),
        );
        await answerDueReminder(accountId, input.projectId);
        return replayed;
      }
      if (owned.archived) {
        throw new ProjectUpdateReadOnlyError(input.projectId);
      }
      const facts = await store.linkFacts(input.projectId, input.links);
      for (const link of input.links) {
        const fact = facts.get(projectUpdateLinkKey(link));
        if (!fact || fact.unavailable) {
          throw new ProjectUpdateLinkError(link);
        }
      }
      const stored: StoredProjectUpdate = {
        id: input.updateId,
        links: input.links,
        mark: input.mark,
        narrative: input.narrative,
        projectId: input.projectId,
        savedAt: now().toISOString(),
        snapshot: input.snapshot,
      };
      if (!(await store.insert(stored))) {
        // Only the Project's own PK race can fail here; the racing entry is
        // either the same retried save (replayed) or a different one.
        const raced = savedContent(
          await store.find(input.projectId, input.updateId),
          input,
        );
        const replayed = await replayOrNull(store, input.projectId, raced);
        await answerDueReminder(accountId, input.projectId);
        return replayed;
      }
      await answerDueReminder(accountId, input.projectId);
      const [created] = await toUpdates(store, input.projectId, [stored]);
      return created ?? null;
    },

    async overview(accountId, rawProjectId) {
      const { projectId } = projectUpdatesInputSchema.parse({
        projectId: rawProjectId,
      });
      const owned = await store.project(accountId, projectId);
      if (!owned) {
        return null;
      }
      const stored = (await store.list(projectId)).sort(newestFirst);
      return {
        readOnly: owned.archived,
        updates: await toUpdates(store, projectId, stored),
      };
    },
  };
}
