import { z } from "zod";
import type { ScreenTarget } from "./screens";
import {
  parseWireframeDocument,
  type WireframeBlock,
  WireframeDocumentError,
} from "./wireframe-document";

/**
 * `Convert and Bind` and Wireframe templates (spec 48). A block on an exact
 * Wireframe version previews exactly one Work, Decision, Risk or Open Question;
 * the record carries `Kökeni` to the owning Screen plus an immutable Origin
 * Location (Screen id, block id, exact version). Neither is a usage bond.
 */
const identifierSchema = z.string().trim().min(1).max(255);
const versionSchema = z.number().int().min(1).safe();

/** The closed target set. A Screen is deliberately not a member. */
export const CONVERT_AND_BIND_TARGET_TYPES = [
  "Work",
  "Decision",
  "Risk",
  "Open Question",
] as const;
export const convertAndBindTargetTypeSchema = z.enum(
  CONVERT_AND_BIND_TARGET_TYPES,
);
export type ConvertAndBindTargetType = z.infer<
  typeof convertAndBindTargetTypeSchema
>;

export const convertAndBindWorkTypeSchema = z.enum([
  "Task",
  "Bug",
  "Research",
  "Improvement",
]);

/** PRD 02 term: `Kaynak öğe artık yok`. */
export const SOURCE_ITEM_GONE_LABEL = "Source item is gone";

export const originLocationSchema = z
  .object({
    blockId: identifierSchema,
    ownerScreenId: identifierSchema,
    wireframeVersion: versionSchema,
  })
  .strict();
export type OriginLocation = z.infer<typeof originLocationSchema>;

export const previewConvertAndBindInputSchema = z
  .object({
    blockId: identifierSchema,
    projectId: identifierSchema,
    screenId: identifierSchema,
    targetType: convertAndBindTargetTypeSchema,
    title: z.string().trim().min(1).max(255).optional(),
    wireframeVersion: versionSchema,
    workType: convertAndBindWorkTypeSchema.optional(),
  })
  .strict()
  .refine(
    (value) => (value.targetType === "Work") === (value.workType !== undefined),
    "Choose Work type only for Work.",
  );
export type PreviewConvertAndBindInput = z.input<
  typeof previewConvertAndBindInputSchema
>;

/** What the founder sees before any record exists. */
export const convertAndBindPlanSchema = z
  .object({
    body: z.string().min(1).max(20_000),
    originLocation: originLocationSchema,
    projectId: identifierSchema,
    recordCount: z.literal(1),
    relation: z.literal("Origin"),
    screenId: identifierSchema,
    screenTitle: z.string().min(1),
    targetProject: z
      .object({ id: identifierSchema, name: z.string().min(1) })
      .strict(),
    targetType: convertAndBindTargetTypeSchema,
    title: z.string().trim().min(1).max(255),
    workType: convertAndBindWorkTypeSchema.nullable(),
  })
  .strict();
export type ConvertAndBindPlan = z.infer<typeof convertAndBindPlanSchema>;

/** Which record field receives the body, by target type. */
export const CONVERT_AND_BIND_BODY_FIELDS: Record<
  ConvertAndBindTargetType,
  string
> = {
  Decision: "decision",
  "Open Question": "question",
  Risk: "description",
  Work: "description",
};

export const confirmConvertAndBindInputSchema = z
  .object({
    /** Identity of the origin row; a retry with the same id creates nothing new. */
    originId: identifierSchema,
    plan: convertAndBindPlanSchema,
    projectId: identifierSchema,
    /** Identity of the single new record. */
    recordId: identifierSchema,
    screenId: identifierSchema,
  })
  .strict();
export type ConfirmConvertAndBindInput = z.input<
  typeof confirmConvertAndBindInputSchema
>;
export type ParsedConfirmConvertAndBindInput = z.output<
  typeof confirmConvertAndBindInputSchema
>;

function blockText(block: WireframeBlock): string | null {
  if (block.kind !== "Text") {
    return null;
  }
  const text =
    block.text.mode === "placeholder"
      ? block.text.text
      : block.text.visibleText;
  return text.trim().length > 0 ? text : null;
}

/**
 * Title/body map of one block. Pure and deterministic: the same block always
 * proposes the same text, so a plan can be re-derived and compared on confirm.
 */
export function mapBlockToRecordText(
  block: WireframeBlock,
  screenTitle: string,
  titleOverride?: string,
): { body: string; title: string } {
  const text = blockText(block);
  const label = block.label.trim();
  const title = (titleOverride ?? (label || text || block.kind))
    .trim()
    .slice(0, 255);
  const body = (
    text ?? `${block.kind} "${label || block.kind}" on Screen "${screenTitle}"`
  ).slice(0, 20_000);
  return { body, title: title || block.kind };
}

export interface BuildConvertPlanInput {
  document: unknown;
  input: z.output<typeof previewConvertAndBindInputSchema>;
  project: { id: string; name: string };
  screen: { id: string; title: string };
}

/** Builds the preview plan from the stored exact version; throws if the block is absent. */
export function buildConvertAndBindPlan({
  document,
  input,
  project,
  screen,
}: BuildConvertPlanInput): ConvertAndBindPlan {
  const block = findWireframeBlock(document, input.blockId);
  if (!block) {
    throw new WireframeDocumentError(
      "BLOCK_NOT_FOUND",
      `Block ${input.blockId} is not on Wireframe version ${input.wireframeVersion}.`,
    );
  }
  if (block.kind === "Live Card") {
    throw new WireframeDocumentError(
      "INVALID_COMMAND",
      "A live card already shows a record; it cannot be converted.",
    );
  }
  const { body, title } = mapBlockToRecordText(
    block,
    screen.title,
    input.title,
  );
  return convertAndBindPlanSchema.parse({
    body,
    originLocation: {
      blockId: block.id,
      ownerScreenId: screen.id,
      wireframeVersion: input.wireframeVersion,
    },
    projectId: project.id,
    recordCount: 1,
    relation: "Origin",
    screenId: screen.id,
    screenTitle: screen.title,
    targetProject: { id: project.id, name: project.name },
    targetType: input.targetType,
    title,
    workType: input.targetType === "Work" ? (input.workType ?? null) : null,
  });
}

/** Plans compare field by field; any edit between preview and confirm is stale. */
export function isSameConvertAndBindPlan(
  left: ConvertAndBindPlan,
  right: ConvertAndBindPlan,
): boolean {
  return (
    JSON.stringify(convertAndBindPlanSchema.parse(left)) ===
    JSON.stringify(convertAndBindPlanSchema.parse(right))
  );
}

export function findWireframeBlock(
  document: unknown,
  blockId: string,
): WireframeBlock | null {
  return (
    parseWireframeDocument(document).blocks.find(({ id }) => id === blockId) ??
    null
  );
}

/** A persisted origin row; titles and block state are read live on top of it. */
export interface ScreenBlockOriginRecord {
  actorId: string;
  blockId: string;
  createdAt: string;
  id: string;
  projectId: string;
  screenId: string;
  /** Set when an explicit rebind replaced this origin; the row stays readable. */
  supersededAt: string | null;
  supersedesId: string | null;
  targetRecordId: string;
  targetType: ConvertAndBindTargetType;
  wireframeVersion: number;
}

export interface ScreenBlockOriginRow extends ScreenBlockOriginRecord {
  /** Live title of the created record, or `null` when it no longer exists. */
  targetTitle: string | null;
}

export type OriginLocationState = "gone" | "resolved" | "unavailable";

export interface OriginLocationView extends OriginLocation {
  /** `Source item is gone` when the Screen reads but the block id is absent. */
  label: string | null;
  state: OriginLocationState;
}

export interface ScreenBlockOriginView {
  createdAt: string;
  id: string;
  location: OriginLocationView;
  relation: "Origin";
  screen: ScreenTarget;
  supersededAt: string | null;
  supersedesId: string | null;
  target: {
    projectId: string;
    recordId: string;
    title: string | null;
    type: ConvertAndBindTargetType;
  };
}

/**
 * Reads an Origin Location against the Screen's working Wireframe. The exact
 * version stays the one that was bound (older and newer versions never move
 * it); only the block id decides `gone`. No other block is ever substituted.
 */
export function resolveOriginLocation(
  origin: Pick<
    ScreenBlockOriginRecord,
    "blockId" | "screenId" | "wireframeVersion"
  >,
  headDocument: unknown | null,
): OriginLocationView {
  const location = {
    blockId: origin.blockId,
    ownerScreenId: origin.screenId,
    wireframeVersion: origin.wireframeVersion,
  };
  if (headDocument === null) {
    return { ...location, label: null, state: "unavailable" };
  }
  return findWireframeBlock(headDocument, origin.blockId)
    ? { ...location, label: null, state: "resolved" }
    : { ...location, label: SOURCE_ITEM_GONE_LABEL, state: "gone" };
}

export const screenOriginsInputSchema = z
  .object({ projectId: identifierSchema, screenId: identifierSchema })
  .strict();

/** Rebinding is an explicit preview: current location beside the proposed one. */
export const previewRebindInputSchema = z
  .object({
    blockId: identifierSchema,
    originId: identifierSchema,
    projectId: identifierSchema,
    screenId: identifierSchema,
    wireframeVersion: versionSchema,
  })
  .strict();

export const rebindPlanSchema = z
  .object({
    from: originLocationSchema,
    originId: identifierSchema,
    projectId: identifierSchema,
    screenId: identifierSchema,
    targetRecordId: identifierSchema,
    targetType: convertAndBindTargetTypeSchema,
    to: originLocationSchema,
  })
  .strict();
export type RebindPlan = z.infer<typeof rebindPlanSchema>;

export const confirmRebindInputSchema = z
  .object({
    newOriginId: identifierSchema,
    plan: rebindPlanSchema,
    projectId: identifierSchema,
  })
  .strict();
export type ParsedConfirmRebindInput = z.output<
  typeof confirmRebindInputSchema
>;

/** Read-only live record behind a `Live Card`. */
export interface LiveCardResolution {
  state: "broken" | "resolved";
  title: string | null;
}

// ---------------------------------------------------------------------------
// Wireframe templates

export const templateNameSchema = z.string().trim().min(1).max(120);

export const saveScreenTemplateInputSchema = z
  .object({
    name: templateNameSchema,
    projectId: identifierSchema,
    screenId: identifierSchema,
    wireframeVersion: versionSchema,
  })
  .strict();

export const createScreenFromTemplateInputSchema = z
  .object({
    projectId: identifierSchema,
    templateId: identifierSchema,
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export const screenTemplateListInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

/**
 * A Workspace-scoped stamp. It stores a sanitized document and a name only:
 * no source Project, Screen or version id, so nothing can bind back.
 */
export interface ScreenTemplateRecord {
  createdAt: string;
  document: unknown;
  id: string;
  name: string;
}
