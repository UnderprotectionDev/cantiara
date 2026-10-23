import type {
  ProjectReleaseLinkKind,
  ProjectReleaseRecord,
} from "@cantiara/api/project-release-planning";
import { PROJECT_RELEASE_HYPOTHESIS_FIELDS } from "@cantiara/api/project-source-records";
import { z } from "zod";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

/** The project shell hash of the `Releases` area. */
export const PROJECT_RELEASES_HASH = "project-area-releases";

export function projectReleasesHref(projectId: string, releaseId?: string) {
  const hash = releaseId
    ? projectSourceRecordHash("Project Release", releaseId)
    : PROJECT_RELEASES_HASH;
  return `/projects/${encodeURIComponent(projectId)}#${hash}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

/** Create dialog: Name, Version label and Description; never a date. */
export const projectReleaseCreateFormSchema = z
  .object({
    description: optionalText(20_000),
    name: z.string().trim().min(1).max(255),
    versionLabel: optionalText(255),
  })
  .strict();
export type ProjectReleaseCreateDraft = z.input<
  typeof projectReleaseCreateFormSchema
>;
export const EMPTY_PROJECT_RELEASE_CREATE_DRAFT: ProjectReleaseCreateDraft = {
  description: "",
  name: "",
  versionLabel: "",
};

/** Five separate optional hypothesis fields; empty is valid. */
export const projectReleaseHypothesisFormSchema = z
  .object(
    Object.fromEntries(
      PROJECT_RELEASE_HYPOTHESIS_FIELDS.map(({ name }) => [
        name,
        optionalText(20_000),
      ]),
    ) as Record<
      (typeof PROJECT_RELEASE_HYPOTHESIS_FIELDS)[number]["name"],
      ReturnType<typeof optionalText>
    >,
  )
  .strict();
export type ProjectReleaseHypothesisDraft = z.input<
  typeof projectReleaseHypothesisFormSchema
>;
export type ProjectReleaseHypothesis = z.output<
  typeof projectReleaseHypothesisFormSchema
>;

export function projectReleaseHypothesisDraft(
  release: ProjectReleaseRecord,
): ProjectReleaseHypothesisDraft {
  return Object.fromEntries(
    PROJECT_RELEASE_HYPOTHESIS_FIELDS.map(({ name }) => [
      name,
      release[name] ?? "",
    ]),
  ) as ProjectReleaseHypothesisDraft;
}

export const projectReleaseLinkFormSchema = z
  .object({
    kind: z.enum(["Tag", "Release", "Environment link"]),
    label: z.string().trim().min(1).max(255),
    repositoryLinkId: z
      .string()
      .trim()
      .transform((value) => value || null),
    url: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(
        z
          .url({ protocol: /^https?$/ })
          .max(2048)
          .nullable(),
      ),
  })
  .strict()
  .refine(
    (draft) => draft.kind === "Environment link" || draft.repositoryLinkId,
    {
      message: "Choose one of this Project's repositories.",
      path: ["repositoryLinkId"],
    },
  )
  .refine((draft) => draft.kind !== "Environment link" || draft.url, {
    message: "Enter the environment URL.",
    path: ["url"],
  });
export interface ProjectReleaseLinkDraft {
  kind: ProjectReleaseLinkKind;
  label: string;
  repositoryLinkId: string;
  url: string;
}
export const EMPTY_PROJECT_RELEASE_LINK_DRAFT: ProjectReleaseLinkDraft = {
  kind: "Tag",
  label: "",
  repositoryLinkId: "",
  url: "",
};

export const PROJECT_RELEASE_SCOPE_GROUPS = [
  { group: "Open", label: "Open" },
  { group: "Completed", label: "Completed" },
  { group: "Closed", label: "Closed" },
] as const;
