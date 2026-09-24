import { WORK_OPEN_STATUS_OPTIONS } from "@cantiara/api/work-lifecycle";

export function isBacklogMember(work: {
  archivedAt: Date | null;
  status: string;
}) {
  return (
    work.archivedAt === null &&
    WORK_OPEN_STATUS_OPTIONS.some((status) => status === work.status)
  );
}
