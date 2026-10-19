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
    return {
      createdAt: stored.createdAt,
      document,
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

  return {
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
