import { z } from "zod";

import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

/**
 * Usage links are intentionally not relation kinds. This is the complete
 * first-product catalog; adding another kind requires extending the domain
 * contract before it can be persisted.
 */
export const USAGE_LINK_KIND_OPTIONS = [
  "Inline reference",
  "Section reference",
  "Live block",
  "Pinned bind",
  "Screen reference",
] as const;

export type UsageLinkKind = (typeof USAGE_LINK_KIND_OPTIONS)[number];

export const usageLinkKindSchema = z.enum(USAGE_LINK_KIND_OPTIONS);

export const usageLinkEndpointSchema = z
  .object({
    recordId: identifierSchema,
    recordType: identifierSchema,
  })
  .strict();

/** Positional metadata only; source content and lifecycle values are not stored. */
export const usageLinkLocationSchema = z.json();

export const usageLinkPayloadSchema = z
  .object({
    kind: usageLinkKindSchema,
    location: usageLinkLocationSchema.optional(),
    source: usageLinkEndpointSchema,
    surface: usageLinkEndpointSchema,
  })
  .strict();

export type UsageLinkPayload = z.output<typeof usageLinkPayloadSchema>;

export const usageLinkSchema = usageLinkPayloadSchema
  .extend({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    revision: z.number().int().positive().safe(),
  })
  .strict();

export type UsageLink = z.output<typeof usageLinkSchema>;

export const createUsageLinkMutationInputSchema =
  humanMutationEnvelopeSchema.extend(usageLinkPayloadSchema.shape);

export type CreateUsageLinkMutationInput = z.input<
  typeof createUsageLinkMutationInputSchema
>;

export const listUsageLinksInputSchema = z
  .object({ source: usageLinkEndpointSchema })
  .strict();

export type ListUsageLinksInput = z.output<typeof listUsageLinksInputSchema>;

export const unlinkUsageLinkInputSchema = humanMutationEnvelopeSchema.extend({
  usageLinkId: identifierSchema,
});

export type UnlinkUsageLinkInput = z.output<typeof unlinkUsageLinkInputSchema>;

export interface UsageLinksAccess {
  create: (accountId: string, input: UsageLinkPayload) => Promise<UsageLink>;
  find: (accountId: string, usageLinkId: string) => Promise<UsageLink | null>;
  listBySource: (
    accountId: string,
    source: UsageLinkPayload["source"],
  ) => Promise<UsageLink[]>;
  unlink: (accountId: string, usageLinkId: string) => Promise<boolean>;
}

export interface UsageLinkMutationValue {
  usageLink: UsageLink | null;
}

export type UsageLinkMutationContract =
  MutationContract<UsageLinkMutationValue>;

export interface UsageLinkMutationContracts {
  create: (accountId: string) => UsageLinkMutationContract;
  unlink: (accountId: string) => UsageLinkMutationContract;
}
