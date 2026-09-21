import type { RelationsAccess, RelationView } from "@cantiara/api/relations";
import type {
  WorkContextAccess,
  WorkContextPriorityValues,
} from "@cantiara/api/work-context";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";

export interface WorkContextProjectionOptions {
  /**
   * Owning source stores use these callbacks to return already-authorized
   * relations and criterion values, including nested source traversal. The
   * Work Context layer never resolves record ids or bypasses those stores.
   */
  priorityValues?: (
    accountId: string,
    work: WorkProfile,
  ) => Promise<WorkContextPriorityValues>;
  relations?: (
    accountId: string,
    workId: string,
  ) => Promise<readonly RelationView[]>;
}

export function createWorkContextAccess(
  workLifecycle: Pick<WorkLifecycleAccess, "find">,
  relationAccess: Pick<RelationsAccess, "list">,
  options: WorkContextProjectionOptions = {},
): WorkContextAccess {
  const listRelations =
    options.relations ??
    ((accountId, workId) =>
      relationAccess.list(accountId, {
        recordId: workId,
        recordType: "Work",
      }));
  const loadPriorityValues =
    options.priorityValues ??
    (async (_accountId, work) => ({
      effort: work.effort,
      targetDate: work.targetDate,
    }));

  return {
    async find(accountId, workId) {
      const work = await workLifecycle.find(accountId, workId);
      if (!work) {
        return null;
      }

      const [relations, priorityValues] = await Promise.all([
        listRelations(accountId, work.id),
        loadPriorityValues(accountId, work),
      ]);

      return { priorityValues, relations };
    },
  };
}
