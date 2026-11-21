import type { RecordAction } from "@cantiara/api/record-actions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { orpc } from "@/utils/orpc";

export interface ActiveRecordAction {
  action: RecordAction;
  work: WorkProfile;
}

export interface RecordActionDialogPayload extends ActiveRecordAction {
  returnFocusId: string;
}

export function recordActionListOptions(projectId: string) {
  return orpc.recordActions.queryOptions({ input: { projectId } });
}
