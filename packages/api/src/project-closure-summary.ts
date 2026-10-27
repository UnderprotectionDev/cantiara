import { z } from "zod";
import {
  documentBodySchema,
  documentSchema,
  documentTitleSchema,
} from "./documents";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

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
export const CLOSURE_SUMMARY_SAVE_LABEL = "Save as Document" as const;
export const CLOSURE_SUMMARY_DOCUMENT_TYPE = "General" as const;
export const CLOSURE_SUMMARY_DATE_HISTORY_LABEL =
  "Planned date history" as const;
export const CLOSURE_SUMMARY_DATE_NOTE =
  "This is a reading of existing history. It is not a score." as const;
/** Existing Documents transfer label; the Personal Wiki copy reuses it. */
export const CLOSURE_SUMMARY_WIKI_COPY_LABEL = "Copy Document" as const;
export const CLOSURE_SUMMARY_DRAFT_NOTE =
  "The draft contains only headings and links to your records. It writes no conclusions." as const;

/** Project lifecycle statuses on which the draft is offered. */
export const CLOSURE_SUMMARY_PROJECT_STATUSES = [
  "Completed",
  "Abandoned",
] as const;

export type ClosureSummaryProjectStatus =
  (typeof CLOSURE_SUMMARY_PROJECT_STATUSES)[number];

export function isClosureSummaryProjectStatus(
  status: string,
): status is ClosureSummaryProjectStatus {
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

/**
 * Explicit save. The Document is created through the Documents create path
 * (type `General`, scope = the source Project, which is the Document's
 * Kökeni); there is no closure store. The envelope is the Mutation Contract
 * envelope, so a retry with the same key is idempotent.
 */
export const saveClosureSummaryInputSchema = humanMutationEnvelopeSchema
  .extend({
    body: documentBodySchema,
    projectId: identifierSchema,
    title: documentTitleSchema.default(PROJECT_CLOSURE_SUMMARY_LABEL),
  })
  .strict();
export type SaveClosureSummaryInput = z.infer<
  typeof saveClosureSummaryInputSchema
>;
export const saveClosureSummaryResultSchema = documentSchema;

// ---------------------------------------------------------------------------
// Optional neutral date comparison (a reading of existing history)
// ---------------------------------------------------------------------------

export const CLOSURE_SUMMARY_DATE_READINGS = [
  "Before target",
  "On target",
  "After target",
  "Still open",
] as const;
export type ClosureSummaryDateReading =
  (typeof CLOSURE_SUMMARY_DATE_READINGS)[number];

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** What an owner record's own history says; the input of the pure reading. */
export const closureSummaryDateFactsSchema = z
  .object({
    /** When the record was completed or closed, from its own history. */
    closedAt: z.string().nullable(),
    /** The record's current planned target date. */
    currentTargetDate: isoDateSchema.nullable(),
    label: z.string(),
    recordId: z.string(),
    recordType: z.enum(CLOSURE_SUMMARY_SOURCE_TYPES),
    /** Every planned target date the record held, oldest first. */
    targetDates: z.array(isoDateSchema),
  })
  .strict();
export type ClosureSummaryDateFacts = z.infer<
  typeof closureSummaryDateFactsSchema
>;

/** One neutral row. No score, health, severity or actual-date field exists. */
export const closureSummaryDateRowSchema = z
  .object({
    closedOn: isoDateSchema.nullable(),
    label: z.string(),
    moved: z.boolean(),
    plannedDates: z.array(isoDateSchema),
    reading: z.enum(CLOSURE_SUMMARY_DATE_READINGS),
    recordId: z.string(),
    recordType: z.enum(CLOSURE_SUMMARY_SOURCE_TYPES),
  })
  .strict();
export type ClosureSummaryDateRow = z.infer<typeof closureSummaryDateRowSchema>;

export const closureSummaryDateComparisonSchema = z
  .object({
    note: z.literal(CLOSURE_SUMMARY_DATE_NOTE),
    projectId: z.string(),
    rows: z.array(closureSummaryDateRowSchema),
  })
  .strict();
export type ClosureSummaryDateComparison = z.infer<
  typeof closureSummaryDateComparisonSchema
>;

export const closureSummaryDateComparisonInputSchema =
  closureSummaryDraftInputSchema;
export type ClosureSummaryDateComparisonInput = ClosureSummaryDraftInput;

/** `YYYY-MM-DD` of an instant in the Account's time zone. */
export function closureSummaryLocalDate(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(new Date(instant));
  return parts;
}

/**
 * Reads existing history only. A record with no current planned date (never set or
 * cleared) is omitted: there is nothing to compare. `moved` is true when the planned date changed from
 * one date to another. The reading compares the current planned date with the
 * Account-zone date of the completion or closure event; an event-less record
 * reads `Still open`.
 */
export function deriveClosureSummaryDateComparison(
  projectId: string,
  facts: readonly ClosureSummaryDateFacts[],
  timeZone: string,
): ClosureSummaryDateComparison {
  const rows = facts.flatMap((fact): ClosureSummaryDateRow[] => {
    const plannedDates = fact.targetDates.filter(
      (date, index, all) => index === 0 || date !== all[index - 1],
    );
    // A cleared planned date is no planned date: never fall back to history.
    const target = fact.currentTargetDate;
    if (target === null) {
      return [];
    }
    const closedOn = fact.closedAt
      ? closureSummaryLocalDate(fact.closedAt, timeZone)
      : null;
    let reading: ClosureSummaryDateReading = "Still open";
    if (closedOn !== null) {
      if (closedOn < target) {
        reading = "Before target";
      } else if (closedOn === target) {
        reading = "On target";
      } else {
        reading = "After target";
      }
    }
    return [
      {
        closedOn,
        label: fact.label,
        moved: plannedDates.length > 1,
        plannedDates,
        reading,
        recordId: fact.recordId,
        recordType: fact.recordType,
      },
    ];
  });
  return {
    note: CLOSURE_SUMMARY_DATE_NOTE,
    projectId,
    rows: rows.sort(
      (a, b) =>
        a.label.localeCompare(b.label) || a.recordId.localeCompare(b.recordId),
    ),
  };
}

/** Read-only access; the contract has no write member. */
export interface ProjectClosureSummaryAccess {
  /** Optional neutral reading of the selected records' planned date history. */
  dateComparison: (
    accountId: string,
    input: ClosureSummaryDateComparisonInput,
  ) => Promise<ClosureSummaryDateComparison>;
  /** Preview and generate share this read: nothing is persisted. */
  draft: (
    accountId: string,
    input: ClosureSummaryDraftInput,
  ) => Promise<ClosureSummaryDraft>;
  /**
   * Resolves the Project a save would be scoped to; refuses a Project the
   * account does not own or that is not completed or abandoned. Writes nothing.
   */
  saveTarget: (
    accountId: string,
    projectId: string,
  ) => Promise<{ projectId: string }>;
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
