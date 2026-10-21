import type {
  CloseToolEscapeInput,
  ProductGapLinkInput,
  ProductGapLinkTargetType,
  ProductGapLinkView,
  ProductGapStatus,
  RecordToolEscapeInput,
  ToolEscapeImpact,
  ToolEscapeReason,
  ToolEscapeRestoreMethod,
} from "@cantiara/api/product-gaps";

/** A related record as the form holds it: the label is display only and never sent. */
export interface LinkDraft {
  label: string;
  targetId: string;
  targetType: ProductGapLinkTargetType;
}

/** The Tool Escape half of `Record Product Gap`, as the form holds it. */
export interface EscapeFormValues {
  intendedJob: string;
  note: string;
  /** `datetime-local` value in the founder's time zone. */
  occurredAt: string;
  reasons: ToolEscapeReason[];
  source: LinkDraft | null;
  tool: string;
}

export interface GapFormValues {
  escape: EscapeFormValues;
  /** Empty chooses a new Product Gap; an id attaches to that existing one. */
  existingGapId: string;
  links: LinkDraft[];
  scope: string;
  title: string;
  unmetNeed: string;
}

/** `YYYY-MM-DDTHH:mm` of `date` in local time, the `datetime-local` format. */
export function toLocalDateTime(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function emptyGapForm(now: Date = new Date()): GapFormValues {
  return {
    escape: {
      intendedJob: "",
      note: "",
      occurredAt: toLocalDateTime(now),
      reasons: [],
      source: null,
      tool: "",
    },
    existingGapId: "",
    links: [],
    scope: "",
    title: "",
    unmetNeed: "",
  };
}

/** Filters of the dogfooding summary; each only selects, none orders. */
export interface GapFilterValues {
  projectId: string;
  reason: string;
  status: string;
  tool: string;
}

export const EMPTY_GAP_FILTER: GapFilterValues = {
  projectId: "",
  reason: "",
  status: "",
  tool: "",
};

export function toListFilter(filter: GapFilterValues) {
  return {
    ...(filter.projectId ? { projectId: filter.projectId } : {}),
    ...(filter.reason ? { reason: filter.reason as ToolEscapeReason } : {}),
    ...(filter.status ? { status: filter.status as ProductGapStatus } : {}),
    ...(filter.tool ? { tool: filter.tool } : {}),
  };
}

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function linkLabel(link: ProductGapLinkView) {
  const prefix = link.kind === "Follow-up" ? "Follow-up " : "";
  if (link.state === "broken") {
    return `${prefix}${link.targetType}: unavailable (${link.brokenReason ?? "No access"})`;
  }
  return `${prefix}${link.targetType}: ${link.label ?? ""}`;
}

export function toLinkInputs(
  drafts: readonly LinkDraft[],
): ProductGapLinkInput[] {
  return drafts.map(({ targetId, targetType }) => ({ targetId, targetType }));
}

/** A missing source is refused by the form before this is called. */
export function toRecordToolEscapeInput(
  values: GapFormValues,
  source: LinkDraft,
): RecordToolEscapeInput {
  const { escape: fields } = values;
  return {
    escape: {
      intendedJob: fields.intendedJob,
      note: fields.note || null,
      occurredAt: new Date(fields.occurredAt).toISOString(),
      reasons: fields.reasons,
      source: { targetId: source.targetId, targetType: source.targetType },
      tool: fields.tool,
    },
    gap: values.existingGapId
      ? { gapId: values.existingGapId, kind: "Existing" }
      : {
          kind: "New",
          links: toLinkInputs(values.links),
          scope: values.scope || null,
          title: values.title,
          unmetNeed: values.unmetNeed,
        },
  };
}

/** The close form as the founder fills it; every proof field starts empty. */
export interface CloseFormValues {
  build: string;
  externalCopyHow: string;
  externalCopyState: "" | "Active parallel source" | "Closed";
  impact: ToolEscapeImpact | "";
  restored: LinkDraft[];
  restoreMethod: ToolEscapeRestoreMethod | "";
  runRef: string;
}

export const EMPTY_CLOSE_FORM: CloseFormValues = {
  build: "",
  externalCopyHow: "",
  externalCopyState: "",
  impact: "",
  restoreMethod: "",
  restored: [],
  runRef: "",
};

/**
 * Sends only what the founder filled in; an empty proof field stays absent so
 * the seam names the unmet condition. The impact is required to pick a path.
 */
export function toCloseToolEscapeInput(
  escapeId: string,
  values: CloseFormValues,
  impact: ToolEscapeImpact,
): CloseToolEscapeInput {
  return {
    candidate: values.build.trim() ? { build: values.build } : null,
    escapeId,
    externalCopy:
      values.externalCopyState && values.externalCopyHow.trim()
        ? { how: values.externalCopyHow, state: values.externalCopyState }
        : null,
    impact,
    restore:
      values.restoreMethod && values.restored.length > 0
        ? {
            method: values.restoreMethod,
            records: toLinkInputs(values.restored),
          }
        : null,
    workflow: values.runRef.trim() ? { runRef: values.runRef } : null,
  };
}
