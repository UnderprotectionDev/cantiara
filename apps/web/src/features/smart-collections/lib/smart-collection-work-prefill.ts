import type { CreateSmartCollectionInput } from "@cantiara/api/smart-collections";
import {
  WORK_STATUS_OPTIONS,
  WORK_TYPE_OPTIONS,
  type WorkStatus,
  type WorkType,
} from "@cantiara/api/work-lifecycle";
import { DAILY_ACTION_HASHES } from "../../project-shell/lib/project-shell-navigation";

type SmartCollectionWorkConditions = CreateSmartCollectionInput["conditions"];

export interface SmartCollectionWorkPrefillSearch {
  smartCollectionWorkStatus?: WorkStatus;
  smartCollectionWorkType?: WorkType;
}

export function smartCollectionWorkPrefillSearch(
  conditions: SmartCollectionWorkConditions,
): SmartCollectionWorkPrefillSearch {
  const status = WORK_STATUS_OPTIONS.find(
    (option) => option === conditions.status,
  );

  return {
    ...(status === undefined ? {} : { smartCollectionWorkStatus: status }),
    ...(conditions.type === undefined
      ? {}
      : { smartCollectionWorkType: conditions.type }),
  };
}

export function smartCollectionWorkPrefillFromSearch(
  search: Record<string, unknown>,
): SmartCollectionWorkPrefillSearch {
  const type = WORK_TYPE_OPTIONS.find(
    (option) => option === search.smartCollectionWorkType,
  );
  const status = WORK_STATUS_OPTIONS.find(
    (option) => option === search.smartCollectionWorkStatus,
  );

  return {
    ...(status === undefined ? {} : { smartCollectionWorkStatus: status }),
    ...(type === undefined ? {} : { smartCollectionWorkType: type }),
  };
}

export function clearSmartCollectionWorkPrefillSearch<
  T extends Record<string, unknown>,
>(search: T) {
  return {
    ...search,
    smartCollectionWorkStatus: undefined,
    smartCollectionWorkType: undefined,
  };
}

export function newWorkLinkTarget(view: {
  conditions: SmartCollectionWorkConditions;
  projectId: string;
}): {
  hash: string;
  params: { projectId: string };
  search: SmartCollectionWorkPrefillSearch;
  to: "/projects/$projectId";
} {
  return {
    hash: DAILY_ACTION_HASHES.Create,
    params: { projectId: view.projectId },
    search: smartCollectionWorkPrefillSearch(view.conditions),
    to: "/projects/$projectId",
  };
}

export function smartCollectionWorkPrefillClearsOnLeave(
  dailyAction: string | null,
  prefill: SmartCollectionWorkPrefillSearch,
): boolean {
  return (
    dailyAction !== "Create" &&
    (prefill.smartCollectionWorkStatus !== undefined ||
      prefill.smartCollectionWorkType !== undefined)
  );
}

function smartCollectionWorkPrefillMayMiss(
  conditions: SmartCollectionWorkConditions,
  type: WorkType,
): boolean {
  return (
    (conditions.type !== undefined && conditions.type !== type) ||
    (conditions.status !== undefined && conditions.status !== "Not Started")
  );
}

export function smartCollectionWorkPrefillWarning(
  conditions: SmartCollectionWorkConditions,
  type: WorkType,
): string | null {
  return smartCollectionWorkPrefillMayMiss(conditions, type)
    ? "This Work may not appear in this Smart Collection."
    : null;
}
