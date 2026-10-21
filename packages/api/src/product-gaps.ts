import { z } from "zod";
import {
  canonicalizeMutationPayload,
  humanMutationEnvelopeSchema,
} from "./mutation-and-undo";
import {
  type BrokenReferenceReason,
  brokenReferenceReasonSchema,
} from "./relations";
import { workDescriptionSchema, workTitleSchema } from "./work-lifecycle";

/**
 * Product Gaps seam (spec 58, #417).
 *
 * A Product Gap (Ürün Boşluğu) is a Workspace master record the founder writes
 * by hand: a title, the unmet need, an optional scope and related Project,
 * Work, Feature and Decision records. This contract names no repeat count,
 * priority, score, telemetry, similarity or auto-convert concept, and every
 * input is `.strict()` so none of those can be smuggled in. The status is the
 * founder's; changing it writes nothing but the Gap.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const PRODUCT_GAP_LABEL = "Product Gap";
export const RECORD_PRODUCT_GAP_LABEL = "Record Product Gap";

export const PRODUCT_GAP_TEXT_MAX = 10_000;
export const PRODUCT_GAP_LINK_MAX = 50;

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

/**
 * Closed status catalog. English UI values; PRD 02 stores the Turkish values
 * `Açık`, `Değerlendiriliyor`, `Karşılandı` and `Bilinçli sınır` in the same
 * order. A repeat count never selects one of them.
 */
export const PRODUCT_GAP_STATUSES = [
  "Open",
  "Evaluating",
  "Met",
  "Conscious boundary",
] as const;
export const productGapStatusSchema = z.enum(PRODUCT_GAP_STATUSES);
export type ProductGapStatus = z.infer<typeof productGapStatusSchema>;

export const PRODUCT_GAP_STATUS_PRD_VALUES: Record<ProductGapStatus, string> = {
  "Conscious boundary": "Bilinçli sınır",
  Evaluating: "Değerlendiriliyor",
  Met: "Karşılandı",
  Open: "Açık",
};

/** Related record families; each is read live from its owner. */
export const PRODUCT_GAP_LINK_TARGET_TYPES = [
  "Project",
  "Work",
  "Feature",
  "Decision",
] as const;
export const productGapLinkTargetTypeSchema = z.enum(
  PRODUCT_GAP_LINK_TARGET_TYPES,
);
export type ProductGapLinkTargetType = z.infer<
  typeof productGapLinkTargetTypeSchema
>;

/** `Related` is the founder's own link; `Follow-up` came from a confirmed preview. */
export const PRODUCT_GAP_LINK_KINDS = ["Related", "Follow-up"] as const;
export type ProductGapLinkKind = (typeof PRODUCT_GAP_LINK_KINDS)[number];

export const productGapLinkInputSchema = z
  .object({
    targetId: identifierSchema,
    targetType: productGapLinkTargetTypeSchema,
  })
  .strict();
export type ProductGapLinkInput = z.output<typeof productGapLinkInputSchema>;

const optionalScope = z
  .string()
  .trim()
  .max(
    PRODUCT_GAP_TEXT_MAX,
    `Scope must be ${PRODUCT_GAP_TEXT_MAX} characters or fewer.`,
  )
  .nullish()
  .transform((value) => (value ? value : null));

/** `Record Product Gap`: the only way a Gap comes to exist. */
export const recordProductGapInputSchema = z
  .object({
    links: z
      .array(productGapLinkInputSchema)
      .max(
        PRODUCT_GAP_LINK_MAX,
        `A ${PRODUCT_GAP_LABEL} has at most ${PRODUCT_GAP_LINK_MAX} related records.`,
      )
      .default([]),
    scope: optionalScope,
    title: requiredText("Title", 255),
    unmetNeed: requiredText("Unmet need", PRODUCT_GAP_TEXT_MAX),
  })
  .strict();
export type RecordProductGapInput = z.input<typeof recordProductGapInputSchema>;
export type ParsedRecordProductGapInput = z.output<
  typeof recordProductGapInputSchema
>;

/**
 * The status command carries a status and the status the founder saw, nothing
 * else: it cannot name an escape event, a linked record or a count.
 */
export const setProductGapStatusInputSchema = z
  .object({
    expectedStatus: productGapStatusSchema,
    gapId: identifierSchema,
    status: productGapStatusSchema,
  })
  .strict();
export type SetProductGapStatusInput = z.input<
  typeof setProductGapStatusInputSchema
>;

export const productGapLinkTargetsInputSchema = z
  .object({ targetType: productGapLinkTargetTypeSchema })
  .strict();
export type ProductGapLinkTargetsInput = z.input<
  typeof productGapLinkTargetsInputSchema
>;

export interface ProductGapLinkTarget {
  label: string;
  targetId: string;
  targetType: ProductGapLinkTargetType;
}

export interface ProductGapStoredLink {
  createdAt: string;
  id: string;
  kind: ProductGapLinkKind;
  targetId: string;
  targetType: ProductGapLinkTargetType;
}

export interface ProductGapStoredRecord {
  createdAt: string;
  id: string;
  links: ProductGapStoredLink[];
  scope: string | null;
  status: ProductGapStatus;
  statusChangedAt: string;
  title: string;
  unmetNeed: string;
  updatedAt: string;
}

export interface ProductGapLinkView {
  brokenReason: BrokenReferenceReason | null;
  id: string;
  kind: ProductGapLinkKind;
  label: string | null;
  state: "broken" | "resolved";
  targetId: string;
  targetType: ProductGapLinkTargetType;
}

export interface ProductGapRecord {
  createdAt: string;
  id: string;
  links: ProductGapLinkView[];
  scope: string | null;
  status: ProductGapStatus;
  statusChangedAt: string;
  title: string;
  unmetNeed: string;
  updatedAt: string;
}

export interface ProductGapList {
  gaps: ProductGapRecord[];
}

export type ProductGapTargetLive =
  | { label: string; state: "resolved" }
  | { reason: BrokenReferenceReason; state: "broken" };

export const productGapLinkViewSchema = z
  .object({
    brokenReason: brokenReferenceReasonSchema.nullable(),
    id: identifierSchema,
    kind: z.enum(PRODUCT_GAP_LINK_KINDS),
    label: z.string().nullable(),
    state: z.enum(["broken", "resolved"]),
    targetId: identifierSchema,
    targetType: productGapLinkTargetTypeSchema,
  })
  .strict();

export const productGapRecordSchema = z
  .object({
    createdAt: z.string(),
    id: identifierSchema,
    links: z.array(productGapLinkViewSchema),
    scope: z.string().nullable(),
    status: productGapStatusSchema,
    statusChangedAt: z.string(),
    title: z.string().min(1),
    unmetNeed: z.string().min(1),
    updatedAt: z.string(),
  })
  .strict();

export const productGapListSchema = z
  .object({ gaps: z.array(productGapRecordSchema) })
  .strict();

export const productGapLinkTargetSchema = z
  .object({
    label: z.string(),
    targetId: identifierSchema,
    targetType: productGapLinkTargetTypeSchema,
  })
  .strict();

/**
 * Owner-record resolver of the Workspace. A link binds only a record of this
 * Workspace that is still visible; a title or a placeholder id never stands in.
 */
export interface ProductGapTargetResolver {
  bind: (link: ProductGapLinkInput) => Promise<{ label: string } | null>;
  candidates: (
    targetType: ProductGapLinkTargetType,
  ) => Promise<ProductGapLinkTarget[]>;
  read: (link: ProductGapLinkInput) => Promise<ProductGapTargetLive>;
}

/** One Workspace-scoped unit of work. */
export interface ProductGapTransaction {
  /** When `lock` is true the Gap row is held until the unit of work ends. */
  findGap: (
    gapId: string,
    lock: boolean,
  ) => Promise<ProductGapStoredRecord | null>;
  insertGap: (record: ProductGapStoredRecord) => Promise<void>;
  listGaps: () => Promise<ProductGapStoredRecord[]>;
  resolver: ProductGapTargetResolver;
  /**
   * Moves the Gap only while it is still in `expected`. Resolves `false`
   * otherwise, so a concurrent change is refused rather than overwritten. It
   * writes the Gap row alone.
   */
  setStatus: (
    gapId: string,
    expected: ProductGapStatus,
    to: ProductGapStatus,
    changedAt: string,
  ) => Promise<boolean>;
}

/** Work types a Gap can start; `Feature` is a relation, never a conversion. */
export const PRODUCT_GAP_FOLLOW_UP_WORK_TYPES = [
  "Task",
  "Improvement",
  "Research",
] as const;
export const productGapFollowUpWorkTypeSchema = z.enum(
  PRODUCT_GAP_FOLLOW_UP_WORK_TYPES,
);
export type ProductGapFollowUpWorkType = z.infer<
  typeof productGapFollowUpWorkTypeSchema
>;

export const PRODUCT_GAP_FOLLOW_UP_KINDS = [
  "Work",
  "Feature relation",
] as const;

export const previewProductGapFollowUpInputSchema = z.discriminatedUnion(
  "kind",
  [
    z
      .object({
        gapId: identifierSchema,
        kind: z.literal("Work"),
        projectId: identifierSchema,
        workType: productGapFollowUpWorkTypeSchema.default("Task"),
      })
      .strict(),
    z
      .object({
        featureId: identifierSchema,
        gapId: identifierSchema,
        kind: z.literal("Feature relation"),
      })
      .strict(),
  ],
);
export type PreviewProductGapFollowUpInput = z.input<
  typeof previewProductGapFollowUpInputSchema
>;
export type ParsedPreviewProductGapFollowUpInput = z.output<
  typeof previewProductGapFollowUpInputSchema
>;

const followUpWorkPlanSchema = z
  .object({
    gapId: identifierSchema,
    kind: z.literal("Work"),
    recordCount: z.literal(1),
    relation: z.literal("Follow-up"),
    targetProject: z
      .object({ id: identifierSchema, name: z.string().min(1) })
      .strict(),
    work: z
      .object({
        description: workDescriptionSchema,
        title: workTitleSchema,
        type: productGapFollowUpWorkTypeSchema,
      })
      .strict(),
  })
  .strict();

const followUpFeatureRelationPlanSchema = z
  .object({
    feature: z
      .object({ id: identifierSchema, label: z.string().min(1) })
      .strict(),
    gapId: identifierSchema,
    kind: z.literal("Feature relation"),
    recordCount: z.literal(0),
    relation: z.literal("Follow-up"),
  })
  .strict();

/**
 * Read-only preview of the one write a follow-up makes: a new Work in the
 * chosen Project, or a relation to an existing Feature. Nothing exists until
 * the founder confirms the exact plan.
 */
export const productGapFollowUpPlanSchema = z.discriminatedUnion("kind", [
  followUpWorkPlanSchema,
  followUpFeatureRelationPlanSchema,
]);
export type ProductGapFollowUpPlan = z.infer<
  typeof productGapFollowUpPlanSchema
>;

export const confirmProductGapFollowUpInputSchema = humanMutationEnvelopeSchema
  .extend({
    gapId: identifierSchema,
    /** Identity of the follow-up link; the Mutation Contract target. */
    id: identifierSchema,
    plan: productGapFollowUpPlanSchema,
    /** Identity of the single new Work; present exactly for a `Work` plan. */
    workId: identifierSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const needsWork = input.plan.kind === "Work";
    if (needsWork !== (input.workId !== undefined)) {
      context.addIssue({
        code: "custom",
        message: needsWork
          ? "A Work plan names the id of its new Work."
          : "A Feature relation creates no Work.",
        path: ["workId"],
      });
    }
  });
export type ConfirmProductGapFollowUpInput = z.input<
  typeof confirmProductGapFollowUpInputSchema
>;
export type ParsedConfirmProductGapFollowUpInput = z.output<
  typeof confirmProductGapFollowUpInputSchema
>;

export interface ProductGapFollowUpReceipt {
  linkId: string;
  workId: string | null;
  workKey: string | null;
}

export const productGapFollowUpResultSchema = z
  .object({
    followUp: z
      .object({
        linkId: identifierSchema,
        workId: identifierSchema.nullable(),
        workKey: z.string().nullable(),
      })
      .strict(),
    gap: productGapRecordSchema,
  })
  .strict();
export type ProductGapFollowUpResult = z.infer<
  typeof productGapFollowUpResultSchema
>;

/** What the preview needs from storage; the mapping itself is a product rule below. */
export interface ProductGapFollowUpSource {
  gap: ProductGapStoredRecord;
  /** `null` when the chosen Project or Feature is not available. */
  target: ProductGapFollowUpTarget | null;
}

export type ProductGapFollowUpTarget =
  | { kind: "Feature relation"; feature: { id: string; label: string } }
  | {
      kind: "Work";
      project: { id: string; name: string; readOnly: boolean };
    };

/**
 * The one mapping rule: the Gap title and its unmet need (and scope) start the
 * Work. No AI, no summary, no extra records. Work field rules are the Work
 * Lifecycle schemas.
 */
export function buildProductGapFollowUpPlan(
  source: {
    gap: ProductGapStoredRecord;
    target: ProductGapFollowUpTarget;
  },
  workType: ProductGapFollowUpWorkType = "Task",
): ProductGapFollowUpPlan {
  const { gap, target } = source;
  if (target.kind === "Feature relation") {
    return productGapFollowUpPlanSchema.parse({
      feature: target.feature,
      gapId: gap.id,
      kind: "Feature relation",
      recordCount: 0,
      relation: "Follow-up",
    });
  }
  return productGapFollowUpPlanSchema.parse({
    gapId: gap.id,
    kind: "Work",
    recordCount: 1,
    relation: "Follow-up",
    targetProject: { id: target.project.id, name: target.project.name },
    work: {
      description: gap.scope
        ? `${gap.unmetNeed}\n\nScope: ${gap.scope}`
        : gap.unmetNeed,
      title: gap.title,
      type: workType,
    },
  });
}

/** A confirmed plan must equal the plan re-derived from the current record. */
export function isSameProductGapFollowUpPlan(
  left: ProductGapFollowUpPlan,
  right: ProductGapFollowUpPlan,
) {
  return (
    canonicalizeMutationPayload(left as never) ===
    canonicalizeMutationPayload(right as never)
  );
}

export interface ProductGapStore {
  /** Atomic follow-up write; `null` when the Gap or Workspace is unavailable. */
  confirmFollowUp: (
    accountId: string,
    input: ParsedConfirmProductGapFollowUpInput,
  ) => Promise<ProductGapFollowUpReceipt | null>;
  /** Read-only; `null` when the Gap or its target is unavailable. */
  readFollowUpSource: (
    accountId: string,
    input: ParsedPreviewProductGapFollowUpInput,
  ) => Promise<ProductGapFollowUpSource | null>;
  /** Resolves to `null` when the account has no Workspace. */
  run: <T>(
    accountId: string,
    mode: "read" | "write",
    work: (transaction: ProductGapTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

export interface ProductGapsAccess {
  /** Confirms the exact previewed plan. Never converts by itself. */
  confirmFollowUp: (
    accountId: string,
    input: ConfirmProductGapFollowUpInput,
  ) => Promise<ProductGapFollowUpResult>;
  /** Selectable related records, by family. */
  linkTargets: (
    accountId: string,
    input: ProductGapLinkTargetsInput,
  ) => Promise<ProductGapLinkTarget[]>;
  list: (accountId: string) => Promise<ProductGapList>;
  /** Read-only preview of a follow-up Work or Feature relation. */
  previewFollowUp: (
    accountId: string,
    input: PreviewProductGapFollowUpInput,
  ) => Promise<ProductGapFollowUpPlan>;
  /** `Record Product Gap`: files a Gap by hand. */
  record: (
    accountId: string,
    input: RecordProductGapInput,
  ) => Promise<ProductGapRecord>;
  /** The founder's status change. Writes the Gap row alone. */
  setStatus: (
    accountId: string,
    input: SetProductGapStatusInput,
  ) => Promise<ProductGapRecord>;
}

export function productGapLinkKey(
  link: Pick<ProductGapLinkInput, "targetId" | "targetType">,
) {
  return JSON.stringify([link.targetType, link.targetId]);
}

/** The first repeated link, or `null`. Repeats are refused, not merged. */
export function duplicateProductGapLink(links: readonly ProductGapLinkInput[]) {
  const seen = new Set<string>();
  for (const link of links) {
    const key = productGapLinkKey(link);
    if (seen.has(key)) {
      return link;
    }
    seen.add(key);
  }
  return null;
}
