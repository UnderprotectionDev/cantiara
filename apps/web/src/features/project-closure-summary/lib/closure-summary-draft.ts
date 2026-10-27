import {
  type ClosureSummarySection,
  type ClosureSummarySourceRef,
  renderClosureSummaryMarkdown,
} from "@cantiara/api/project-closure-summary";
import { z } from "zod";
import { projectRecordHref } from "@/features/project-history/lib/project-record-links";

/** Form schema: the selected sources as `<record type>:<record id>` keys. */
export const closureSummarySelectionFormSchema = z.object({
  selected: z.array(z.string()),
});
export type ClosureSummarySelectionForm = z.infer<
  typeof closureSummarySelectionFormSchema
>;

export function closureSummarySelectionKey(source: ClosureSummarySourceRef) {
  return `${source.recordType}:${source.recordId}`;
}

/** Splits at the first colon; a record id may contain a colon itself. */
export function closureSummarySourcesOfSelection(
  keys: readonly string[],
): ClosureSummarySourceRef[] {
  return keys.flatMap((key) => {
    const separator = key.indexOf(":");
    const parsed = z
      .enum([
        "Decision",
        "Risk",
        "Project Release",
        "Document",
        "Production Incident",
        "Work",
      ])
      .safeParse(key.slice(0, separator));
    return parsed.success
      ? [{ recordId: key.slice(separator + 1), recordType: parsed.data }]
      : [];
  });
}

export function toggleClosureSummarySelection(
  selected: readonly string[],
  key: string,
  checked: boolean | "indeterminate",
) {
  const rest = selected.filter((existing) => existing !== key);
  return checked === true ? [...rest, key] : rest;
}

/** The editable markdown of a draft: headings and links to the owner records. */
export function closureSummaryMarkdownOf(
  projectId: string,
  sections: readonly ClosureSummarySection[],
) {
  return renderClosureSummaryMarkdown(sections, (source) =>
    projectRecordHref(projectId, source),
  );
}
