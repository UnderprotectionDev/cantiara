import { z } from "zod";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import {
  PROJECT_RELEASE_STATUS_OPTIONS,
  type projectReleaseRecordSchema,
} from "./project-source-records";

/**
 * Project Release Planning seam (spec 63): the publishable scope of one
 * Project Release. The record's own fields, hypothesis and status are written
 * only through the Project source record commands; this seam owns scope
 * membership, repository/environment references and audience links. Nothing
 * here writes a status, fills scope automatically, scores readiness or holds a
 * planned or actual publish date.
 */

const identifier = z.string().trim().min(1).max(255);

export type ProjectReleaseRecord = z.infer<typeof projectReleaseRecordSchema>;
export type ProjectReleaseStatus = ProjectReleaseRecord["status"];

export const PROJECT_RELEASE_LINK_KINDS = [
  "Tag",
  "Release",
  "Environment link",
] as const;
export const projectReleaseLinkKindSchema = z.enum(PROJECT_RELEASE_LINK_KINDS);
export type ProjectReleaseLinkKind = z.infer<
  typeof projectReleaseLinkKindSchema
>;

export const PROJECT_RELEASE_AUDIENCE_TYPES = [
  "Persona",
  "Contact",
  "Company",
] as const;
export const projectReleaseAudienceTypeSchema = z.enum(
  PROJECT_RELEASE_AUDIENCE_TYPES,
);
export type ProjectReleaseAudienceType = z.infer<
  typeof projectReleaseAudienceTypeSchema
>;

export const projectReleasePlanningProjectInputSchema = z
  .object({ projectId: identifier })
  .strict();
export const projectReleasePlanningInputSchema = z
  .object({ projectId: identifier, releaseId: identifier })
  .strict();

/** Add or remove one Work of the same Project in the release scope. */
export const setProjectReleaseScopeInputSchema = humanMutationEnvelopeSchema
  .extend({
    attached: z.boolean(),
    projectId: identifier,
    releaseId: identifier,
    workId: identifier,
  })
  .strict();
export type SetProjectReleaseScopeInput = z.infer<
  typeof setProjectReleaseScopeInputSchema
>;

const linkUrl = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .nullable();

/**
 * Attach or remove a tag, GitHub Release or environment reference. Tag and
 * Release name one of the Project's linked repositories; an Environment link
 * needs its URL and may name a repository.
 */
export const setProjectReleaseLinkInputSchema = humanMutationEnvelopeSchema
  .extend({
    attached: z.boolean(),
    id: identifier,
    kind: projectReleaseLinkKindSchema,
    label: z.string().trim().min(1).max(255),
    projectId: identifier,
    releaseId: identifier,
    repositoryLinkId: identifier.nullable(),
    url: linkUrl,
  })
  .strict()
  .refine(
    (input) => input.kind === "Environment link" || input.repositoryLinkId,
    {
      message: "Choose one of this Project's repositories.",
      path: ["repositoryLinkId"],
    },
  )
  .refine((input) => input.kind !== "Environment link" || input.url, {
    message: "Enter the environment URL.",
    path: ["url"],
  });
export type SetProjectReleaseLinkInput = z.infer<
  typeof setProjectReleaseLinkInputSchema
>;

/** Attach or remove a Persona Document, Contact or Company audience link. */
export const setProjectReleaseAudienceInputSchema = humanMutationEnvelopeSchema
  .extend({
    attached: z.boolean(),
    projectId: identifier,
    releaseId: identifier,
    targetId: identifier,
    targetType: projectReleaseAudienceTypeSchema,
  })
  .strict();
export type SetProjectReleaseAudienceInput = z.infer<
  typeof setProjectReleaseAudienceInputSchema
>;

export interface ProjectReleaseWork {
  closureResult: string | null;
  id: string;
  key: string;
  status: string;
  title: string | null;
  type: string;
  /** Archived or trashed Work stays listed without its content. */
  unavailable: boolean;
}
export interface ProjectReleaseScopeMember {
  attached: boolean;
  id: string;
  revision: number;
  work: ProjectReleaseWork;
}
export interface ProjectReleaseRepository {
  id: string;
  name: string;
  owner: string;
}
export interface ProjectReleaseLink {
  attached: boolean;
  id: string;
  kind: ProjectReleaseLinkKind;
  label: string;
  repository: ProjectReleaseRepository | null;
  revision: number;
  url: string | null;
}
export interface ProjectReleaseAudienceTarget {
  id: string;
  title: string;
  type: ProjectReleaseAudienceType;
}
export interface ProjectReleaseAudienceLink {
  attached: boolean;
  id: string;
  revision: number;
  target: ProjectReleaseAudienceTarget;
}
export interface ProjectReleaseScopeCounts {
  completed: number;
  open: number;
}
export interface ProjectReleaseSummary {
  githubReferences: number;
  lastChangedAt: string;
  release: ProjectReleaseRecord;
  scope: ProjectReleaseScopeCounts;
}
export interface ProjectReleaseOverview {
  readOnly: boolean;
  releases: ProjectReleaseSummary[];
}
export interface ProjectReleasePlanningDetail {
  audience: ProjectReleaseAudienceLink[];
  audienceCandidates: ProjectReleaseAudienceTarget[];
  links: ProjectReleaseLink[];
  readOnly: boolean;
  release: ProjectReleaseRecord;
  repositories: ProjectReleaseRepository[];
  scope: ProjectReleaseScopeMember[];
  scopeCandidates: ProjectReleaseWork[];
}

export class ProjectReleasePlanningConflictError extends Error {
  readonly code = "CONFLICT" as const;
  readonly targetId: string;
  constructor(targetId: string, options?: ErrorOptions) {
    super("Project Release changed. Reload before saving.", options);
    this.name = "ProjectReleasePlanningConflictError";
    this.targetId = targetId;
  }
}

export interface ProjectReleasePlanningAccess {
  detail: (
    accountId: string,
    input: z.infer<typeof projectReleasePlanningInputSchema>,
  ) => Promise<ProjectReleasePlanningDetail | null>;
  overview: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectReleaseOverview | null>;
  setAudience: (
    accountId: string,
    input: SetProjectReleaseAudienceInput,
  ) => Promise<ProjectReleaseAudienceLink | null>;
  setLink: (
    accountId: string,
    input: SetProjectReleaseLinkInput,
  ) => Promise<ProjectReleaseLink | null>;
  setScope: (
    accountId: string,
    input: SetProjectReleaseScopeInput,
  ) => Promise<ProjectReleaseScopeMember | null>;
}

export type ProjectReleaseScopeGroup = "Open" | "Completed" | "Closed";

/** Scope groups follow the Work's own status; scope never writes it. */
export function projectReleaseScopeGroup(
  work: Pick<ProjectReleaseWork, "status" | "closureResult">,
): ProjectReleaseScopeGroup {
  if (work.status !== "Closed") {
    return "Open";
  }
  return work.closureResult === "Completed" ? "Completed" : "Closed";
}

export function projectReleaseScopeCounts(
  scope: readonly Pick<ProjectReleaseScopeMember, "attached" | "work">[],
): ProjectReleaseScopeCounts {
  const counts = { completed: 0, open: 0 };
  for (const member of scope) {
    if (!member.attached || member.work.unavailable) {
      continue;
    }
    const group = projectReleaseScopeGroup(member.work);
    if (group === "Completed") {
      counts.completed += 1;
    } else if (group === "Open") {
      counts.open += 1;
    }
  }
  return counts;
}

/** Status groups of the `Project Releases` overview in the catalog order. */
export function groupProjectReleasesByStatus<
  T extends { release: Pick<ProjectReleaseRecord, "status"> },
>(releases: readonly T[]) {
  return PROJECT_RELEASE_STATUS_OPTIONS.map((status) => ({
    status,
    releases: releases.filter((summary) => summary.release.status === status),
  })).filter((group) => group.releases.length > 0);
}
