import type { ProjectActivitySourceRef } from "@cantiara/api/project-activity";
import {
  documentRecordHash,
  projectSourceRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";

/** Where `Open source record` goes: the owner record's own surface. */
export function projectActivitySourceHref(
  projectId: string,
  source: Pick<ProjectActivitySourceRef, "recordId" | "recordType">,
) {
  const base = `/projects/${encodeURIComponent(projectId)}#`;
  switch (source.recordType) {
    case "Work":
      return `${base}${workRecordHash(source.recordId)}`;
    case "Document":
      return `${base}${documentRecordHash(source.recordId)}`;
    case "Decision":
    case "Risk":
      return `${base}${projectSourceRecordHash(source.recordType, source.recordId)}`;
    default:
      return base;
  }
}
