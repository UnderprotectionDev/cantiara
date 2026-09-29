import { z } from "zod";

import { workStatusSchema, workTypeSchema } from "./work-lifecycle";

export const createSmartCollectionInputSchema = z
  .object({
    clientIdempotencyKey: z.string().uuid(),
    projectId: z.string().min(1),
    name: z.string().trim().min(1).max(255),
    conditions: z
      .object({
        status: workStatusSchema.optional(),
        type: workTypeSchema.optional(),
      })
      .strict(),
    viewName: z.string().trim().min(1).max(255).default("Default"),
    presentation: z.enum(["List", "Table"]).default("List"),
  })
  .strict();

export type CreateSmartCollectionInput = z.infer<
  typeof createSmartCollectionInputSchema
>;

export class SmartCollectionUnavailableError extends Error {}
export class SmartCollectionConflictError extends Error {}

export interface SmartCollectionViewSource {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  presentation: "List" | "Table";
  projectId: string;
  works: Array<{
    id: string;
    key: string;
    title: string;
    status: string;
    type: string;
  }>;
}

export interface SmartCollectionsAccess {
  create: (
    accountId: string,
    input: CreateSmartCollectionInput,
  ) => Promise<SmartCollectionViewSource>;
  getView: (
    accountId: string,
    viewId: string,
  ) => Promise<SmartCollectionViewSource | null>;
  listViews: (
    accountId: string,
    projectId: string,
  ) => Promise<SmartCollectionViewSource[]>;
}
