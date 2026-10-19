import {
  buildConvertAndBindPlan,
  confirmConvertAndBindInputSchema,
  confirmRebindInputSchema,
  createScreenFromTemplateInputSchema,
  findWireframeBlock,
  isSameConvertAndBindPlan,
  type LiveCardResolution,
  previewConvertAndBindInputSchema,
  previewRebindInputSchema,
  type RebindPlan,
  rebindPlanSchema,
  resolveOriginLocation,
  type ScreenBlockOriginRecord,
  type ScreenBlockOriginRow,
  type ScreenBlockOriginView,
  saveScreenTemplateInputSchema,
  screenTemplateListInputSchema,
} from "@cantiara/api/screen-origins";
import { sanitizeTemplateDocument } from "@cantiara/api/screen-templates";
import {
  saveScreenViewportInputSchema,
  screenViewportInputSchema,
} from "@cantiara/api/screen-viewport";
import {
  createLinkedBlockInputSchema,
  createScreenInputSchema,
  linkedBlockChangeInputSchema,
  resolveScreenInputSchema,
  resolveScreenTarget,
  type ScreenStore,
  type ScreensAccess,
  type ScreenWireframe,
  type StoredWireframe,
  saveScreenWireframeInputSchema,
  screenProjectInputSchema,
  screenWireframeInputSchema,
  setScreenLifecycleInputSchema,
} from "@cantiara/api/screens";
import {
  applyWireframeTransaction,
  freezeLiveText,
  type LinkedBlockScreen,
  type LiveSectionLookup,
  liveTextSources,
  previewLinkedSourceChange,
  resolveLiveText,
} from "@cantiara/api/wireframe-commands";
import {
  parseWireframeDocument,
  type WireframeDocument,
  WireframeDocumentError,
  type WireframeLinkedDefinition,
} from "@cantiara/api/wireframe-document";

export class ScreenProjectNotFoundError extends Error {
  readonly code = "SCREEN_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ScreenProjectNotFoundError";
  }
}

export class ScreenNotFoundError extends Error {
  readonly code = "SCREEN_NOT_FOUND" as const;

  constructor(screenId: string) {
    super(`Screen ${screenId} was not found.`);
    this.name = "ScreenNotFoundError";
  }
}

export class LinkedBlockNotFoundError extends Error {
  readonly code = "SCREEN_LINKED_BLOCK_NOT_FOUND" as const;

  constructor(definitionId: string) {
    super(`Linked block ${definitionId} was not found.`);
    this.name = "LinkedBlockNotFoundError";
  }
}

export class ScreenVersionNotFoundError extends Error {
  readonly code = "SCREEN_VERSION_NOT_FOUND" as const;

  constructor(screenId: string, version: number) {
    super(`Screen ${screenId} has no Wireframe version ${version}.`);
    this.name = "ScreenVersionNotFoundError";
  }
}

export class ScreenTemplateNotFoundError extends Error {
  readonly code = "SCREEN_TEMPLATE_NOT_FOUND" as const;

  constructor(templateId: string) {
    super(`Wireframe template ${templateId} was not found.`);
    this.name = "ScreenTemplateNotFoundError";
  }
}

/** The previewed plan no longer matches the block or version; reopen the preview. */
export class ScreenConversionStaleError extends Error {
  readonly code = "SCREEN_CONVERSION_STALE" as const;

  constructor(screenId: string) {
    super(`The Convert and Bind preview of Screen ${screenId} is stale.`);
    this.name = "ScreenConversionStaleError";
  }
}

export class ScreenRevisionConflictError extends Error {
  readonly code = "SCREEN_REVISION_CONFLICT" as const;

  constructor(screenId: string) {
    super(`Screen ${screenId} changed since it was loaded.`);
    this.name = "ScreenRevisionConflictError";
  }
}

export class ScreenProjectReadOnlyError extends Error {
  readonly code = "SCREEN_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "ScreenProjectReadOnlyError";
  }
}

/** The lifecycle action does not apply to the Screen's current visibility. */
export class ScreenLifecycleInvalidError extends Error {
  readonly code = "SCREEN_LIFECYCLE_INVALID" as const;

  constructor(screenId: string, action: string) {
    super(`Screen ${screenId} cannot ${action} from its current visibility.`);
    this.name = "ScreenLifecycleInvalidError";
  }
}

/**
 * Screens and Wireframes seam. Commands address a Screen only; inputs are
 * strict, so a Wireframe id, visual design or independent Wireframe lifecycle
 * can never be named, and a target is resolved by its exact id or reported broken.
 */
export function createScreens(store: ScreenStore): ScreensAccess {
  async function lookupFor(
    accountId: string,
    document: WireframeDocument,
  ): Promise<LiveSectionLookup> {
    const sources = liveTextSources(document);
    if (sources.length === 0) {
      return () => null;
    }
    const sections = await store.readLiveSections(accountId, sources);
    return (source) =>
      sections.find(
        (section) =>
          section.documentId === source.documentId &&
          section.sectionId === source.sectionId,
      )?.text ?? null;
  }

  async function toWireframe(
    accountId: string,
    screenId: string,
    stored: StoredWireframe,
  ): Promise<ScreenWireframe> {
    const document = parseWireframeDocument(stored.document);
    const lookup = await lookupFor(accountId, document);
    const liveCards = await liveCardsFor(accountId, document);
    return {
      createdAt: stored.createdAt,
      document,
      ...(liveCards ? { liveCards } : {}),
      liveText: resolveLiveText(document, lookup),
      screenId,
      version: stored.version,
      versionId: stored.versionId,
    };
  }

  async function linkedChange(
    accountId: string,
    rawInput: unknown,
    apply: boolean,
  ) {
    const input = linkedBlockChangeInputSchema.parse(rawInput);
    const current = await store.findLinkedBlock(
      accountId,
      input.projectId,
      input.definitionId,
    );
    if (!current) {
      throw new LinkedBlockNotFoundError(input.definitionId);
    }
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== current.revision
    ) {
      throw new ScreenRevisionConflictError(current.id);
    }
    if (input.content.kind !== current.content.kind) {
      throw new WireframeDocumentError(
        "INVALID_COMMAND",
        "A linked block keeps its kind when its source changes.",
      );
    }
    const heads = await store.headDocuments(accountId, input.projectId);
    if (!heads) {
      throw new ScreenProjectNotFoundError(input.projectId);
    }
    const screens: LinkedBlockScreen[] = heads.map((head) => ({
      document: parseWireframeDocument(head.document),
      lifecycle: head.lifecycle,
      screenId: head.screenId,
      title: head.title,
    }));
    const affectedScreens = previewLinkedSourceChange(
      screens,
      input.definitionId,
    );
    const definition: WireframeLinkedDefinition = {
      content: input.content,
      id: current.id,
      name: current.name,
      revision: current.revision + 1,
    };
    if (!apply) {
      return { affectedScreens, applied: false, definition };
    }
    const updates = affectedScreens.flatMap(({ screenId }) => {
      const screen = screens.find((item) => item.screenId === screenId);
      return screen
        ? [
            {
              document: applyWireframeTransaction(screen.document, [
                { definition, type: "applyLinkedSource" },
              ]),
              screenId,
            },
          ]
        : [];
    });
    const saved = await store.applyLinkedBlockChange(accountId, input, updates);
    if (!saved) {
      throw new LinkedBlockNotFoundError(input.definitionId);
    }
    return {
      affectedScreens,
      applied: true,
      definition: { ...definition, revision: saved.revision },
    };
  }

  async function liveCardsFor(
    accountId: string,
    document: WireframeDocument,
  ): Promise<Record<string, LiveCardResolution> | null> {
    const cards = document.blocks.flatMap((block) =>
      block.kind === "Live Card" ? [{ block, ...block.props }] : [],
    );
    if (cards.length === 0) {
      return null;
    }
    // Read-only: the record is only read, a card move never reaches it.
    const found = await store.readLiveCards(
      accountId,
      cards.map(({ recordId, recordType }) => ({ recordId, recordType })),
    );
    return Object.fromEntries(
      cards.map(({ block, recordId, recordType }) => {
        const title =
          found.find(
            (item) =>
              item.recordId === recordId && item.recordType === recordType,
          )?.title ?? null;
        return [
          block.id,
          { state: title === null ? "broken" : "resolved", title },
        ];
      }),
    );
  }

  /** The readable Screen plus the stored exact version; a Screen in Trash is broken. */
  async function exactSource(
    accountId: string,
    projectId: string,
    screenId: string,
    version: number,
  ) {
    const record = await store.find(accountId, projectId, screenId);
    const target = resolveScreenTarget(screenId, record);
    if (!record || target.state === "broken") {
      throw new ScreenNotFoundError(screenId);
    }
    const stored = await store.findWireframe(
      accountId,
      projectId,
      screenId,
      version,
    );
    if (!stored || stored.version !== version) {
      throw new ScreenVersionNotFoundError(screenId, version);
    }
    return { record, stored };
  }

  async function originView(
    accountId: string,
    row: ScreenBlockOriginRecord & { targetTitle?: string | null },
    heads: Map<string, unknown | null>,
    screenTarget: ReturnType<typeof resolveScreenTarget>,
  ): Promise<ScreenBlockOriginView> {
    let head = heads.get(row.screenId);
    if (head === undefined) {
      const stored =
        screenTarget.state === "resolved"
          ? await store.findWireframe(accountId, row.projectId, row.screenId)
          : null;
      head = stored ? stored.document : null;
      heads.set(row.screenId, head);
    }
    return {
      createdAt: row.createdAt,
      id: row.id,
      location: resolveOriginLocation(row, head),
      relation: "Origin",
      screen: screenTarget,
      supersededAt: row.supersededAt,
      supersedesId: row.supersedesId,
      target: {
        projectId: row.projectId,
        recordId: row.targetRecordId,
        title: row.targetTitle ?? null,
        type: row.targetType,
      },
    };
  }

  async function originsOf(
    accountId: string,
    projectId: string,
    screenId: string,
  ): Promise<ScreenBlockOriginView[]> {
    const rows = await store.listOrigins(accountId, projectId, screenId);
    if (!rows) {
      throw new ScreenNotFoundError(screenId);
    }
    const record = await store.find(accountId, projectId, screenId);
    const screenTarget = resolveScreenTarget(screenId, record);
    const heads = new Map<string, unknown | null>();
    return Promise.all(
      rows.map((row: ScreenBlockOriginRow) =>
        originView(accountId, row, heads, screenTarget),
      ),
    );
  }

  async function viewOfOrigin(
    accountId: string,
    saved: ScreenBlockOriginRecord,
  ) {
    const views = await originsOf(accountId, saved.projectId, saved.screenId);
    const view = views.find(({ id }) => id === saved.id);
    if (!view) {
      throw new ScreenNotFoundError(saved.screenId);
    }
    return view;
  }

  async function rebindPlanFor(
    accountId: string,
    input: {
      blockId: string;
      originId: string;
      projectId: string;
      screenId: string;
      wireframeVersion: number;
    },
  ): Promise<RebindPlan> {
    const rows = await store.listOrigins(
      accountId,
      input.projectId,
      input.screenId,
    );
    const current = rows?.find(
      ({ id, supersededAt }) => id === input.originId && supersededAt === null,
    );
    if (!current) {
      throw new ScreenNotFoundError(input.screenId);
    }
    const { stored } = await exactSource(
      accountId,
      input.projectId,
      input.screenId,
      input.wireframeVersion,
    );
    if (!findWireframeBlock(stored.document, input.blockId)) {
      throw new WireframeDocumentError(
        "BLOCK_NOT_FOUND",
        `Block ${input.blockId} is not on Wireframe version ${input.wireframeVersion}.`,
      );
    }
    return rebindPlanSchema.parse({
      from: {
        blockId: current.blockId,
        ownerScreenId: current.screenId,
        wireframeVersion: current.wireframeVersion,
      },
      originId: current.id,
      projectId: input.projectId,
      screenId: input.screenId,
      targetRecordId: current.targetRecordId,
      targetType: current.targetType,
      to: {
        blockId: input.blockId,
        ownerScreenId: input.screenId,
        wireframeVersion: input.wireframeVersion,
      },
    });
  }

  async function convertPlanFor(
    accountId: string,
    input: ReturnType<typeof previewConvertAndBindInputSchema.parse>,
  ) {
    const { record, stored } = await exactSource(
      accountId,
      input.projectId,
      input.screenId,
      input.wireframeVersion,
    );
    const summary = await store.projectSummary(accountId, input.projectId);
    if (!summary) {
      throw new ScreenProjectNotFoundError(input.projectId);
    }
    return buildConvertAndBindPlan({
      document: stored.document,
      input,
      project: summary,
      screen: { id: record.id, title: record.title },
    });
  }

  return {
    previewConvertAndBind(accountId, rawInput) {
      // Read-only: no store write is reachable from a preview.
      return convertPlanFor(
        accountId,
        previewConvertAndBindInputSchema.parse(rawInput),
      );
    },

    async convertAndBind(accountId, rawInput) {
      const input = confirmConvertAndBindInputSchema.parse(rawInput);
      const { plan } = input;
      if (
        plan.screenId !== input.screenId ||
        plan.projectId !== input.projectId
      ) {
        throw new ScreenConversionStaleError(input.screenId);
      }
      const current = await convertPlanFor(accountId, {
        blockId: plan.originLocation.blockId,
        projectId: plan.projectId,
        screenId: plan.screenId,
        targetType: plan.targetType,
        title: plan.title,
        wireframeVersion: plan.originLocation.wireframeVersion,
        workType: plan.workType ?? undefined,
      }).catch((error) => {
        if (error instanceof WireframeDocumentError) {
          throw new ScreenConversionStaleError(input.screenId);
        }
        throw error;
      });
      // Only the exact previewed plan may be confirmed; an edited block is refused.
      if (!isSameConvertAndBindPlan(plan, current)) {
        throw new ScreenConversionStaleError(input.screenId);
      }
      const saved = await store.convertBlock(accountId, input);
      if (!saved) {
        throw new ScreenNotFoundError(input.screenId);
      }
      return viewOfOrigin(accountId, saved);
    },

    origins(accountId, input) {
      const parsed = resolveScreenInputSchema.parse(input);
      return originsOf(accountId, parsed.projectId, parsed.screenId);
    },

    previewRebind(accountId, rawInput) {
      return rebindPlanFor(accountId, previewRebindInputSchema.parse(rawInput));
    },

    async rebind(accountId, rawInput) {
      const input = confirmRebindInputSchema.parse(rawInput);
      const current = await rebindPlanFor(accountId, {
        blockId: input.plan.to.blockId,
        originId: input.plan.originId,
        projectId: input.projectId,
        screenId: input.plan.screenId,
        wireframeVersion: input.plan.to.wireframeVersion,
      }).catch((error) => {
        if (error instanceof WireframeDocumentError) {
          throw new ScreenConversionStaleError(input.plan.screenId);
        }
        throw error;
      });
      if (
        JSON.stringify(current) !==
        JSON.stringify(rebindPlanSchema.parse(input.plan))
      ) {
        throw new ScreenConversionStaleError(input.plan.screenId);
      }
      const saved = await store.rebindOrigin(accountId, input);
      if (!saved) {
        throw new ScreenNotFoundError(input.plan.screenId);
      }
      return viewOfOrigin(accountId, saved);
    },

    async saveTemplate(accountId, rawInput) {
      const input = saveScreenTemplateInputSchema.parse(rawInput);
      const { stored } = await exactSource(
        accountId,
        input.projectId,
        input.screenId,
        input.wireframeVersion,
      );
      // Sanitized before storing: nothing that points back at the source Project.
      const saved = await store.saveTemplate(accountId, {
        document: sanitizeTemplateDocument(stored.document),
        name: input.name,
        projectId: input.projectId,
      });
      if (!saved) {
        throw new ScreenProjectNotFoundError(input.projectId);
      }
      return { createdAt: saved.createdAt, id: saved.id, name: saved.name };
    },

    async templates(accountId, projectId) {
      const parsed = screenTemplateListInputSchema.parse({ projectId });
      const list = await store.listTemplates(accountId, parsed.projectId);
      if (!list) {
        throw new ScreenProjectNotFoundError(parsed.projectId);
      }
      return list.map(({ createdAt, id, name }) => ({ createdAt, id, name }));
    },

    async createScreenFromTemplate(accountId, rawInput) {
      const input = createScreenFromTemplateInputSchema.parse(rawInput);
      const template = await store.findTemplate(
        accountId,
        input.projectId,
        input.templateId,
      );
      if (!template) {
        throw new ScreenTemplateNotFoundError(input.templateId);
      }
      const created = await store.createScreenFromTemplate(accountId, {
        projectId: input.projectId,
        template,
        title: input.title,
      });
      if (!created) {
        throw new ScreenProjectNotFoundError(input.projectId);
      }
      return created;
    },

    applyLinkedBlockChange: (accountId, input) =>
      linkedChange(accountId, input, true),

    previewLinkedBlockChange: (accountId, input) =>
      linkedChange(accountId, input, false),

    async createLinkedBlock(accountId, input) {
      const parsed = createLinkedBlockInputSchema.parse(input);
      const record = await store.createLinkedBlock(accountId, parsed);
      if (!record) {
        throw new ScreenProjectNotFoundError(parsed.projectId);
      }
      return record;
    },

    async linkedBlocks(accountId, projectId) {
      const parsed = screenProjectInputSchema.parse({ projectId });
      const list = await store.listLinkedBlocks(accountId, parsed.projectId);
      if (!list) {
        throw new ScreenProjectNotFoundError(parsed.projectId);
      }
      return list;
    },

    async saveWireframe(accountId, input) {
      const parsed = saveScreenWireframeInputSchema.parse(input);
      const document = parseWireframeDocument(parsed.document);
      const stored = await store.saveWireframe(
        accountId,
        parsed.projectId,
        parsed.screenId,
        document,
      );
      if (!stored) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return toWireframe(accountId, parsed.screenId, stored);
    },

    async viewport(accountId, input) {
      const parsed = screenViewportInputSchema.parse(input);
      const found = await store.findViewport(
        accountId,
        parsed.projectId,
        parsed.screenId,
      );
      if (!found) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return found;
    },

    async saveViewport(accountId, input) {
      const parsed = saveScreenViewportInputSchema.parse(input);
      const saved = await store.saveViewport(
        accountId,
        parsed.projectId,
        parsed.screenId,
        parsed.viewport,
      );
      if (!saved) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return saved;
    },

    async wireframe(accountId, input) {
      const parsed = screenWireframeInputSchema.parse(input);
      const stored = await store.findWireframe(
        accountId,
        parsed.projectId,
        parsed.screenId,
        parsed.version,
      );
      if (!stored) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return toWireframe(accountId, parsed.screenId, stored);
    },

    async attachWireframeVersion(accountId, projectId, screenId, document) {
      const parsed = resolveScreenInputSchema.parse({ projectId, screenId });
      // A saved version keeps the then-visible live text, not a live alias.
      let frozen: WireframeDocument | undefined;
      if (document !== undefined) {
        const parsedDocument = parseWireframeDocument(document);
        frozen = freezeLiveText(
          parsedDocument,
          await lookupFor(accountId, parsedDocument),
        );
      }
      const record = await store.attachWireframeVersion(
        accountId,
        parsed.projectId,
        parsed.screenId,
        frozen,
      );
      if (!record) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return record;
    },

    async create(accountId, input) {
      const parsed = createScreenInputSchema.parse(input);
      const record = await store.create(accountId, parsed);
      if (!record) {
        throw new ScreenProjectNotFoundError(parsed.projectId);
      }
      return record;
    },

    async list(accountId, projectId) {
      const parsed = screenProjectInputSchema.parse({ projectId });
      const list = await store.list(accountId, parsed.projectId);
      if (!list) {
        throw new ScreenProjectNotFoundError(parsed.projectId);
      }
      return list;
    },

    async resolveTarget(accountId, input) {
      const parsed = resolveScreenInputSchema.parse(input);
      const record = await store.find(
        accountId,
        parsed.projectId,
        parsed.screenId,
      );
      return resolveScreenTarget(parsed.screenId, record);
    },

    async setLifecycle(accountId, input) {
      const parsed = setScreenLifecycleInputSchema.parse(input);
      const record = await store.setLifecycle(accountId, parsed);
      if (!record) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return record;
    },
  };
}
