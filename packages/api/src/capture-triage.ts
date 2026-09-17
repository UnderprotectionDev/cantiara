import { z } from "zod";

export const CAPTURE_TEMPLATES = [
  "Bug Capture",
  "Feedback Capture",
  "Research Fragment",
] as const;

export type CaptureTemplate = (typeof CAPTURE_TEMPLATES)[number];

export const CAPTURE_TEMPLATE_FIELD_LABELS = {
  "Bug Capture": [
    "Observed Behavior",
    "Expected Behavior",
    "Reproduction Context",
  ],
  "Feedback Capture": ["Feedback", "Channel", "Contact"],
  "Research Fragment": ["Note or Excerpt", "Source Context"],
} as const satisfies Record<CaptureTemplate, readonly string[]>;

export const captureTemplateSchema = z.enum(CAPTURE_TEMPLATES);
const identifierSchema = z.string().trim().min(1).max(255);
const captureTextSchema = z.string().max(100_000);

export const captureFieldsSchema = z.record(z.string(), captureTextSchema);

export const captureInputSchema = z
  .object({
    clientIdempotencyKey: identifierSchema.optional(),
    content: captureTextSchema.default(""),
    fields: captureFieldsSchema.default({}),
    projectId: identifierSchema.nullable().default(null),
    template: captureTemplateSchema.nullable().default(null),
  })
  .strict();

export type CaptureInput = z.input<typeof captureInputSchema>;
export type NormalizedCaptureInput = z.output<typeof captureInputSchema>;

export const captureInboxItemSchema = z
  .object({
    content: captureTextSchema,
    createdAt: z.string().datetime({ offset: true }),
    fields: captureFieldsSchema,
    id: identifierSchema,
    projectId: identifierSchema.nullable(),
    template: captureTemplateSchema.nullable(),
  })
  .strict();

export type CaptureInboxItem = z.infer<typeof captureInboxItemSchema>;

export const captureInboxGroupSchema = z
  .object({
    itemIds: z.array(identifierSchema),
    items: z.array(captureInboxItemSchema),
    kind: z.enum(["workspace", "project"]),
    label: z.enum(["Workspace Capture Inbox", "Project Capture Inbox"]),
    projectId: identifierSchema.optional(),
  })
  .strict();

export type CaptureInboxGroup = z.infer<typeof captureInboxGroupSchema>;

export const captureInboxSnapshotSchema = z
  .object({
    groups: z.array(captureInboxGroupSchema),
    items: z.array(captureInboxItemSchema),
  })
  .strict();

export type CaptureInboxSnapshot = z.infer<typeof captureInboxSnapshotSchema>;

export interface CaptureInboxAccess {
  create: (accountId: string, input: CaptureInput) => Promise<CaptureInboxItem>;
  createBug: (
    accountId: string,
    input: CaptureInput,
  ) => Promise<DirectBugCreateReceipt>;
  list: (accountId: string) => Promise<CaptureInboxSnapshot>;
}

export interface DirectBugCreateInput extends NormalizedCaptureInput {
  accountId: string;
}

export interface DirectBugCreateReceipt {
  workId?: string;
}
