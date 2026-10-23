import type { ReleaseEvidenceSourceRef } from "@cantiara/api/release-evidence";
import { projectAreaNavigationHash } from "@/features/project-shell/lib/project-area-navigation";
import {
  projectSourceRecordHash,
  testGapRecordHash,
  testsAreaRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";

/** Where `Open source record` goes: the owner record's own surface. */
export function releaseEvidenceSourceHref(
  projectId: string,
  source: Pick<ReleaseEvidenceSourceRef, "recordId" | "recordType">,
) {
  const base = `/projects/${encodeURIComponent(projectId)}#`;
  switch (source.recordType) {
    case "Work":
      return `${base}${workRecordHash(source.recordId)}`;
    case "Decision":
    case "Risk":
    case "Project Release":
      return `${base}${projectSourceRecordHash(source.recordType, source.recordId)}`;
    case "Pull request":
    case "Check":
      return `${base}${projectAreaNavigationHash("GitHub")}`;
    case "Test Gap":
      return `${base}${testGapRecordHash(source.recordId)}`;
    case "Planned Test Case":
    case "Test Handoff":
    case "Test Session":
    case "Test Assessment":
      return `${base}${testsAreaRecordHash(source.recordType, source.recordId)}`;
    case "Publish diff":
      return `${base}${projectAreaNavigationHash("Releases")}`;
    default:
      return base;
  }
}
