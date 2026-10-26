import type {
  ValueChainGap,
  ValueChainNodeType,
} from "@cantiara/api/value-chain";
import { projectAreaNavigationHash } from "@/features/project-shell/lib/project-area-navigation";
import {
  projectSourceRecordHash,
  testsAreaRecordHash,
  workRecordHash,
  workRelationsHash,
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

export interface ValueChainGapActions {
  /** Opens where the owning feature picks an existing record. */
  choose: string;
  /** Opens the owning feature's normal create flow. */
  start: string;
}

/**
 * Where a gap leads. Both paths are plain navigation into the owning feature:
 * nothing is written by following them, and a gap without an owner surface
 * returns null so the view reports it instead of guessing.
 */
export function valueChainGapActions(
  projectId: string,
  gap: Pick<ValueChainGap, "from" | "missing">,
): ValueChainGapActions | null {
  const base = `/projects/${encodeURIComponent(projectId)}#`;
  const area = (name: Parameters<typeof projectAreaNavigationHash>[0]) =>
    `${base}${projectAreaNavigationHash(name)}`;
  switch (gap.missing) {
    case "Work":
      return {
        choose: `${base}project-goal-${encodeURIComponent(gap.from.id)}`,
        start: area("Work"),
      };
    case "Decision":
      return {
        choose: `${base}${workRelationsHash(gap.from.id)}`,
        start: area("Decisions"),
      };
    case "Test":
      return { choose: area("Tests"), start: area("Tests") };
    case "Project Release":
      return { choose: area("Releases"), start: area("Releases") };
    default:
      return null;
  }
}
