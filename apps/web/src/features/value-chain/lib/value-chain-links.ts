import type { ValueChainNodeType } from "@cantiara/api/value-chain";
import { projectAreaNavigationHash } from "@/features/project-shell/lib/project-area-navigation";
import {
  projectSourceRecordHash,
  testsAreaRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";

/** Where `Open source record` goes: the owner record's own surface. */
export function valueChainSourceHref(
  projectId: string,
  node: { id: string; type: ValueChainNodeType },
) {
  const base = `/projects/${encodeURIComponent(projectId)}#`;
  switch (node.type) {
    case "Work":
      return `${base}${workRecordHash(node.id)}`;
    case "Decision":
    case "Risk":
    case "Assumption":
    case "Open Question":
    case "Milestone":
    case "Project Release":
      return `${base}${projectSourceRecordHash(node.type, node.id)}`;
    case "Test":
      return `${base}${testsAreaRecordHash("Planned Test Case", node.id)}`;
    case "GitHub":
      return `${base}${projectAreaNavigationHash("GitHub")}`;
    case "Observation":
      return `${base}${projectAreaNavigationHash("Releases")}`;
    case "Evidence":
    case "Problem or opportunity":
      return `${base}${projectAreaNavigationHash("Discovery")}`;
    case "Project Goal":
      return `${base}project-goal-${encodeURIComponent(node.id)}`;
    default:
      return null;
  }
}
