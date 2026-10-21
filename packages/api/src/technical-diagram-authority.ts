import { z } from "zod";

import {
  resolveStructuralModel,
  StructuralModelError,
  structuralModelSchema,
} from "./technical-diagram-structure";
import {
  type diagramModelSchema,
  technicalDiagramTypeSchema,
} from "./technical-diagrams";

/** Closed `Diagram Authority Mode` catalog. */
export const DIAGRAM_AUTHORITY_MODES = [
  "Product-authored Model",
  "Repository-derived View",
  "Imported Independent Copy",
  "External Source Link",
] as const;

/** The first product never mints `Repository-derived View` (18 Repository schema). */
export const CREATABLE_AUTHORITY_MODES = [
  "Product-authored Model",
  "Imported Independent Copy",
  "External Source Link",
] as const;

export const diagramAuthorityModeSchema = z.enum(DIAGRAM_AUTHORITY_MODES);
export const creatableAuthorityModeSchema = z.enum(CREATABLE_AUTHORITY_MODES);

export type DiagramAuthorityMode = z.infer<typeof diagramAuthorityModeSchema>;
export type CreatableAuthorityMode = z.infer<
  typeof creatableAuthorityModeSchema
>;

/** Exact HTTPS URL without credentials; the client forms share this refine. */
export const externalSourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname.length > 0 &&
        url.username === "" &&
        url.password === ""
      );
    } catch {
      return false;
    }
  }, "External Source Link needs an exact HTTPS URL without credentials.");

/** Exact HTTPS target, optional known revision, source tool and last check. */
export const externalSourceLinkInputSchema = z
  .object({
    url: externalSourceUrlSchema,
    revision: z.string().trim().min(1).max(255).nullable(),
    tool: z.string().trim().min(1).max(120),
    lastCheckedAt: z.iso.datetime(),
  })
  .strict();

export type ExternalSourceLink = z.infer<typeof externalSourceLinkInputSchema>;

/**
 * Create command. `Imported Independent Copy` is only reachable through an
 * explicit conversion; `Repository-derived View` is refused by the schema.
 */
export const createTechnicalDiagramInputSchema = z
  .discriminatedUnion("authorityMode", [
    z
      .object({
        authorityMode: z.literal("Product-authored Model"),
        clientIdempotencyKey: z.uuid(),
        model: structuralModelSchema.optional(),
        projectId: z.string().min(1),
        title: z.string().trim().min(1).max(255),
        type: technicalDiagramTypeSchema,
      })
      .strict(),
    z
      .object({
        authorityMode: z.literal("External Source Link"),
        clientIdempotencyKey: z.uuid(),
        externalSource: externalSourceLinkInputSchema,
        projectId: z.string().min(1),
        title: z.string().trim().min(1).max(255),
        type: technicalDiagramTypeSchema,
      })
      .strict(),
  ])
  .superRefine((input, context) => {
    if (input.authorityMode !== "Product-authored Model" || !input.model) {
      return;
    }
    try {
      resolveStructuralModel(input.type, input.model);
    } catch (error) {
      if (error instanceof StructuralModelError) {
        context.addIssue({ code: "custom", message: error.message });
      }
    }
  });

export type CreateTechnicalDiagramInput = z.infer<
  typeof createTechnicalDiagramInputSchema
>;

export const authorityConversionInputSchema = z
  .object({
    externalSource: externalSourceLinkInputSchema.optional(),
    sourceDiagramId: z.string().min(1),
    targetMode: creatableAuthorityModeSchema,
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export const confirmAuthorityConversionInputSchema =
  authorityConversionInputSchema
    .extend({
      clientIdempotencyKey: z.uuid(),
      previewToken: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .strict();

export type AuthorityConversionInput = z.infer<
  typeof authorityConversionInputSchema
>;
export type ConfirmAuthorityConversionInput = z.infer<
  typeof confirmAuthorityConversionInputSchema
>;

export class DiagramAuthorityError extends Error {}

export interface AuthorityConversionPreview {
  canConvert: boolean;
  history: string;
  loss: string[];
  newIdentity: true;
  origin: { source: "Originates from"; sourceInverse: "Derived" };
  previewToken: string;
  sourceDiagramId: string;
  sourceMode: DiagramAuthorityMode;
  targetMode: CreatableAuthorityMode;
  targetType: z.infer<typeof technicalDiagramTypeSchema>;
  title: string;
}

export interface AuthorityConversionSource {
  authorityMode: DiagramAuthorityMode;
  id: string;
  model: z.infer<typeof diagramModelSchema>;
  type: z.infer<typeof technicalDiagramTypeSchema>;
}

/**
 * Refuses every change that would reclassify a row. Authority never changes in
 * place: the only way to a different mode is a conversion that mints a new
 * identity.
 */
export function assertAuthorityUnchanged(
  current: DiagramAuthorityMode,
  requested: string,
) {
  if (requested !== current) {
    throw new DiagramAuthorityError(
      "Diagram Authority Mode cannot change in place. Use a previewed conversion to mint a new Technical Diagram.",
    );
  }
}

export function conversionLoss(
  source: AuthorityConversionSource,
  targetMode: CreatableAuthorityMode,
): string[] {
  if (targetMode === "External Source Link") {
    return [
      "The structural model stays on the source Technical Diagram; the External Source Link keeps no content.",
      "The external tool stays canonical; the product neither fetches nor caches its content.",
    ];
  }
  if (source.authorityMode === "External Source Link") {
    return [
      "External content is not fetched; the new Technical Diagram starts with an empty structural model.",
    ];
  }
  if (targetMode === "Imported Independent Copy") {
    return [
      "Later changes to the source Technical Diagram are not tracked by the independent copy.",
    ];
  }
  return ["The copy is edited independently of the source Technical Diagram."];
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Pure preview of an authority conversion; it writes nothing. */
export async function previewAuthorityConversion(
  source: AuthorityConversionSource,
  input: AuthorityConversionInput,
): Promise<AuthorityConversionPreview> {
  const sameMode = source.authorityMode === input.targetMode;
  const missingLink =
    input.targetMode === "External Source Link" && !input.externalSource;
  const unexpectedLink =
    input.targetMode !== "External Source Link" && !!input.externalSource;
  const importedFromLink =
    input.targetMode === "Imported Independent Copy" &&
    source.authorityMode === "External Source Link";
  const loss = conversionLoss(source, input.targetMode);
  const fingerprint = JSON.stringify([
    source.id,
    source.authorityMode,
    source.model,
    input.targetMode,
    input.title,
    input.externalSource ?? null,
    loss,
  ]);
  return {
    canConvert: !(
      sameMode ||
      missingLink ||
      unexpectedLink ||
      importedFromLink
    ),
    history:
      "The source Technical Diagram keeps its identity, mode and history. The new Technical Diagram starts its own history and links to it with Originates from.",
    loss,
    newIdentity: true,
    origin: { source: "Originates from", sourceInverse: "Derived" },
    previewToken: await sha256Hex(fingerprint),
    sourceDiagramId: source.id,
    sourceMode: source.authorityMode,
    targetMode: input.targetMode,
    targetType: source.type,
    title: input.title,
  };
}

/** Confirm is refused unless it carries the token of the current preview. */
export async function assertPreviewedConversion(
  source: AuthorityConversionSource,
  input: ConfirmAuthorityConversionInput,
): Promise<AuthorityConversionPreview> {
  const preview = await previewAuthorityConversion(source, input);
  if (!preview.canConvert) {
    throw new DiagramAuthorityError(
      "This authority conversion is not available for the source Technical Diagram.",
    );
  }
  if (preview.previewToken !== input.previewToken) {
    throw new DiagramAuthorityError(
      "Preview the authority conversion again before confirming.",
    );
  }
  return preview;
}
