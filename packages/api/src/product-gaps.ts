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
 *
 * Tool Escapes (Dış Araca Kaçış, #418) are dated, append-only events a Gap
 * owns. The repeat count of a Gap is only the number of recorded events, never
 * stored, and there is no severity, `High-impact`, priority or score field.
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
  /** Derived: the number of recorded Tool Escapes that match the filter. */
  escapeCount: number;
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
  /** Distinct external tools of all recorded escapes, for the tool filter. */
  tools: string[];
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
    escapeCount: z.number().int().min(0),
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
  .object({
    gaps: z.array(productGapRecordSchema),
    tools: z.array(z.string()),
  })
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
  /**
   * Binds the source context of a Tool Escape: a visible record of this
   * Workspace and the Project it belongs to.
   */
  bindSource: (
    link: ProductGapLinkInput,
  ) => Promise<{ label: string; projectId: string } | null>;
  candidates: (
    targetType: ProductGapLinkTargetType,
  ) => Promise<ProductGapLinkTarget[]>;
  read: (link: ProductGapLinkInput) => Promise<ProductGapTargetLive>;
}

/** One Workspace-scoped unit of work. */
export interface ProductGapTransaction {
  /** The escape of this Workspace; held until the unit ends when `lock`. */
  findEscape: (
    escapeId: string,
    lock: boolean,
  ) => Promise<ToolEscapeStored | null>;
  /** When `lock` is true the Gap row is held until the unit of work ends. */
  findGap: (
    gapId: string,
    lock: boolean,
  ) => Promise<ProductGapStoredRecord | null>;
  insertEscape: (event: ToolEscapeStored) => Promise<void>;
  /** Appends the close of an escape; never rewrites the escape itself. */
  insertEscapeClose: (close: ToolEscapeCloseStored) => Promise<void>;
  insertGap: (record: ProductGapStoredRecord) => Promise<void>;
  /** Closes of the named escapes, if any. */
  listEscapeCloses: (escapeIds: string[]) => Promise<ToolEscapeCloseStored[]>;
  /** Events are append-only: there is no update or delete operation. */
  listEscapes: (filter: ToolEscapeFilter) => Promise<ToolEscapeStored[]>;
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

export const TOOL_ESCAPE_LABEL = "Tool Escape";

/** Closed reasons. PRD 04 stores the Turkish values in the same order. */
export const TOOL_ESCAPE_REASONS = [
  "Missing capability",
  "Faster",
  "More reliable",
  "Usability",
  "Habit",
] as const;
export const toolEscapeReasonSchema = z.enum(TOOL_ESCAPE_REASONS);
export type ToolEscapeReason = z.infer<typeof toolEscapeReasonSchema>;

export const TOOL_ESCAPE_REASON_PRD_VALUES: Record<ToolEscapeReason, string> = {
  Faster: "Daha hızlı",
  Habit: "Alışkanlık",
  "Missing capability": "Eksik yetenek",
  "More reliable": "Daha güvenilir",
  Usability: "Kullanılabilirlik",
};

export const TOOL_ESCAPE_TOOL_MAX = 120;

const timestampSchema = z.string().datetime({ offset: true });

const optionalNote = z
  .string()
  .trim()
  .max(
    PRODUCT_GAP_TEXT_MAX,
    `Note must be ${PRODUCT_GAP_TEXT_MAX} characters or fewer.`,
  )
  .nullish()
  .transform((value) => (value ? value : null));

/**
 * The event the founder writes by hand. It has no content, session, severity,
 * `High-impact` or count field: a Tool Escape is a dated record of what was
 * meant to happen elsewhere and why, never a copy of the other tool.
 */
export const toolEscapeInputSchema = z
  .object({
    intendedJob: requiredText("Intended job", PRODUCT_GAP_TEXT_MAX),
    note: optionalNote,
    occurredAt: timestampSchema,
    reasons: z
      .array(toolEscapeReasonSchema)
      .min(1, "Choose at least one reason.")
      .max(TOOL_ESCAPE_REASONS.length)
      .transform((reasons) => [...new Set(reasons)]),
    /** Source Project or record context, bound live to this Workspace. */
    source: productGapLinkInputSchema,
    tool: requiredText("External tool", TOOL_ESCAPE_TOOL_MAX),
  })
  .strict();
export type ToolEscapeInput = z.input<typeof toolEscapeInputSchema>;
export type ParsedToolEscapeInput = z.output<typeof toolEscapeInputSchema>;

/** A deliberate choice: a new Gap, or one the founder names. Never by title. */
export const toolEscapeGapChoiceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("New"),
      links: z
        .array(productGapLinkInputSchema)
        .max(PRODUCT_GAP_LINK_MAX)
        .default([]),
      scope: optionalScope,
      title: requiredText("Title", 255),
      unmetNeed: requiredText("Unmet need", PRODUCT_GAP_TEXT_MAX),
    })
    .strict(),
  z.object({ gapId: identifierSchema, kind: z.literal("Existing") }).strict(),
]);

export const recordToolEscapeInputSchema = z
  .object({
    escape: toolEscapeInputSchema,
    gap: toolEscapeGapChoiceSchema,
  })
  .strict();
export type RecordToolEscapeInput = z.input<typeof recordToolEscapeInputSchema>;

/** Dogfooding filters. They select; nothing here orders or scores. */
export const toolEscapeFilterSchema = z
  .object({
    projectId: identifierSchema.optional(),
    reason: toolEscapeReasonSchema.optional(),
    tool: z.string().trim().min(1).max(TOOL_ESCAPE_TOOL_MAX).optional(),
  })
  .strict();
export type ToolEscapeFilterInput = z.infer<typeof toolEscapeFilterSchema>;

export const productGapListInputSchema = toolEscapeFilterSchema
  .extend({ status: productGapStatusSchema.optional() })
  .strict();
export type ProductGapListInput = z.input<typeof productGapListInputSchema>;

export const listToolEscapesInputSchema = toolEscapeFilterSchema
  .extend({ gapId: identifierSchema })
  .strict();
export type ListToolEscapesInput = z.input<typeof listToolEscapesInputSchema>;

export interface ToolEscapeFilter extends ToolEscapeFilterInput {
  gapId?: string;
}

export interface ToolEscapeStored {
  gapId: string;
  id: string;
  intendedJob: string;
  note: string | null;
  occurredAt: string;
  reasons: ToolEscapeReason[];
  recordedAt: string;
  source: {
    projectId: string;
    targetId: string;
    targetType: ProductGapLinkTargetType;
  };
  tool: string;
}

export interface ToolEscapeRecord extends Omit<ToolEscapeStored, "source"> {
  /** Visible close evidence; `null` while the escape has no close. */
  close: ToolEscapeCloseRecord | null;
  source: {
    brokenReason: BrokenReferenceReason | null;
    label: string | null;
    projectId: string;
    state: "broken" | "resolved";
    targetId: string;
    targetType: ProductGapLinkTargetType;
  };
}

export const TOOL_ESCAPE_CLOSE_LABEL = "Close Tool Escape";

/**
 * The close-time judgement of an escape, per the PRD `What the escape held`
 * label: the canonical truth moved out, a lasting parallel source of truth,
 * or never held parallel truth. It is a claim made at close, never a stored
 * severity of the event. A `Never held parallel truth` close carries its
 * judgement alone; the four conditions belong to the two high-impact closes.
 */
export const TOOL_ESCAPE_IMPACTS = [
  "Canonical truth moved out",
  "Lasting parallel source of truth",
  "Never held parallel truth",
] as const;
export const toolEscapeImpactSchema = z.enum(TOOL_ESCAPE_IMPACTS);
export type ToolEscapeImpact = z.infer<typeof toolEscapeImpactSchema>;
export type ToolEscapeHighImpact = Exclude<
  ToolEscapeImpact,
  "Never held parallel truth"
>;

export const TOOL_ESCAPE_RESTORE_METHODS = [
  "Manual recreate",
  "Supported import",
] as const;

export const toolEscapeRestoreMethodSchema = z.enum(
  TOOL_ESCAPE_RESTORE_METHODS,
);
export type ToolEscapeRestoreMethod = z.infer<
  typeof toolEscapeRestoreMethodSchema
>;

/** The four conditions of a high-impact close; all are required together. */
export const TOOL_ESCAPE_CLOSE_CONDITIONS = [
  "Workflow succeeded on candidate",
  "Truth restored in product records",
  "External copy closed",
  "Evidence bound to records",
] as const;
export type ToolEscapeCloseCondition =
  (typeof TOOL_ESCAPE_CLOSE_CONDITIONS)[number];

export const EXTERNAL_COPY_STATES = [
  "Closed",
  "Active parallel source",
] as const;

/**
 * Every proof field is optional on purpose: a missing one is not a malformed
 * request but a missing condition, and the close is refused fail-closed with
 * the conditions that are not met. There is no note, screenshot, count,
 * duration or severity field that could stand in for a condition. A
 * `Never held parallel truth` close carries its judgement alone: no proof
 * field travels with it.
 */
export const closeToolEscapeInputSchema = z
  .object({
    /** The exact build of the current Ürün sürüm adayı the workflow ran on. */
    candidate: z
      .object({ build: requiredText("Build", 255) })
      .strict()
      .nullish(),
    escapeId: identifierSchema,
    externalCopy: z
      .object({
        how: requiredText(
          "How the external copy was closed",
          PRODUCT_GAP_TEXT_MAX,
        ),
        state: z.enum(EXTERNAL_COPY_STATES),
      })
      .strict()
      .nullish(),
    impact: toolEscapeImpactSchema,
    restore: z
      .object({
        method: toolEscapeRestoreMethodSchema,
        records: z
          .array(productGapLinkInputSchema)
          .min(1, "Name the restored product records.")
          .max(PRODUCT_GAP_LINK_MAX),
      })
      .strict()
      .nullish(),
    /** Reference of the run of the same real workflow, verified, not asserted. */
    workflow: z
      .object({ runRef: requiredText("Workflow run", 255) })
      .strict()
      .nullish(),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.impact === "Never held parallel truth" &&
      (input.candidate || input.externalCopy || input.restore || input.workflow)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A close whose escape never held parallel truth carries no proof fields.",
        path: ["impact"],
      });
    }
  });
export type CloseToolEscapeInput = z.input<typeof closeToolEscapeInputSchema>;
export type ParsedCloseToolEscapeInput = z.output<
  typeof closeToolEscapeInputSchema
>;

export interface ToolEscapeCloseStored {
  candidateBuild: string | null;
  closedAt: string;
  escapeId: string;
  externalCopyHow: string | null;
  gapId: string;
  id: string;
  impact: ToolEscapeImpact;
  records: ProductGapLinkInput[];
  restoreMethod: ToolEscapeRestoreMethod | null;
  workflowRef: string | null;
}

export interface ToolEscapeCloseRecord
  extends Omit<ToolEscapeCloseStored, "records"> {
  records: {
    brokenReason: BrokenReferenceReason | null;
    label: string | null;
    state: "broken" | "resolved";
    targetId: string;
    targetType: ProductGapLinkTargetType;
  }[];
}

export const toolEscapeCloseRecordSchema = z
  .object({
    candidateBuild: z.string().min(1).nullable(),
    closedAt: z.string(),
    escapeId: identifierSchema,
    externalCopyHow: z.string().min(1).nullable(),
    gapId: identifierSchema,
    id: identifierSchema,
    impact: toolEscapeImpactSchema,
    records: z.array(
      z
        .object({
          brokenReason: brokenReferenceReasonSchema.nullable(),
          label: z.string().nullable(),
          state: z.enum(["broken", "resolved"]),
          targetId: identifierSchema,
          targetType: productGapLinkTargetTypeSchema,
        })
        .strict(),
    ),
    restoreMethod: toolEscapeRestoreMethodSchema.nullable(),
    workflowRef: z.string().min(1).nullable(),
  })
  .strict();

/**
 * Verifier of the candidate workflow evidence. Fixtures stand in for it in
 * tests; without one every close is refused (fail-closed).
 */
export interface ToolEscapeCloseProof {
  /** The build of the current Ürün sürüm adayı, or `null` when none exists. */
  currentCandidate: () => Promise<string | null>;
  /** A recorded run of a workflow, with the product records it exercised. */
  workflowRun: (runRef: string) => Promise<{
    build: string;
    records: ProductGapLinkInput[];
    succeeded: boolean;
  } | null>;
}

export const toolEscapeRecordSchema = z
  .object({
    close: toolEscapeCloseRecordSchema.nullable(),
    gapId: identifierSchema,
    id: identifierSchema,
    intendedJob: z.string().min(1),
    note: z.string().nullable(),
    occurredAt: z.string(),
    reasons: z.array(toolEscapeReasonSchema).min(1),
    recordedAt: z.string(),
    source: z
      .object({
        brokenReason: brokenReferenceReasonSchema.nullable(),
        label: z.string().nullable(),
        projectId: identifierSchema,
        state: z.enum(["broken", "resolved"]),
        targetId: identifierSchema,
        targetType: productGapLinkTargetTypeSchema,
      })
      .strict(),
    tool: z.string().min(1),
  })
  .strict();

export const toolEscapeListSchema = z.array(toolEscapeRecordSchema);

export interface RecordToolEscapeResult {
  escape: ToolEscapeRecord;
  gap: ProductGapRecord;
}

export const recordToolEscapeResultSchema = z
  .object({ escape: toolEscapeRecordSchema, gap: productGapRecordSchema })
  .strict();

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
  /**
   * Closes a Tool Escape as its one close. A `Never held parallel truth`
   * judgement writes the close with no proof and no bound records; a
   * high-impact judgement is refused unless all four conditions hold.
   * Fail-closed: an unmet condition refuses, nothing is written.
   */
  closeToolEscape: (
    accountId: string,
    input: CloseToolEscapeInput,
  ) => Promise<ToolEscapeRecord>;
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
  /** Dogfooding summary: filters gaps, ranks nothing. */
  list: (
    accountId: string,
    filter?: ProductGapListInput,
  ) => Promise<ProductGapList>;
  /** The exact event set behind a repeat count. */
  listEscapes: (
    accountId: string,
    input: ListToolEscapesInput,
  ) => Promise<ToolEscapeRecord[]>;
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
  /**
   * `Record Product Gap` with a dated Tool Escape: a new Gap or an existing one
   * the founder chose, plus the event, in one unit of work.
   */
  recordToolEscape: (
    accountId: string,
    input: RecordToolEscapeInput,
  ) => Promise<RecordToolEscapeResult>;
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
