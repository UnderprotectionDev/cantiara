import {
  type CreateProjectUpdateInput,
  createProjectUpdateInputSchema,
  type ProjectUpdate,
  ProjectUpdateConflictError,
  type ProjectUpdateLink,
  ProjectUpdateLinkError,
  type ProjectUpdateLinkInput,
  type ProjectUpdateMark,
  ProjectUpdateReadOnlyError,
  type ProjectUpdateSnapshot,
  type ProjectUpdatesAccess,
  projectUpdatesInputSchema,
} from "@cantiara/api/project-updates";

/**
 * Manual Project Updates behavior (spec 69). Every save appends one entry; the
 * store port has no member that rewrites or removes one, so a saved mark,
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
}

export function projectUpdateLinkKey(link: ProjectUpdateLinkInput) {
  return `${link.targetType}:${link.targetId}`;
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
    JSON.stringify(stored.snapshot) === JSON.stringify(input.snapshot) &&
    JSON.stringify(keys(stored.links)) === JSON.stringify(keys(input.links))
  );
}

function newestFirst(a: StoredProjectUpdate, b: StoredProjectUpdate) {
  return b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id);
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

export function createProjectUpdates(
  store: ProjectUpdatesStore,
  options: { now?: () => Date } = {},
): ProjectUpdatesAccess {
  const now = options.now ?? (() => new Date());
  return {
    async create(accountId, rawInput) {
      const input = createProjectUpdateInputSchema.parse(rawInput);
      const owned = await store.project(accountId, input.projectId);
      if (!owned) {
        return null;
      }
      const existing = await store.find(input.projectId, input.updateId);
      if (existing) {
        // The same save retried is replayed; a different one never rewrites it.
        if (!sameContent(existing, input)) {
          throw new ProjectUpdateConflictError(input.updateId);
        }
        const [replayed] = await toUpdates(store, input.projectId, [existing]);
        return replayed ?? null;
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
        throw new ProjectUpdateConflictError(input.updateId);
      }
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
