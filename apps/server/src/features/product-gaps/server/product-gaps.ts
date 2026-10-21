import {
  buildProductGapFollowUpPlan,
  confirmProductGapFollowUpInputSchema,
  duplicateProductGapLink,
  isSameProductGapFollowUpPlan,
  type ProductGapLinkInput,
  type ProductGapRecord,
  type ProductGapStore,
  type ProductGapStoredLink,
  type ProductGapStoredRecord,
  type ProductGapsAccess,
  type ProductGapTargetResolver,
  previewProductGapFollowUpInputSchema,
  productGapLinkTargetsInputSchema,
  recordProductGapInputSchema,
  setProductGapStatusInputSchema,
} from "@cantiara/api/product-gaps";

export class ProductGapWorkspaceNotFoundError extends Error {
  readonly code = "PRODUCT_GAP_WORKSPACE_NOT_FOUND" as const;

  constructor() {
    super("Workspace was not found for this Account.");
    this.name = "ProductGapWorkspaceNotFoundError";
  }
}

export class ProductGapNotFoundError extends Error {
  readonly code = "PRODUCT_GAP_NOT_FOUND" as const;

  constructor(gapId: string) {
    super(`Product Gap ${gapId} was not found.`);
    this.name = "ProductGapNotFoundError";
  }
}

/** A link names no existing, visible record of this Workspace (or repeats one). */
export class ProductGapLinkTargetError extends Error {
  readonly code = "PRODUCT_GAP_LINK_TARGET_UNAVAILABLE" as const;

  constructor(link: Pick<ProductGapLinkInput, "targetId" | "targetType">) {
    super(
      `${link.targetType} ${link.targetId} is not an available related record.`,
    );
    this.name = "ProductGapLinkTargetError";
  }
}

/** The Gap moved while the founder acted on the status they saw. */
export class ProductGapStatusConflictError extends Error {
  readonly code = "PRODUCT_GAP_STATUS_CONFLICT" as const;

  constructor(gapId: string) {
    super(`Product Gap ${gapId} changed since it was loaded.`);
    this.name = "ProductGapStatusConflictError";
  }
}

/** The follow-up names a Project or Feature that is not available. */
export class ProductGapFollowUpTargetError extends Error {
  readonly code = "PRODUCT_GAP_FOLLOW_UP_TARGET_UNAVAILABLE" as const;

  constructor() {
    super("The follow-up Project or Feature is not available.");
    this.name = "ProductGapFollowUpTargetError";
  }
}

export class ProductGapProjectReadOnlyError extends Error {
  readonly code = "PRODUCT_GAP_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "ProductGapProjectReadOnlyError";
  }
}

/** The previewed plan no longer matches the Gap; reopen the preview. */
export class ProductGapFollowUpStaleError extends Error {
  readonly code = "PRODUCT_GAP_FOLLOW_UP_STALE" as const;

  constructor(gapId: string, options?: ErrorOptions) {
    super(`The follow-up preview of Product Gap ${gapId} is stale.`, options);
    this.name = "ProductGapFollowUpStaleError";
  }
}

async function toGapRecord(
  resolver: ProductGapTargetResolver,
  stored: ProductGapStoredRecord,
): Promise<ProductGapRecord> {
  const links = await Promise.all(
    stored.links.map(async (link) => {
      const live = await resolver.read(link);
      return {
        brokenReason: live.state === "broken" ? live.reason : null,
        id: link.id,
        kind: link.kind,
        label: live.state === "resolved" ? live.label : null,
        state: live.state,
        targetId: link.targetId,
        targetType: link.targetType,
      };
    }),
  );
  return {
    createdAt: stored.createdAt,
    id: stored.id,
    links,
    scope: stored.scope,
    status: stored.status,
    statusChangedAt: stored.statusChangedAt,
    title: stored.title,
    unmetNeed: stored.unmetNeed,
    updatedAt: stored.updatedAt,
  };
}

/** Every link must resolve live: a title or placeholder id is never saved. */
async function bindLinks(
  resolver: ProductGapTargetResolver,
  links: readonly ProductGapLinkInput[],
  createdAt: string,
): Promise<ProductGapStoredLink[]> {
  const duplicate = duplicateProductGapLink(links);
  if (duplicate) {
    throw new ProductGapLinkTargetError(duplicate);
  }
  return await Promise.all(
    links.map(async (link) => {
      if (!(await resolver.bind(link))) {
        throw new ProductGapLinkTargetError(link);
      }
      return {
        createdAt,
        id: crypto.randomUUID(),
        kind: "Related" as const,
        targetId: link.targetId,
        targetType: link.targetType,
      };
    }),
  );
}

/**
 * Product Gaps seam. A Product Gap exists only because the founder called
 * `record`: the module has no reader of app usage, browsers, titles or counts,
 * so nothing can file, merge, rank or convert a Gap on the founder's behalf.
 * `setStatus` writes the Gap row alone; the escape events (#418) and every
 * linked Project, Work, Feature and Decision keep their own lifecycles.
 */
export function createProductGaps(store: ProductGapStore): ProductGapsAccess {
  async function readSource(
    accountId: string,
    input: Parameters<ProductGapStore["readFollowUpSource"]>[1],
  ) {
    const source = await store.readFollowUpSource(accountId, input);
    if (!source) {
      throw new ProductGapNotFoundError(input.gapId);
    }
    const { gap, target } = source;
    if (!target) {
      throw new ProductGapFollowUpTargetError();
    }
    if (target.kind === "Work" && target.project.readOnly) {
      throw new ProductGapProjectReadOnlyError(target.project.id);
    }
    return { gap, target };
  }

  return {
    async record(accountId, rawInput) {
      const input = recordProductGapInputSchema.parse(rawInput);
      const created = await store.run(
        accountId,
        "write",
        async (transaction) => {
          const now = new Date().toISOString();
          // Similar titles are never merged: every call writes its own Gap.
          const stored: ProductGapStoredRecord = {
            createdAt: now,
            id: crypto.randomUUID(),
            links: await bindLinks(transaction.resolver, input.links, now),
            scope: input.scope,
            status: "Open",
            statusChangedAt: now,
            title: input.title,
            unmetNeed: input.unmetNeed,
            updatedAt: now,
          };
          await transaction.insertGap(stored);
          return await toGapRecord(transaction.resolver, stored);
        },
      );
      if (!created) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return created;
    },

    async list(accountId) {
      const listed = await store.run(
        accountId,
        "read",
        async (transaction) => ({
          gaps: await Promise.all(
            (await transaction.listGaps()).map((stored) =>
              toGapRecord(transaction.resolver, stored),
            ),
          ),
        }),
      );
      if (!listed) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return listed;
    },

    async setStatus(accountId, rawInput) {
      const input = setProductGapStatusInputSchema.parse(rawInput);
      const changed = await store.run(
        accountId,
        "write",
        async (transaction) => {
          const gap = await transaction.findGap(input.gapId, true);
          if (!gap) {
            throw new ProductGapNotFoundError(input.gapId);
          }
          if (gap.status !== input.expectedStatus) {
            throw new ProductGapStatusConflictError(gap.id);
          }
          if (input.status === gap.status) {
            return await toGapRecord(transaction.resolver, gap);
          }
          const changedAt = new Date().toISOString();
          if (
            !(await transaction.setStatus(
              gap.id,
              gap.status,
              input.status,
              changedAt,
            ))
          ) {
            throw new ProductGapStatusConflictError(gap.id);
          }
          return await toGapRecord(transaction.resolver, {
            ...gap,
            status: input.status,
            statusChangedAt: changedAt,
            updatedAt: changedAt,
          });
        },
      );
      if (!changed) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return changed;
    },

    async linkTargets(accountId, rawInput) {
      const input = productGapLinkTargetsInputSchema.parse(rawInput);
      const targets = await store.run(accountId, "read", (transaction) =>
        transaction.resolver.candidates(input.targetType),
      );
      if (!targets) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return targets;
    },

    async previewFollowUp(accountId, rawInput) {
      const input = previewProductGapFollowUpInputSchema.parse(rawInput);
      const source = await readSource(accountId, input);
      return buildProductGapFollowUpPlan(
        source,
        input.kind === "Work" ? input.workType : undefined,
      );
    },

    async confirmFollowUp(accountId, rawInput) {
      const input = confirmProductGapFollowUpInputSchema.parse(rawInput);
      const { plan } = input;
      const source = await readSource(
        accountId,
        plan.kind === "Work"
          ? {
              gapId: input.gapId,
              kind: "Work",
              projectId: plan.targetProject.id,
              workType: plan.work.type,
            }
          : {
              featureId: plan.feature.id,
              gapId: input.gapId,
              kind: "Feature relation",
            },
      );
      // Only the exact previewed plan may be confirmed; a changed record is refused.
      if (
        plan.gapId !== input.gapId ||
        !isSameProductGapFollowUpPlan(
          plan,
          buildProductGapFollowUpPlan(
            source,
            plan.kind === "Work" ? plan.work.type : undefined,
          ),
        )
      ) {
        throw new ProductGapFollowUpStaleError(input.gapId);
      }
      const receipt = await store.confirmFollowUp(accountId, input);
      if (!receipt) {
        throw new ProductGapNotFoundError(input.gapId);
      }
      const gap = await store.run(accountId, "read", async (transaction) => {
        const stored = await transaction.findGap(input.gapId, false);
        return stored ? await toGapRecord(transaction.resolver, stored) : null;
      });
      if (!gap) {
        throw new ProductGapNotFoundError(input.gapId);
      }
      return { followUp: receipt, gap };
    },
  };
}
