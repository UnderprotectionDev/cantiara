import { type Document, documentSections } from "@cantiara/api/documents";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type { client } from "@/utils/orpc";

const markdownLineBreakPattern = /\r?\n/;

const markdownListItemPrefixPattern =
  /^(?:[-*+]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s+)?/;

const markdownHeadingPrefixPattern = /^#{1,6}\s+/;

const markdownFenceOpeningPattern = /^ {0,3}(`{3,}|~{3,})/;

const markdownFenceClosingPattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

const markdownListRowPattern =
  /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?(.+?)[ \t]*$/;

export function comparableMarkdown(source: string) {
  return source.replaceAll("\r\n", "\n");
}

export function titleFromSelectedText(source: string) {
  return (
    source
      .split(markdownLineBreakPattern)
      .map((line) =>
        line
          .trim()
          .replace(markdownListItemPrefixPattern, "")
          .replace(markdownHeadingPrefixPattern, ""),
      )
      .find(Boolean)
      ?.slice(0, 255) ?? "Extracted record"
  );
}

export interface DocumentListRow {
  end: number;
  start: number;
  text: string;
}

function advanceMarkdownFence(
  line: string,
  fence: { marker: string; length: number } | null,
) {
  if (fence) {
    const [, closing] = markdownFenceClosingPattern.exec(line) ?? [];
    const closesFence =
      !!closing &&
      closing[0] === fence.marker &&
      closing.length >= fence.length;
    return { fence: closesFence ? null : fence, isFenceLine: true };
  }
  const [, opening] = markdownFenceOpeningPattern.exec(line) ?? [];
  if (opening) {
    return {
      fence: { marker: opening[0] ?? "", length: opening.length },
      isFenceLine: true,
    };
  }
  return { fence: null, isFenceLine: false };
}

function documentListRow(
  rawLine: string,
  offset: number,
): DocumentListRow | null {
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  const match = markdownListRowPattern.exec(line);
  const [, text] = match ?? [];
  const [matchedText] = match ?? [];
  if (!(matchedText && text?.trim())) {
    return null;
  }
  const start = offset + matchedText.indexOf(text);
  return { end: start + text.length, start, text };
}

export function documentListRows(source: string): DocumentListRow[] {
  const rows: DocumentListRow[] = [];
  let offset = 0;
  let fence: { marker: string; length: number } | null = null;
  for (const rawLine of source.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const { fence: nextFence, isFenceLine } = advanceMarkdownFence(line, fence);
    fence = nextFence;
    if (!isFenceLine) {
      const row = documentListRow(rawLine, offset);
      if (row) {
        rows.push(row);
      }
    }
    offset += rawLine.length + 1;
  }
  return rows;
}

export function uniqueDocumentSections(source: string) {
  const sections = documentSections(source);
  const counts = new Map<string, number>();
  for (const section of sections) {
    counts.set(section.id, (counts.get(section.id) ?? 0) + 1);
  }
  return sections.filter(({ id }) => counts.get(id) === 1);
}

export function matchesDiagramConversionPreview(
  preview:
    | Awaited<ReturnType<typeof client.previewMermaidConversion>>
    | undefined,
  selection: { start: number; end: number } | null,
  title: string,
  originalBlock: "Keep independent" | "Replace with live reference",
) {
  return Boolean(
    preview &&
      selection &&
      preview.title === title &&
      preview.originalBlock === originalBlock &&
      preview.blockStart === selection.start &&
      preview.blockEnd === selection.end,
  );
}

export function documentRecordReferenceOptions(
  works: WorkProfile[] | undefined,
  documents: Document[] | undefined,
  sourceRecords:
    | Awaited<ReturnType<typeof client.projectSourceRecords>>
    | undefined,
  diagrams: Awaited<ReturnType<typeof client.technicalDiagrams>> | undefined,
  documentId: string,
) {
  return [
    ...(works ?? []).map((candidate) => ({
      id: candidate.id,
      label: `${candidate.key} · ${candidate.title}`,
      recordType: "Work",
    })),
    ...(documents ?? [])
      .filter(({ id }) => id !== documentId)
      .map((candidate) => ({
        id: candidate.id,
        label: candidate.title,
        recordType: "Document",
      })),
    ...(sourceRecords ?? []).map((candidate) => ({
      id: candidate.id,
      label: "name" in candidate ? candidate.name : candidate.title,
      recordType: candidate.sourceType,
    })),
    ...(diagrams ?? []).map((candidate) => ({
      id: candidate.id,
      label: candidate.title,
      recordType: "Technical Diagram",
    })),
  ];
}

export type DocumentView = "write" | "markdown" | "preview";
