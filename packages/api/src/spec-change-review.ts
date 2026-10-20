import { diffLines } from "diff";
import { z } from "zod";
import { type DocumentSection, documentSections } from "./documents";
import type { SpecChangeReviewCandidate } from "./spec-change-review-candidates";
import type {
  PreviewSpecChangeReviewFollowUpInput,
  SpecChangeReviewFollowUpPreview,
} from "./spec-change-review-follow-up";

const identifierSchema = z.string().trim().min(1).max(255);

/**
 * Spec Change Review: the queue of exact Document version pairs of a
 * Feature's `Primary spec`. A review stores only the version pair identity;
 * both versions and the section diff are read from Document history.
 */
export const specChangeReviewProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const specChangeReviewInputSchema = z
  .object({ reviewId: identifierSchema })
  .strict();

export type SpecChangeReviewProjectInput = z.infer<
  typeof specChangeReviewProjectInputSchema
>;
export type SpecChangeReviewInput = z.infer<typeof specChangeReviewInputSchema>;

/** The persisted record: identity of the version pair, never a body copy. */
export interface SpecChangeReviewRecord {
  createdAt: string;
  documentId: string;
  featureId: string;
  id: string;
  nextRevision: number;
  previousRevision: number;
  projectId: string;
}

/** Queue row: the record plus live labels of the Feature and Document. */
export interface SpecChangeReviewSummary extends SpecChangeReviewRecord {
  documentTitle: string;
  featureKey: string;
  featureTitle: string;
  projectName: string;
}

export type SpecDiffLineKind = "added" | "removed" | "unchanged" | "omitted";

export interface SpecDiffLine {
  kind: SpecDiffLineKind;
  /** Number of unchanged lines hidden by an `omitted` marker. */
  omitted?: number;
  text: string;
}

export type SpecSectionChangeKind = "Added" | "Removed" | "Changed";

export interface SpecSectionChange {
  change: SpecSectionChangeKind;
  heading: string;
  level: number;
  lines: SpecDiffLine[];
  /** The earlier heading text when the heading itself was renamed. */
  previousHeading: string | null;
  /** Stable section id; `null` is the text before the first heading. */
  sectionId: string | null;
}

export interface SpecVersionDiff {
  sections: SpecSectionChange[];
  titleChange: { next: string; previous: string } | null;
  typeChange: { next: string; previous: string } | null;
}

export interface SpecDiffVersion {
  body: string;
  title: string;
  type: string;
}

export interface SpecChangeReviewDetail {
  /** Recorded-link candidates of this exact version pair. */
  candidates: SpecChangeReviewCandidate[];
  diff: SpecVersionDiff;
  next: { revision: number; title: string; type: string };
  previous: { revision: number; title: string; type: string };
  review: SpecChangeReviewSummary;
}

export interface SpecChangeReviewAccess {
  /** Reads one review: its exact version pair and the version-backed diff. */
  get: (
    accountId: string,
    input: SpecChangeReviewInput,
  ) => Promise<SpecChangeReviewDetail>;
  /** Lists a Project's reviews, newest first. */
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<SpecChangeReviewSummary[]>;
  /**
   * Read-only `Create Follow-up Work` preview of one candidate. Nothing exists
   * until the confirm command; an inaccessible candidate has no preview.
   */
  previewFollowUp: (
    accountId: string,
    input: PreviewSpecChangeReviewFollowUpInput,
  ) => Promise<SpecChangeReviewFollowUpPreview>;
}

const CONTEXT_LINES = 2;

interface OwnSection {
  heading: string;
  id: string | null;
  level: number;
  text: string;
}

/** The text of one section up to the next heading of any level. */
function ownSectionText(
  body: string,
  sections: DocumentSection[],
  index: number,
) {
  const section = sections[index];
  if (!section) {
    return "";
  }
  const following = sections[index + 1];
  if (!following) {
    return body.slice(section.start).trim();
  }
  return stripTrailingHeadingLine(body.slice(section.start, following.start));
}

function stripTrailingHeadingLine(slice: string) {
  const headingLineStart = slice.lastIndexOf("\n", slice.length - 2) + 1;
  return slice.slice(0, headingLineStart).trim();
}

function ownSections(body: string): OwnSection[] {
  const sections = documentSections(body);
  const [first] = sections;
  const result: OwnSection[] = [];
  const introduction = first
    ? stripTrailingHeadingLine(body.slice(0, first.start))
    : body.trim();
  if (introduction) {
    result.push({ heading: "", id: null, level: 0, text: introduction });
  }
  const seen = new Map<string, number>();
  for (const [index, section] of sections.entries()) {
    const occurrence = seen.get(section.id) ?? 0;
    seen.set(section.id, occurrence + 1);
    result.push({
      heading: section.heading,
      // A duplicated id is still diffed, by occurrence, never merged.
      id: occurrence === 0 ? section.id : `${section.id}#${occurrence + 1}`,
      level: section.level,
      text: ownSectionText(body, sections, index),
    });
  }
  return result;
}

function splitLines(value: string) {
  const lines = value.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

function compactUnchanged(lines: SpecDiffLine[]): SpecDiffLine[] {
  const compacted: SpecDiffLine[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line?.kind !== "unchanged") {
      if (line) {
        compacted.push(line);
      }
      index += 1;
      continue;
    }
    let end = index;
    while (lines[end]?.kind === "unchanged") {
      end += 1;
    }
    const run = lines.slice(index, end);
    const leading = index === 0 ? 0 : CONTEXT_LINES;
    const trailing = end === lines.length ? 0 : CONTEXT_LINES;
    if (run.length > leading + trailing + 1) {
      compacted.push(...run.slice(0, leading));
      compacted.push({
        kind: "omitted",
        omitted: run.length - leading - trailing,
        text: "",
      });
      compacted.push(...run.slice(run.length - trailing));
    } else {
      compacted.push(...run);
    }
    index = end;
  }
  return compacted;
}

function sectionLines(previous: string, next: string): SpecDiffLine[] {
  const lines: SpecDiffLine[] = [];
  for (const part of diffLines(previous, next)) {
    let kind: SpecDiffLineKind = "unchanged";
    if (part.added) {
      kind = "added";
    } else if (part.removed) {
      kind = "removed";
    }
    for (const text of splitLines(part.value)) {
      lines.push({ kind, text });
    }
  }
  return compactUnchanged(lines);
}

function wholeSectionLines(text: string, kind: "added" | "removed") {
  return splitLines(text).map((line) => ({ kind, text: line }));
}

/**
 * Version-backed diff of two exact Document versions, grouped by stable
 * section id. It reads only the supplied version bodies; it never consults a
 * Git working tree or an external review tool. Unchanged sections are absent.
 */
export function diffSpecVersions(
  previous: SpecDiffVersion,
  next: SpecDiffVersion,
): SpecVersionDiff {
  const previousSections = ownSections(previous.body);
  const nextSections = ownSections(next.body);
  const previousById = new Map(
    previousSections.map((section) => [section.id, section]),
  );
  const nextIds = new Set(nextSections.map((section) => section.id));
  const sections: SpecSectionChange[] = [];

  for (const section of nextSections) {
    const before = previousById.get(section.id);
    if (!before) {
      sections.push({
        change: "Added",
        heading: section.heading,
        level: section.level,
        lines: wholeSectionLines(section.text, "added"),
        previousHeading: null,
        sectionId: section.id,
      });
      continue;
    }
    const renamed = before.heading !== section.heading;
    if (before.text === section.text && !renamed) {
      continue;
    }
    sections.push({
      change: "Changed",
      heading: section.heading,
      level: section.level,
      lines: sectionLines(before.text, section.text),
      previousHeading: renamed ? before.heading : null,
      sectionId: section.id,
    });
  }
  for (const section of previousSections) {
    if (!nextIds.has(section.id)) {
      sections.push({
        change: "Removed",
        heading: section.heading,
        level: section.level,
        lines: wholeSectionLines(section.text, "removed"),
        previousHeading: null,
        sectionId: section.id,
      });
    }
  }
  return {
    sections,
    titleChange:
      previous.title === next.title
        ? null
        : { next: next.title, previous: previous.title },
    typeChange:
      previous.type === next.type
        ? null
        : { next: next.type, previous: previous.type },
  };
}

/** A Work that may own a `Primary spec` binding; the minimum the rule reads. */
export interface PrimarySpecBinding {
  id: string;
  primarySpecId: string | null;
  projectId: string;
  trashedAt?: Date | string | null;
  type: string;
}

/**
 * The only trigger of a Spec Change Review: a saved new version of a Document
 * that is the `Primary spec` of a Feature. Other Work types, Features bound to
 * another Document and Features without a Primary spec open nothing.
 */
export function featuresBoundToPrimarySpec<T extends PrimarySpecBinding>(
  works: readonly T[],
  documentId: string,
): T[] {
  return works.filter(
    (work) =>
      work.type === "Feature" &&
      work.primarySpecId === documentId &&
      !work.trashedAt,
  );
}
