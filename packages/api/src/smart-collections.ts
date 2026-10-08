import { z } from "zod";

import { documentTypeSchema } from "./documents";
import {
  ASSUMPTION_LIFE_OPTIONS,
  DECISION_LIFE_OPTIONS,
  MILESTONE_STATUS_OPTIONS,
  OPEN_QUESTION_LIFE_OPTIONS,
  PRODUCTION_INCIDENT_STATUS_OPTIONS,
  PROJECT_RELEASE_STATUS_OPTIONS,
  RISK_LIFE_OPTIONS,
} from "./project-source-records";
import {
  WORK_STATUS_OPTIONS,
  workStatusSchema,
  workTypeSchema,
} from "./work-lifecycle";

export const SMART_COLLECTION_PROJECT_SOURCE_TYPES = [
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
  "Milestone",
  "Project Release",
  "Production Incident",
] as const;

export const SMART_COLLECTION_SOURCE_TYPES = [
  "Work",
  "Document",
  "Wiki Document",
  ...SMART_COLLECTION_PROJECT_SOURCE_TYPES,
] as const;

export type SmartCollectionProjectSourceType =
  (typeof SMART_COLLECTION_PROJECT_SOURCE_TYPES)[number];
export type SmartCollectionSourceType =
  (typeof SMART_COLLECTION_SOURCE_TYPES)[number];

export const smartCollectionSourceTypeSchema = z.enum(
  SMART_COLLECTION_SOURCE_TYPES,
);

export const SMART_COLLECTION_STATUS_OPTIONS: Partial<
  Record<SmartCollectionSourceType, readonly string[]>
> = {
  Work: WORK_STATUS_OPTIONS,
  Decision: DECISION_LIFE_OPTIONS,
  Risk: RISK_LIFE_OPTIONS,
  Assumption: ASSUMPTION_LIFE_OPTIONS,
  "Open Question": OPEN_QUESTION_LIFE_OPTIONS,
  Milestone: MILESTONE_STATUS_OPTIONS,
  "Project Release": PROJECT_RELEASE_STATUS_OPTIONS,
  "Production Incident": PRODUCTION_INCIDENT_STATUS_OPTIONS,
};

const projectSourceStatusSchema = z.enum([
  ...DECISION_LIFE_OPTIONS,
  ...RISK_LIFE_OPTIONS,
  ...ASSUMPTION_LIFE_OPTIONS,
  ...OPEN_QUESTION_LIFE_OPTIONS,
  ...MILESTONE_STATUS_OPTIONS,
  ...PROJECT_RELEASE_STATUS_OPTIONS,
  ...PRODUCTION_INCIDENT_STATUS_OPTIONS,
]);

const collectionStatusSchema = z.union([
  workStatusSchema,
  projectSourceStatusSchema,
]);

const smartCollectionConditionsSchema = z
  .object({
    status: collectionStatusSchema.optional(),
    type: workTypeSchema.optional(),
    documentType: documentTypeSchema.optional(),
    tag: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

const smartCollectionScopeSchema = z
  .object({
    projectIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(100)
      .refine((projectIds) => new Set(projectIds).size === projectIds.length),
  })
  .strict();

export const createSmartCollectionInputSchema = z
  .object({
    clientIdempotencyKey: z.string().uuid(),
    projectId: z.string().min(1),
    name: z.string().trim().min(1).max(255),
    sourceType: smartCollectionSourceTypeSchema.default("Work"),
    scope: smartCollectionScopeSchema.optional(),
    conditions: smartCollectionConditionsSchema,
    viewName: z.string().trim().min(1).max(255).default("Default"),
    presentation: z.enum(["List", "Table"]).default("List"),
  })
  .strict()
  .superRefine(({ projectId, sourceType, scope, conditions }, context) => {
    const hasWorkTypeCondition = conditions.type !== undefined;
    const hasDocumentConditions =
      conditions.documentType !== undefined || conditions.tag !== undefined;
    if (sourceType === "Work" && hasDocumentConditions) {
      context.addIssue({
        code: "custom",
        path: ["conditions"],
        message: "Work collections accept Work conditions only.",
      });
    }
    if (sourceType !== "Work" && hasWorkTypeCondition) {
      context.addIssue({
        code: "custom",
        path: ["conditions", "type"],
        message: "Only Work collections accept Work type conditions.",
      });
    }
    if (
      sourceType !== "Document" &&
      sourceType !== "Wiki Document" &&
      hasDocumentConditions
    ) {
      context.addIssue({
        code: "custom",
        path: ["conditions"],
        message:
          "Only Document and Wiki Document collections accept structured Document conditions.",
      });
    }
    if (conditions.status !== undefined) {
      const statuses = SMART_COLLECTION_STATUS_OPTIONS[sourceType];
      if (!statuses?.includes(conditions.status)) {
        context.addIssue({
          code: "custom",
          path: ["conditions", "status"],
          message: "Status is not available for this source type.",
        });
      }
    }
    if (sourceType === "Wiki Document" && scope !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["scope"],
        message: "Wiki Documents use the owning Workspace scope.",
      });
    }
    if (
      sourceType !== "Wiki Document" &&
      scope !== undefined &&
      !scope.projectIds.includes(projectId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["scope", "projectIds"],
        message: "Project scope must include the owning Project.",
      });
    }
  });

export type CreateSmartCollectionInput = z.infer<
  typeof createSmartCollectionInputSchema
>;

export const setSmartCollectionSubscriptionInputSchema = z
  .object({
    viewId: z.string().min(1),
    subscribe: z.boolean(),
    notifyOnLeave: z.boolean(),
  })
  .strict()
  .superRefine(({ notifyOnLeave, subscribe }, context) => {
    if (notifyOnLeave && !subscribe) {
      context.addIssue({
        code: "custom",
        path: ["notifyOnLeave"],
        message: "Turn on Subscribe first.",
      });
    }
  });

export type SetSmartCollectionSubscriptionInput = z.infer<
  typeof setSmartCollectionSubscriptionInputSchema
>;

export class SmartCollectionUnavailableError extends Error {}
export class SmartCollectionConflictError extends Error {}

export interface SmartCollectionViewSource {
  collectionId: string;
  collectionName: string;
  conditions: CreateSmartCollectionInput["conditions"];
  documents: Array<{
    id: string;
    title: string;
    type: string;
    projectId: string | null;
    workspaceId: string | null;
    membershipReasons: string[];
  }>;
  id: string;
  isSubscribed: boolean;
  name: string;
  notifyOnLeave: boolean;
  preparedReason?: "Long in the same status";
  presentation: "List" | "Table";
  projectId: string;
  projectSourceRecords: Array<{
    id: string;
    title: string;
    status: string;
    projectId: string;
    sourceType: SmartCollectionProjectSourceType;
    membershipReasons: string[];
  }>;
  scope: { projectIds: string[] };
  sourceType: SmartCollectionSourceType;
  works: Array<{
    createdAt: string;
    effort: string | null;
    id: string;
    key: string;
    title: string;
    status: string;
    statusChangedAt: string;
    type: string;
    projectId: string;
    membershipReasons: string[];
  }>;
  workspaceId: string;
}

export interface SmartCollectionsAccess {
  create: (
    accountId: string,
    input: CreateSmartCollectionInput,
  ) => Promise<SmartCollectionViewSource>;
  getView: (
    accountId: string,
    viewId: string,
    options?: { readOnly?: boolean },
  ) => Promise<SmartCollectionViewSource | null>;
  listViews: (
    accountId: string,
    projectId: string,
  ) => Promise<SmartCollectionViewSource[]>;
  setSubscription: (
    accountId: string,
    input: SetSmartCollectionSubscriptionInput,
  ) => Promise<SmartCollectionViewSource>;
}
