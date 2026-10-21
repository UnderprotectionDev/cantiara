import {
  buildProductGapFollowUpPlan,
  closeToolEscapeInputSchema,
  confirmProductGapFollowUpInputSchema,
  duplicateProductGapLink,
  isSameProductGapFollowUpPlan,
  listToolEscapesInputSchema,
  type ParsedCloseToolEscapeInput,
  type ProductGapLinkInput,
  type ProductGapRecord,
  type ProductGapStore,
  type ProductGapStoredLink,
  type ProductGapStoredRecord,
  type ProductGapsAccess,
  type ProductGapTargetResolver,
  previewProductGapFollowUpInputSchema,
  productGapLinkTargetsInputSchema,
  productGapListInputSchema,
  recordProductGapInputSchema,
  recordToolEscapeInputSchema,
  setProductGapStatusInputSchema,
  TOOL_ESCAPE_CLOSE_CONDITIONS,
  type ToolEscapeCloseCondition,
  type ToolEscapeCloseProof,
  type ToolEscapeCloseRecord,
  type ToolEscapeCloseStored,
  type ToolEscapeHighImpact,
  type ToolEscapeRecord,
  type ToolEscapeStored,
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

/** The source of an escape must be a visible record of this Workspace. */
export class ToolEscapeSourceError extends Error {
  readonly code = "TOOL_ESCAPE_SOURCE_UNAVAILABLE" as const;

  constructor(link: Pick<ProductGapLinkInput, "targetId" | "targetType">) {
    super(
      `${link.targetType} ${link.targetId} is not an available escape source.`,
    );
    this.name = "ToolEscapeSourceError";
  }
}

/** The escape does not exist in this Workspace. */
export class ToolEscapeNotFoundError extends Error {
  readonly code = "TOOL_ESCAPE_NOT_FOUND" as const;

  constructor(escapeId: string) {
    super(`Tool Escape ${escapeId} was not found.`);
    this.name = "ToolEscapeNotFoundError";
  }
}

/** The escape already has its one close; a close is never repeated or replaced. */
export class ToolEscapeAlreadyClosedError extends Error {
  readonly code = "TOOL_ESCAPE_ALREADY_CLOSED" as const;

  constructor(escapeId: string) {
    super(`Tool Escape ${escapeId} is already closed.`);
    this.name = "ToolEscapeAlreadyClosedError";
  }
}

/** Fail-closed: at least one of the four conditions is not met. */
export class ToolEscapeCloseRefusedError extends Error {
  readonly code = "TOOL_ESCAPE_CLOSE_REFUSED" as const;
  readonly conditions: ToolEscapeCloseCondition[];

  constructor(escapeId: string, conditions: ToolEscapeCloseCondition[]) {
    super(
      `Tool Escape ${escapeId} cannot close; unmet: ${conditions.join(", ")}.`,
    );
    this.name = "ToolEscapeCloseRefusedError";
    this.conditions = conditions;
  }
}

async function toCloseRecord(
  resolver: ProductGapTargetResolver,
  stored: ToolEscapeCloseStored,
): Promise<ToolEscapeCloseRecord> {
  const records = await Promise.all(
    stored.records.map(async (record) => {
      const live = await resolver.read(record);
      return {
        brokenReason: live.state === "broken" ? live.reason : null,
        label: live.state === "resolved" ? live.label : null,
        state: live.state,
        targetId: record.targetId,
        targetType: record.targetType,
      };
    }),
  );
  return { ...stored, records };
}

async function toEscapeRecord(
  resolver: ProductGapTargetResolver,
  stored: ToolEscapeStored,
  close: ToolEscapeCloseStored | null = null,
): Promise<ToolEscapeRecord> {
  const live = await resolver.read(stored.source);
  return {
    ...stored,
    close: close ? await toCloseRecord(resolver, close) : null,
    source: {
      brokenReason: live.state === "broken" ? live.reason : null,
      label: live.state === "resolved" ? live.label : null,
      projectId: stored.source.projectId,
      state: live.state,
      targetId: stored.source.targetId,
      targetType: stored.source.targetType,
    },
  };
}

async function toGapRecord(
  resolver: ProductGapTargetResolver,
  stored: ProductGapStoredRecord,
  escapeCount: number,
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
    escapeCount,
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
 * The restored records must each resolve live in this Workspace and be named
 * once. `null` when any is missing, unavailable or repeated, so the condition
 * is simply unmet; nothing is saved from a title or placeholder id.
 */
async function bindCloseRecords(
  resolver: ProductGapTargetResolver,
  records: readonly ProductGapLinkInput[],
) {
  if (records.length === 0 || duplicateProductGapLink(records)) {
    return null;
  }
  const bound = await Promise.all(
    records.map((record) => resolver.bind(record)),
  );
  return bound.every(Boolean) ? [...records] : null;
}

interface CloseProof {
  candidate: { build: string };
  externalCopy: { how: string };
  ok: true;
  records: ProductGapLinkInput[];
  restore: { method: ToolEscapeCloseStored["restoreMethod"] };
  workflow: { runRef: string };
}

/**
 * The four conditions, checked together and fail-closed. Anything missing,
 * unverifiable or contradicted leaves its condition unmet; a free-text note
 * never satisfies one.
 */
async function verifyCloseConditions(
  resolver: ProductGapTargetResolver,
  proof: ToolEscapeCloseProof | undefined,
  input: ParsedCloseToolEscapeInput,
): Promise<CloseProof | { ok: false; unmet: ToolEscapeCloseCondition[] }> {
  const records = await bindCloseRecords(
    resolver,
    input.restore?.records ?? [],
  );
  const run = input.workflow
    ? await proof?.workflowRun(input.workflow.runRef)
    : null;
  const candidate = (await proof?.currentCandidate()) ?? null;
  const met = new Set<ToolEscapeCloseCondition>();
  if (
    candidate !== null &&
    input.candidate?.build === candidate &&
    run?.succeeded &&
    run.build === candidate
  ) {
    met.add("Workflow succeeded on candidate");
  }
  if (records) {
    met.add("Truth restored in product records");
  }
  if (input.externalCopy?.state === "Closed") {
    met.add("External copy closed");
  }
  if (
    records &&
    run?.records &&
    records.every((record) =>
      run.records.some(
        (exercised) =>
          exercised.targetType === record.targetType &&
          exercised.targetId === record.targetId,
      ),
    )
  ) {
    met.add("Evidence bound to records");
  }
  const unmet = TOOL_ESCAPE_CLOSE_CONDITIONS.filter(
    (condition) => !met.has(condition),
  );
  if (
    unmet.length > 0 ||
    !(
      input.candidate &&
      input.workflow &&
      input.restore &&
      input.externalCopy
    ) ||
    !records
  ) {
    return {
      ok: false,
      unmet: unmet.length > 0 ? unmet : [...TOOL_ESCAPE_CLOSE_CONDITIONS],
    };
  }
  return {
    candidate: input.candidate,
    externalCopy: input.externalCopy,
    ok: true,
    records,
    restore: input.restore,
    workflow: input.workflow,
  };
}

/** Distinct tool names, first spelling wins, ordered for a stable filter list. */
function distinctTools(escapes: readonly ToolEscapeStored[]) {
  const seen = new Map<string, string>();
  for (const { tool } of escapes) {
    const key = tool.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, tool);
    }
  }
  return [...seen.values()].sort((left, right) => left.localeCompare(right));
}

/**
 * Product Gaps seam. A Product Gap exists only because the founder called
 * `record`: the module has no reader of app usage, browsers, titles or counts,
 * so nothing can file, merge, rank or convert a Gap on the founder's behalf.
 * `setStatus` writes the Gap row alone; the escape events (#418) and every
 * linked Project, Work, Feature and Decision keep their own lifecycles.
 */
export function createProductGaps(
  store: ProductGapStore,
  proof?: ToolEscapeCloseProof,
): ProductGapsAccess {
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
          return await toGapRecord(transaction.resolver, stored, 0);
        },
      );
      if (!created) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return created;
    },

    async list(accountId, rawFilter) {
      const filter = productGapListInputSchema.parse(rawFilter ?? {});
      const { status, ...escapeFilter } = filter;
      const filteringEvents = Object.keys(escapeFilter).length > 0;
      const listed = await store.run(accountId, "read", async (transaction) => {
        const [stored, matching, every] = await Promise.all([
          transaction.listGaps(),
          transaction.listEscapes(escapeFilter),
          filteringEvents ? transaction.listEscapes({}) : null,
        ]);
        const counts = new Map<string, number>();
        for (const event of matching) {
          counts.set(event.gapId, (counts.get(event.gapId) ?? 0) + 1);
        }
        // Filters only select. The order stays the order of recording.
        const gaps = await Promise.all(
          stored
            .filter(
              (gap) =>
                (!status || gap.status === status) &&
                (!filteringEvents || counts.has(gap.id)),
            )
            .map((gap) =>
              toGapRecord(transaction.resolver, gap, counts.get(gap.id) ?? 0),
            ),
        );
        return { gaps, tools: distinctTools(every ?? matching) };
      });
      if (!listed) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return listed;
    },

    async listEscapes(accountId, rawInput) {
      const input = listToolEscapesInputSchema.parse(rawInput);
      const listed = await store.run(accountId, "read", async (transaction) => {
        if (!(await transaction.findGap(input.gapId, false))) {
          throw new ProductGapNotFoundError(input.gapId);
        }
        const events = await transaction.listEscapes(input);
        const closes = await transaction.listEscapeCloses(
          events.map((event) => event.id),
        );
        return await Promise.all(
          events.map((event) =>
            toEscapeRecord(
              transaction.resolver,
              event,
              closes.find((close) => close.escapeId === event.id) ?? null,
            ),
          ),
        );
      });
      if (!listed) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return listed;
    },

    async recordToolEscape(accountId, rawInput) {
      const input = recordToolEscapeInputSchema.parse(rawInput);
      const recorded = await store.run(
        accountId,
        "write",
        async (transaction) => {
          const now = new Date().toISOString();
          const source = await transaction.resolver.bindSource(
            input.escape.source,
          );
          if (!source) {
            throw new ToolEscapeSourceError(input.escape.source);
          }
          // A deliberate choice: a new Gap, or the one the founder names. A
          // similar title never selects or merges anything.
          let stored: ProductGapStoredRecord;
          if (input.gap.kind === "Existing") {
            const found = await transaction.findGap(input.gap.gapId, true);
            if (!found) {
              throw new ProductGapNotFoundError(input.gap.gapId);
            }
            stored = found;
          } else {
            stored = {
              createdAt: now,
              id: crypto.randomUUID(),
              links: await bindLinks(
                transaction.resolver,
                input.gap.links,
                now,
              ),
              scope: input.gap.scope,
              status: "Open",
              statusChangedAt: now,
              title: input.gap.title,
              unmetNeed: input.gap.unmetNeed,
              updatedAt: now,
            };
            await transaction.insertGap(stored);
          }
          const event: ToolEscapeStored = {
            gapId: stored.id,
            id: crypto.randomUUID(),
            intendedJob: input.escape.intendedJob,
            note: input.escape.note,
            occurredAt: new Date(input.escape.occurredAt).toISOString(),
            reasons: input.escape.reasons,
            recordedAt: now,
            source: {
              projectId: source.projectId,
              targetId: input.escape.source.targetId,
              targetType: input.escape.source.targetType,
            },
            tool: input.escape.tool,
          };
          await transaction.insertEscape(event);
          const count = (await transaction.listEscapes({ gapId: stored.id }))
            .length;
          return {
            escape: await toEscapeRecord(transaction.resolver, event),
            gap: await toGapRecord(transaction.resolver, stored, count),
          };
        },
      );
      if (!recorded) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return recorded;
    },

    async closeToolEscape(accountId, rawInput) {
      const input = closeToolEscapeInputSchema.parse(rawInput);
      const closed = await store.run(
        accountId,
        "write",
        async (transaction) => {
          // The escape row is held, so two closes cannot both pass the check.
          const found = await transaction.findEscape(input.escapeId, true);
          if (!found) {
            throw new ToolEscapeNotFoundError(input.escapeId);
          }
          if ((await transaction.listEscapeCloses([found.id])).length > 0) {
            throw new ToolEscapeAlreadyClosedError(found.id);
          }
          // A judgement of `Never held parallel truth` is the founder's own
          // close: it writes the one close row with no proof and no bound
          // records, and never reads the Gap status.
          if (input.impact === "Never held parallel truth") {
            const stored: ToolEscapeCloseStored = {
              candidateBuild: null,
              closedAt: new Date().toISOString(),
              escapeId: found.id,
              externalCopyHow: null,
              gapId: found.gapId,
              id: crypto.randomUUID(),
              impact: input.impact,
              records: [],
              restoreMethod: null,
              workflowRef: null,
            };
            await transaction.insertEscapeClose(stored);
            return await toEscapeRecord(transaction.resolver, found, stored);
          }
          // Gap status, including `Conscious boundary`, is never read here.
          const proven = await verifyCloseConditions(
            transaction.resolver,
            proof,
            input,
          );
          if (!proven.ok) {
            throw new ToolEscapeCloseRefusedError(found.id, proven.unmet);
          }
          const { candidate, externalCopy, records, restore, workflow } =
            proven;
          const stored: ToolEscapeCloseStored = {
            candidateBuild: candidate.build,
            closedAt: new Date().toISOString(),
            escapeId: found.id,
            externalCopyHow: externalCopy.how,
            gapId: found.gapId,
            id: crypto.randomUUID(),
            impact: input.impact satisfies ToolEscapeHighImpact,
            records,
            restoreMethod: restore.method,
            workflowRef: workflow.runRef,
          };
          await transaction.insertEscapeClose(stored);
          return await toEscapeRecord(transaction.resolver, found, stored);
        },
      );
      if (!closed) {
        throw new ProductGapWorkspaceNotFoundError();
      }
      return closed;
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
          const count = (await transaction.listEscapes({ gapId: gap.id }))
            .length;
          if (input.status === gap.status) {
            return await toGapRecord(transaction.resolver, gap, count);
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
          return await toGapRecord(
            transaction.resolver,
            {
              ...gap,
              status: input.status,
              statusChangedAt: changedAt,
              updatedAt: changedAt,
            },
            count,
          );
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
        return stored
          ? await toGapRecord(
              transaction.resolver,
              stored,
              (await transaction.listEscapes({ gapId: stored.id })).length,
            )
          : null;
      });
      if (!gap) {
        throw new ProductGapNotFoundError(input.gapId);
      }
      return { followUp: receipt, gap };
    },
  };
}
