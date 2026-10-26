import type { ProjectActivityRecordType } from "@cantiara/api/project-activity";
import type { StorySourceType } from "@cantiara/api/project-history";
import { projectAreaNavigationHash } from "@/features/project-shell/lib/project-area-navigation";
import {
  documentRecordHash,
  navigationHash,
  projectSourceRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";

/**
 * Where `Open source record` goes: the owner record's own surface. One map for
 * the Story Timeline and Project Activity source references.
 */
export function projectRecordHref(
  projectId: string,
  source: {
    recordId: string;
    recordType: ProjectActivityRecordType | StorySourceType;
  },
) {
  const base = `/projects/${encodeURIComponent(projectId)}#`;
  switch (source.recordType) {
    case "Work":
      return `${base}${workRecordHash(source.recordId)}`;
    case "Document":
      return `${base}${documentRecordHash(source.recordId)}`;
    case "Decision":
    case "Risk":
    case "Milestone":
    case "Production Incident":
    case "Validation Record":
    case "Project Release":
      return `${base}${projectSourceRecordHash(source.recordType, source.recordId)}`;
    case "Screen":
      return `${base}${projectAreaNavigationHash("Design")}`;
    case "Pull request":
      return `${base}${projectAreaNavigationHash("GitHub")}`;
    case "Project":
      return `${base}${navigationHash("Overview")}`;
    default:
      return base;
  }
}
