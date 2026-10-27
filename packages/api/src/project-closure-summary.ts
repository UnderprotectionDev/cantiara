import { z } from "zod";

/**
 * Project Closure Summary seam, Closure Summary Draft (spec 70, Kapanış özeti
 * taslağı).
 *
 * The draft is a live, derived, ephemeral read of a completed or abandoned
 * Project's own records. It persists nothing: it is not a Belge, not a
 * Başlangıç iskeleti and not a closure ana kayıt. It contains only section
 * headings and readable source links; the closed shapes below have no field
 * that could carry commentary, a result, a success judgment, a rationale or a
 * summary sentence.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const PROJECT_CLOSURE_SUMMARY_LABEL = "Project Closure Summary" as const;
export const CLOSURE_SUMMARY_DRAFT_LABEL = "Closure Summary Draft" as const;
export const CLOSURE_SUMMARY_SELECT_SOURCES_LABEL = "Select sources" as const;
export const CLOSURE_SUMMARY_PREVIEW_LABEL = "Preview headings" as const;
export const CLOSURE_SUMMARY_GENERATE_LABEL = "Generate draft" as const;
export const CLOSURE_SUMMARY_DISCARD_LABEL = "Discard draft" as const;
export const CLOSURE_SUMMARY_DRAFT_NOTE =
  "The draft contains only headings and links to your records. It writes no conclusions." as const;

/** Project lifecycle statuses on which the draft is offered. */
export const CLOSURE_SUMMARY_PROJECT_STATUSES = [
  "Completed",
  "Abandoned",
] as const;

export function isClosureSummaryProjectStatus(status: string): boolean {
  return (CLOSURE_SUMMARY_PROJECT_STATUSES as readonly string[]).includes(
    status,
  );
}

/** Owner record kinds that can be a source; completed Work is `Work`. */
export const CLOSURE_SUMMARY_SOURCE_TYPES = [
  "Decision",
  "Risk",
  "Project Release",
  "Document",
  "Production Incident",
  "Work",
] as const;
export type ClosureSummarySourceType =
  (typeof CLOSURE_SUMMARY_SOURCE_TYPES)[number];

/** The section heading each source type lands under (also the group label). */
export const CLOSURE_SUMMARY_HEADINGS: Record<
  ClosureSummarySourceType,
  string
> = {
  Decision: "Decisions",
  Document: "Documents",
  "Production Incident": "Production Incidents",
  "Project Release": "Project Releases",
  Risk: "Risks",
  Work: "Completed Work",
};

export const closureSummarySourceRefSchema = z
  .object({
    recordId: identifierSchema,
    recordType: z.enum(CLOSURE_SUMMARY_SOURCE_TYPES),
  })
  .strict();
export type ClosureSummarySourceRef = z.infer<
  typeof closureSummarySourceRefSchema
>;

/** A selectable source: the owner record and the text its link shows. */
export const closureSummaryCandidateSchema = z
  .object({
    label: z.string(),
    recordId: z.string(),
    recordType: z.enum(CLOSURE_SUMMARY_SOURCE_TYPES),
  })
  .strict();
export type ClosureSummaryCandidate = z.infer<
  typeof closureSummaryCandidateSchema
>;

export const closureSummarySourceGroupSchema = z
  .object({
    candidates: z.array(closureSummaryCandidateSchema),
    heading: z.string(),
    recordType: z.enum(CLOSURE_SUMMARY_SOURCE_TYPES),
  })
  .strict();
export type ClosureSummarySourceGroup = z.infer<
  typeof closureSummarySourceGroupSchema
>;

/** Source selection result. `eligible` is false unless the Project is closed. */
export const closureSummarySourcesSchema = z
  .object({
    eligible: z.boolean(),
    groups: z.array(closureSummarySourceGroupSchema),
    projectId: z.string(),
    projectStatus: z.string(),
  })
  .strict();
export type ClosureSummarySources = z.infer<typeof closureSummarySourcesSchema>;

export const closureSummarySourcesInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();
export type ClosureSummarySourcesInput = z.infer<
  typeof closureSummarySourcesInputSchema
>;

export const MAX_CLOSURE_SUMMARY_SOURCES = 500;

export const closureSummaryDraftInputSchema = z
  .object({
    projectId: identifierSchema,
    sources: z
      .array(closureSummarySourceRefSchema)
      .max(MAX_CLOSURE_SUMMARY_SOURCES),
  })
  .strict();
export type ClosureSummaryDraftInput = z.infer<
  typeof closureSummaryDraftInputSchema
>;

/** One heading and the sources that land under it. */
export const closureSummarySectionSchema = z
  .object({
    heading: z.string(),
    recordType: z.enum(CLOSURE_SUMMARY_SOURCE_TYPES),
    sources: z.array(closureSummaryCandidateSchema),
  })
  .strict();
export type ClosureSummarySection = z.infer<typeof closureSummarySectionSchema>;

/**
 * The preview of the draft. Heading-and-link mapping only; the editable
 * markdown is `renderClosureSummaryMarkdown(preview.sections, hrefOf)`.
 */
export const closureSummaryDraftSchema = z
  .object({
    projectId: z.string(),
    sections: z.array(closureSummarySectionSchema),
  })
  .strict();
export type ClosureSummaryDraft = z.infer<typeof closureSummaryDraftSchema>;

/** Read-only access; the contract has no write member. */
export interface ProjectClosureSummaryAccess {
  /** Preview and generate share this read: nothing is persisted. */
  draft: (
    accountId: string,
    input: ClosureSummaryDraftInput,
  ) => Promise<ClosureSummaryDraft>;
  sources: (
    accountId: string,
    input: ClosureSummarySourcesInput,
  ) => Promise<ClosureSummarySources>;
}

const byLabel = (a: ClosureSummaryCandidate, b: ClosureSummaryCandidate) =>
  a.label.localeCompare(b.label) || a.recordId.localeCompare(b.recordId);

/** Every source type has its group, in heading order; candidates sorted. */
export function groupClosureSummaryCandidates(
  candidates: readonly ClosureSummaryCandidate[],
): ClosureSummarySourceGroup[] {
  return CLOSURE_SUMMARY_SOURCE_TYPES.map((recordType) => ({
    candidates: candidates
      .filter((candidate) => candidate.recordType === recordType)
      .sort(byLabel),
    heading: CLOSURE_SUMMARY_HEADINGS[recordType],
    recordType,
  }));
}

/**
 * Maps selected sources to their headings. A heading with no selected source
 * is omitted; a source selected twice appears once. Only the selected owner
 * records contribute, and no text of the records is carried except the label
 * their link shows.
 */
export function deriveClosureSummaryPreview(
  projectId: string,
  selected: readonly ClosureSummaryCandidate[],
): ClosureSummaryDraft {
  const seen = new Set<string>();
  const unique = selected.filter((candidate) => {
    const key = `${candidate.recordType}:${candidate.recordId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const sections = groupClosureSummaryCandidates(unique)
    .filter((group) => group.candidates.length > 0)
    .map((group) => ({
      heading: group.heading,
      recordType: group.recordType,
      sources: group.candidates,
    }));
  return { projectId, sections };
}

const escapeLinkText = (text: string) =>
  text
    .replaceAll(/\s+/g, " ")
    .trim()
    .replaceAll(/[\\[\]]/g, (char) => `\\${char}`);

const escapeHref = (href: string) =>
  href.replaceAll(" ", "%20").replaceAll("(", "%28").replaceAll(")", "%29");

/**
 * The editable markdown: one `## heading` per section and one `- [label](href)`
 * line per source. Nothing else is written: no title sentence, commentary,
 * result, success judgment, rationale or summary.
 */
export function renderClosureSummaryMarkdown(
  sections: readonly ClosureSummarySection[],
  hrefOf: (source: ClosureSummaryCandidate) => string,
): string {
  return sections
    .map((section) =>
      [
        `## ${section.heading}`,
        "",
        ...section.sources.map(
          (source) =>
            `- [${escapeLinkText(source.label)}](${escapeHref(hrefOf(source))})`,
        ),
      ].join("\n"),
    )
    .join("\n\n");
}
