import {
  authorityConversionInputSchema,
  externalSourceUrlSchema,
} from "@cantiara/api/technical-diagram-authority";
import { previewConvertToRecordInputSchema } from "@cantiara/api/technical-diagram-card";
import { createDiagramVersionInputSchema } from "@cantiara/api/technical-diagram-version";
import { createDiagramViewInputSchema } from "@cantiara/api/technical-diagrams";
import { z } from "zod";

const required = z.string().trim().min(1);
const chosen = z.string().min(1);

export const addNodeSchema = z.object({ kind: z.string(), label: required });
export const addLinkSchema = z.object({
  from: chosen,
  kind: z.string(),
  to: chosen,
});
export const diagramViewSchema = z.object({
  name: createDiagramViewInputSchema.shape.name,
  selectedNodeIds: createDiagramViewInputSchema.shape.selectedNodeIds,
});
export const addTableSchema = z.object({ name: required });
export const addColumnSchema = z.object({
  default: z.string(),
  name: required,
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  tableId: chosen,
  type: z.string(),
  unique: z.boolean(),
});
export const addIndexSchema = z.object({
  columnId: chosen,
  name: required,
  unique: z.boolean(),
});
export const addRelationSchema = z.object({
  cardinality: z.string(),
  fromColumnId: chosen,
  fromTableId: chosen,
  onDelete: z.string(),
  onUpdate: z.string(),
  toColumnId: chosen,
  toTableId: chosen,
});
export const addParticipantSchema = z.object({
  bind: z.string(),
  kind: z.string(),
  label: required,
});
export const stepSchema = z.object({
  condition: z.string(),
  from: chosen,
  groupKind: z.string(),
  label: required,
  messageKind: z.string(),
  to: chosen,
});
export const groupSchema = stepSchema.extend({ condition: required });
export const versionNameSchema = z.object({
  name: createDiagramVersionInputSchema.shape.name,
});
export const placeRecordSchema = z.object({ choice: chosen });
export const convertNodeSchema = z.object({
  nodeId: previewConvertToRecordInputSchema.shape.nodeId,
  versionId: previewConvertToRecordInputSchema.shape.versionId,
});

/** `Convert authority` form: a target mode, a title and, for an External Source Link, an HTTPS URL and tool. */
export const conversionSchema = z
  .object({
    revision: z.string(),
    targetMode: z.string().min(1),
    title: authorityConversionInputSchema.shape.title,
    tool: z.string(),
    url: z.string(),
  })
  .refine(
    (value) =>
      value.targetMode !== "External Source Link" ||
      (externalSourceUrlSchema.safeParse(value.url).success &&
        value.tool.trim().length > 0),
  );
