import type {
  ProductGapLinkInput,
  ProductGapLinkTargetType,
  ProductGapLinkView,
} from "@cantiara/api/product-gaps";

/** A related record as the form holds it: the label is display only and never sent. */
export interface LinkDraft {
  label: string;
  targetId: string;
  targetType: ProductGapLinkTargetType;
}

export interface GapFormValues {
  links: LinkDraft[];
  scope: string;
  title: string;
  unmetNeed: string;
}

export const EMPTY_GAP_FORM: GapFormValues = {
  links: [],
  scope: "",
  title: "",
  unmetNeed: "",
};

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
