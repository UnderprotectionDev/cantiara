import { z } from "zod";

import type { BrokenReferenceView } from "./relations";
import { diagramGraph } from "./technical-diagram-structure";
import {
  type DiagramVersionReference,
  diagramVersionReference,
  type TechnicalDiagramVersion,
} from "./technical-diagram-version";
import type { TechnicalDiagramSource } from "./technical-diagrams";
import {
  type RecordLookupKind,
  USER_FLOW_CONVERT_TARGETS,
  USER_FLOW_WORK_TYPES,
} from "./user-flow";

/**
 * Live cards and composition (spec 59 #423). A card is a use-bind to a
 * Technical Diagram or one of its Diagram Views: it holds a source identity,
 * never elements, and every read re-projects the source. `Live` follows the
 * diagram; `Exact` is a card the founder explicitly pinned to one immutable
 * Diagram Version. The two labels are never interchangeable.
 */
export const DIAGRAM_CARD_LABELS = {
  convert: "Convert to record and link",
  exact: "Exact",
  live: "Live",
  openSource: "Open source record",
  pin: "Pin exact Diagram Version",
  unpin: "Follow live diagram",
} as const;

export type DiagramCardPin = "Exact" | "Live";

export interface DiagramCardProjection {
  diagramType: string;
  links: Array<{ from: string; id: string; label: string | null; to: string }>;
  nodes: Array<{ id: string; kind: string; label: string }>;
  pin: DiagramCardPin;
  versionId: string | null;
  versionName: string | null;
  versionNumber: number | null;
  viewName: string | null;
}

/** Relative app path of the source a card returns to. */
export function diagramSourcePath(projectId: string, diagramId: string) {
  return `/projects/${encodeURIComponent(projectId)}#technical-diagram-${encodeURIComponent(diagramId)}`;
}

/**
 * The same diagram read at one exact checkpoint. The model is the
 * checkpoint's, so later live edits never reach the card; a view selection
 * keeps only the elements the checkpoint still has. Null when the checkpoint
 * belongs to another diagram.
 */
export function pinDiagramToVersion(
  diagram: TechnicalDiagramSource,
  version: TechnicalDiagramVersion,
): TechnicalDiagramSource | null {
  if (version.diagramId !== diagram.id) {
    return null;
  }
  const known = new Set(diagramGraph(version.model).nodes.map(({ id }) => id));
  return {
    ...diagram,
    exactVersion: diagramVersionReference(version),
    model: version.model,
    revision: version.revision,
    view: diagram.view
      ? {
          ...diagram.view,
          selectedNodeIds: diagram.view.selectedNodeIds.filter((id) =>
            known.has(id),
          ),
        }
      : null,
  };
}

/** Read-only projection a Document or Project Wall card draws. */
export function diagramCardProjection(
  source: TechnicalDiagramSource,
  nodeLimit = Number.POSITIVE_INFINITY,
): DiagramCardProjection {
  const graph = diagramGraph(source.model);
  const selected = source.view?.selectedNodeIds ?? null;
  const nodes = (
    selected
      ? graph.nodes.filter(({ id }) => selected.includes(id))
      : graph.nodes
  ).slice(0, nodeLimit);
  const shown = new Set(nodes.map(({ id }) => id));
  return {
    diagramType: source.type,
    links: graph.links.filter(
      ({ from, to }) => shown.has(from) && shown.has(to),
    ),
    nodes,
    pin: source.exactVersion ? "Exact" : "Live",
    versionId: source.exactVersion?.versionId ?? null,
    versionName: source.exactVersion?.name ?? null,
    versionNumber: source.exactVersion?.number ?? null,
    viewName: source.view?.name ?? null,
  };
}

// --- Existing records as read-only live cards on the canvas -----------------

export const DIAGRAM_RECORD_CARD_TYPES = USER_FLOW_CONVERT_TARGETS;
export const diagramRecordCardTypeSchema = z.enum(DIAGRAM_RECORD_CARD_TYPES);

const identifierSchema = z.string().trim().min(1).max(255);
const coordinateSchema = z.number().finite().min(-100_000).max(100_000);

/** A record card stores the source identity and canvas position only. */
export const placeDiagramRecordCardInputSchema = z
  .object({
    clientIdempotencyKey: z.string().uuid(),
    diagramId: identifierSchema,
    sourceId: identifierSchema,
    sourceType: diagramRecordCardTypeSchema,
    x: coordinateSchema.default(0),
    y: coordinateSchema.default(0),
  })
  .strict();

export const moveDiagramRecordCardInputSchema = z
  .object({
    cardId: identifierSchema,
    diagramId: identifierSchema,
    x: coordinateSchema,
    y: coordinateSchema,
  })
  .strict();

export const removeDiagramRecordCardInputSchema = z
  .object({ cardId: identifierSchema, diagramId: identifierSchema })
  .strict();

export type PlaceDiagramRecordCardInput = z.input<
  typeof placeDiagramRecordCardInputSchema
>;
export type MoveDiagramRecordCardInput = z.infer<
  typeof moveDiagramRecordCardInputSchema
>;
export type RemoveDiagramRecordCardInput = z.infer<
  typeof removeDiagramRecordCardInputSchema
>;

/** Stored card: identity and position, no title, status or body. */
export interface DiagramRecordCardRecord {
  diagramId: string;
  id: string;
  sourceId: string;
  sourceType: RecordLookupKind;
  x: number;
  y: number;
}

/** Live read of a record card; a missing source never keeps old content. */
export interface DiagramRecordCardView extends DiagramRecordCardRecord {
  broken: {
    canOpenSourceRecord: boolean;
    reason: BrokenReferenceView["reason"];
  } | null;
  openPath: string | null;
  status: string | null;
  title: string | null;
}

// --- Convert to record and link ---------------------------------------------

export const diagramConvertTargetSchema = z.enum(USER_FLOW_CONVERT_TARGETS);
const diagramConvertWorkTypeSchema = z.enum(USER_FLOW_WORK_TYPES);

export const previewConvertToRecordInputSchema = z
  .object({
    diagramId: identifierSchema,
    nodeId: identifierSchema,
    target: diagramConvertTargetSchema,
    versionId: identifierSchema,
    workType: diagramConvertWorkTypeSchema.default("Task"),
  })
  .strict();

export type PreviewConvertToRecordInput = z.input<
  typeof previewConvertToRecordInputSchema
>;

/**
 * What the founder confirms: target type, the fields the record is born with,
 * the exact Diagram Version it points at and its origin. Nothing outside the
 * plan is written, and the diagram and its authority mode are never touched.
 */
export const convertToRecordPlanSchema = z
  .object({
    authorityEffect: z.literal("None"),
    diagram: z
      .object({
        authorityMode: z.string(),
        id: identifierSchema,
        title: z.string(),
        type: z.string(),
      })
      .strict(),
    node: z
      .object({ id: identifierSchema, kind: z.string(), label: z.string() })
      .strict(),
    originLocation: z
      .object({
        diagramId: identifierSchema,
        nodeId: identifierSchema,
        versionId: identifierSchema,
        versionNumber: z.number().int().min(1),
      })
      .strict(),
    record: z
      .object({
        body: z.string().min(1),
        title: z.string().trim().min(1).max(255),
        type: diagramConvertTargetSchema,
        workType: diagramConvertWorkTypeSchema.nullable(),
      })
      .strict(),
    recordCount: z.literal(1),
    targetProject: z
      .object({ id: identifierSchema, name: z.string() })
      .strict(),
    version: z
      .object({
        diagramId: identifierSchema,
        kind: z.literal("Diagram Version"),
        name: z.string(),
        number: z.number().int().min(1),
        versionId: identifierSchema,
      })
      .strict(),
  })
  .strict();

export type ConvertToRecordPlan = z.infer<typeof convertToRecordPlanSchema>;

export const confirmConvertToRecordInputSchema = z
  .object({
    clientIdempotencyKey: z.string().uuid(),
    plan: convertToRecordPlanSchema,
  })
  .strict();

export type ConfirmConvertToRecordInput = z.infer<
  typeof confirmConvertToRecordInputSchema
>;

export class DiagramConversionError extends Error {}

/** Durable link from a converted record to the exact version and node. */
export interface DiagramRecordLinkResult {
  nodeId: string;
  recordId: string;
  recordType: ConvertToRecordPlan["record"]["type"];
  version: DiagramVersionReference;
}

/**
 * The one mapping rule: the node label titles the record and the body names
 * the diagram, the exact Diagram Version and the node kind. The node must
 * exist in that immutable checkpoint, never only in the live model. Null when
 * it does not.
 */
export function buildConvertToRecordPlan(
  source: {
    diagram: Pick<
      TechnicalDiagramSource,
      "authorityMode" | "id" | "projectId" | "title" | "type"
    >;
    projectName: string;
    version: TechnicalDiagramVersion;
  },
  input: {
    nodeId: string;
    target: z.infer<typeof diagramConvertTargetSchema>;
    workType: z.infer<typeof diagramConvertWorkTypeSchema>;
  },
): ConvertToRecordPlan | null {
  const { diagram, version } = source;
  if (version.diagramId !== diagram.id) {
    return null;
  }
  const node = diagramGraph(version.model).nodes.find(
    ({ id }) => id === input.nodeId,
  );
  if (!node) {
    return null;
  }
  const title =
    node.label.trim().slice(0, 255) || `${node.kind} of ${diagram.title}`;
  return convertToRecordPlanSchema.parse({
    authorityEffect: "None",
    diagram: {
      authorityMode: diagram.authorityMode,
      id: diagram.id,
      title: diagram.title,
      type: diagram.type,
    },
    node: { id: node.id, kind: node.kind, label: node.label },
    originLocation: {
      diagramId: diagram.id,
      nodeId: node.id,
      versionId: version.id,
      versionNumber: version.number,
    },
    record: {
      body: `${title} (${node.kind}) from ${diagram.title}, Diagram Version ${version.number} ${version.name}.`,
      title,
      type: input.target,
      workType: input.target === "Work" ? input.workType : null,
    },
    recordCount: 1,
    targetProject: { id: diagram.projectId, name: source.projectName },
    version: diagramVersionReference(version),
  });
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

/** A confirmed plan must equal the plan re-derived from the checkpoint. */
export function isSameConvertToRecordPlan(left: unknown, right: unknown) {
  return JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
}
