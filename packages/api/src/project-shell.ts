import { z } from "zod";

import type { MutationContract } from "./mutation-and-undo";

export const STARTER_CONFIGURATION_OPTIONS = [
  "Blank Project",
  "Solo SaaS",
  "Open Source Library",
  "Mobile Application",
] as const;

export type StarterConfiguration =
  (typeof STARTER_CONFIGURATION_OPTIONS)[number];

export const starterConfigurationSchema = z.enum(STARTER_CONFIGURATION_OPTIONS);

export const PROJECT_LIFECYCLE_STATUS_OPTIONS = [
  "Active",
  "Pending",
  "Completed",
  "Abandoned",
] as const;

export type ProjectLifecycleStatus =
  (typeof PROJECT_LIFECYCLE_STATUS_OPTIONS)[number];

export const projectLifecycleStatusSchema = z.enum(
  PROJECT_LIFECYCLE_STATUS_OPTIONS,
);

const FIRST_LETTER_WORD_PATTERN = /[A-Z][A-Z0-9]*/;

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Project Name is required.")
  .max(200, "Project Name must be 200 characters or fewer.");

export function normalizeProjectShortCode(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function suggestProjectShortCode(projectName: string) {
  const normalized = normalizeProjectShortCode(projectName);
  const firstLetterWord = normalized.match(FIRST_LETTER_WORD_PATTERN)?.[0];
  return (firstLetterWord || "PROJECT").slice(0, 3);
}

const canonicalShortCodeSchema = z
  .string()
  .min(1, "Short code is required.")
  .max(32, "Short code must be 32 characters or fewer.")
  .regex(
    /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/,
    "Short code must start with a letter and contain only letters, numbers, or hyphens.",
  );

export const shortCodeSchema = z
  .string()
  .trim()
  .min(1, "Short code is required.")
  .max(64, "Short code must be 64 characters or fewer.")
  .transform(normalizeProjectShortCode)
  .pipe(canonicalShortCodeSchema);

const optionalProjectTextSchema = z
  .string()
  .trim()
  .max(10_000)
  .nullable()
  .optional();

const projectLogoSchema = z.union([
  z
    .string()
    .trim()
    .max(1_000_100, "Logo must be 1 MB or smaller.")
    .regex(
      /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/,
      "Logo must be an uploaded PNG, JPEG, WebP, or GIF image.",
    ),
  z.string().trim().url().max(2000),
]);

const optionalProjectLogoSchema = projectLogoSchema.nullable().optional();

const targetDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must use YYYY-MM-DD.")
  .nullable()
  .optional();

const createProjectInputObjectSchema = z
  .object({
    logo: optionalProjectLogoSchema,
    name: projectNameSchema.optional(),
    problem: optionalProjectTextSchema,
    projectName: projectNameSchema.optional(),
    purpose: optionalProjectTextSchema,
    scope: optionalProjectTextSchema,
    shortCode: shortCodeSchema.optional(),
    starterConfiguration: starterConfigurationSchema,
    targetDate: targetDateSchema,
  })
  .strict();

export const createProjectInputSchema = createProjectInputObjectSchema
  .superRefine((input, context) => {
    if (!(input.name || input.projectName)) {
      context.addIssue({
        code: "custom",
        message: "Project Name is required.",
        path: ["projectName"],
      });
    }

    if (
      input.name &&
      input.projectName &&
      input.name.trim() !== input.projectName.trim()
    ) {
      context.addIssue({
        code: "custom",
        message: "Project Name must be provided only once.",
        path: ["projectName"],
      });
    }
  })
  .transform(({ name, projectName, ...input }) => ({
    ...input,
    name: (name ?? projectName ?? "").trim(),
  }));

const createProjectMutationInputObjectSchema = createProjectInputObjectSchema
  .extend({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(255),
  })
  .strict();

export const createProjectMutationInputSchema =
  createProjectMutationInputObjectSchema
    .superRefine((input, context) => {
      if (!(input.name || input.projectName)) {
        context.addIssue({
          code: "custom",
          message: "Project Name is required.",
          path: ["projectName"],
        });
      }

      if (
        input.name &&
        input.projectName &&
        input.name.trim() !== input.projectName.trim()
      ) {
        context.addIssue({
          code: "custom",
          message: "Project Name must be provided only once.",
          path: ["projectName"],
        });
      }
    })
    .transform(({ name, projectName, ...input }) => ({
      ...input,
      name: (name ?? projectName ?? "").trim(),
    }));

export type CreateProjectMutationInput = z.input<
  typeof createProjectMutationInputSchema
>;

export const updateProjectShortCodeInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(255),
    projectId: z.string().trim().min(1),
    shortCode: shortCodeSchema,
  })
  .strict();

export type UpdateProjectShortCodeInput = z.input<
  typeof updateProjectShortCodeInputSchema
>;

export type CreateProjectInput = z.input<typeof createProjectInputSchema>;
export type ParsedCreateProjectInput = z.output<
  typeof createProjectInputSchema
>;

export interface ProjectProfile {
  createdAt: string;
  id: string;
  logo: string | null;
  name: string;
  problem: string | null;
  purpose: string | null;
  revision: number;
  scope: string | null;
  shortCode: string;
  shortCodeLocked: boolean;
  starterConfiguration: StarterConfiguration;
  status: ProjectLifecycleStatus;
  targetDate: string | null;
  updatedAt: string;
}

export interface ProjectShellRecord
  extends Omit<ProjectProfile, "shortCodeLocked"> {
  workCount: number;
  workspaceId: string;
}

export type ProjectShellCreateRecord = Omit<
  ProjectShellRecord,
  "createdAt" | "id" | "revision" | "updatedAt" | "workCount" | "workspaceId"
>;

export interface ProjectShellMutationValue {
  project: ProjectProfile | null;
}

export type ProjectShellMutationContract =
  MutationContract<ProjectShellMutationValue>;

export interface ProjectShellMutationContracts {
  create: (accountId: string) => ProjectShellMutationContract;
  update: (accountId: string) => ProjectShellMutationContract;
}

export interface ProjectShellAccess {
  create: (
    accountId: string,
    input: CreateProjectInput,
  ) => Promise<ProjectProfile>;
  find: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectProfile | null>;
  list: (accountId: string) => Promise<ProjectProfile[]>;
  recordFirstWork: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectProfile | null>;
  updateShortCode: (
    accountId: string,
    projectId: string,
    shortCode: string,
  ) => Promise<ProjectProfile | null>;
}
