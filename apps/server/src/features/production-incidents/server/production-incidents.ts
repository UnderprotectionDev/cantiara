import type {
  ProductionIncidentLinkTarget,
  ProductionIncidentLinkType,
} from "@cantiara/api/production-incidents";

/**
 * Production Incidents behavior (spec 66) that needs no database: which
 * records an incident may bind, how a bound record is shown, and the stable
 * link id. Binding is context only: nothing here names a write to the linked
 * record, a Completion Effect, or a Bug, Risk or Work to create.
 */

export interface BugCandidate {
  archivedAt: Date | null;
  id: string;
  key: string;
  status: string;
  title: string;
  trashedAt: Date | null;
  type: string;
}
export interface PullRequestCandidate {
  archivedAt: Date | null;
  id: string;
  kind: string;
  number: number;
  repository: string;
  sourceState: string;
  title: string;
  trashedAt: Date | null;
}
export interface ReleaseCandidate {
  id: string;
  name: string;
  status: string;
}
export interface RiskCandidate {
  id: string;
  life: string;
  title: string;
}
export interface DecisionCandidate {
  id: string;
  life: string;
  title: string;
}

function unavailable(
  type: ProductionIncidentLinkType,
  id: string,
): ProductionIncidentLinkTarget {
  return { id, label: null, status: null, type, unavailable: true };
}

/** A Bug is a Work of type `Bug`; archived or trashed Work stays listed without content. */
export function bugTarget(row: BugCandidate): ProductionIncidentLinkTarget {
  return row.archivedAt || row.trashedAt
    ? unavailable("Bug", row.id)
    : {
        id: row.id,
        label: `${row.key} ${row.title}`,
        status: row.status,
        type: "Bug",
        unavailable: false,
      };
}

export function pullRequestTarget(
  row: PullRequestCandidate,
): ProductionIncidentLinkTarget {
  return row.archivedAt || row.trashedAt
    ? unavailable("GitHub PR", row.id)
    : {
        id: row.id,
        label: `${row.repository}#${row.number} ${row.title}`,
        status: row.sourceState,
        type: "GitHub PR",
        unavailable: false,
      };
}

export function releaseTarget(
  row: ReleaseCandidate,
): ProductionIncidentLinkTarget {
  return {
    id: row.id,
    label: row.name,
    status: row.status,
    type: "Project Release",
    unavailable: false,
  };
}

export function riskTarget(row: RiskCandidate): ProductionIncidentLinkTarget {
  return {
    id: row.id,
    label: row.title,
    status: row.life,
    type: "Risk",
    unavailable: false,
  };
}

export function decisionTarget(
  row: DecisionCandidate,
): ProductionIncidentLinkTarget {
  return {
    id: row.id,
    label: row.title,
    status: row.life,
    type: "Decision",
    unavailable: false,
  };
}

/** The target stays listed after its record disappeared, without content. */
export function missingTarget(
  type: ProductionIncidentLinkType,
  id: string,
): ProductionIncidentLinkTarget {
  return unavailable(type, id);
}

/** Only a live Bug (Work of type `Bug`) may be bound as a Bug. */
export function isBindableBug(row: BugCandidate) {
  return row.type === "Bug" && !row.archivedAt && !row.trashedAt;
}

/** Only a live GitHub pull request may be bound as a GitHub PR, never an Issue. */
export function isBindablePullRequest(row: PullRequestCandidate) {
  return row.kind === "Pull request" && !row.archivedAt && !row.trashedAt;
}

/** Payload-derived id: an identical repeated add reuses the same row. */
export async function productionIncidentLinkId(parts: {
  incidentId: string;
  projectId: string;
  targetId: string;
  targetType: ProductionIncidentLinkType;
}) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([
        parts.projectId,
        parts.incidentId,
        parts.targetType,
        parts.targetId,
      ]),
    ),
  );
  return `incident-link:${Buffer.from(digest).toString("hex")}`;
}
