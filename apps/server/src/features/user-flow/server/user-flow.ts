import {
  buildUserFlowBindView,
  buildUserFlowConvertPlan,
  buildUserFlowRebindPlan,
  buildUserFlowTemplateStructure,
  buildUserFlowView,
  convertUserFlowNodeInputSchema,
  createUserFlowFromTemplateInputSchema,
  createUserFlowInputSchema,
  instantiateUserFlowTemplate,
  isSameUserFlowPlan,
  liveCollapsedSections,
  type ParsedUserFlowDocumentInput,
  placeUserFlowCardInputSchema,
  placeUserFlowNodeInputSchema,
  previewConvertUserFlowNodeInputSchema,
  previewRebindUserFlowBindInputSchema,
  promoteUserFlowNodeInputSchema,
  type RecordLookup,
  type RecordLookupKind,
  rebindUserFlowBindInputSchema,
  recordLookupKey,
  type ScreenLookup,
  saveUserFlowTemplateInputSchema,
  saveUserFlowVersionInputSchema,
  saveUserFlowViewportInputSchema,
  USER_FLOW_LINK_LIMIT,
  USER_FLOW_VISIBLE_ITEM_LIMIT,
  type UserFlowAccess,
  type UserFlowBindRecord,
  type UserFlowDocument,
  type UserFlowRecord,
  type UserFlowStore,
  userFlowInputSchema,
  userFlowProjectInputSchema,
} from "@cantiara/api/user-flow";

export class UserFlowProjectNotFoundError extends Error {
  readonly code = "USER_FLOW_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "UserFlowProjectNotFoundError";
  }
}

export class UserFlowNotFoundError extends Error {
  readonly code = "USER_FLOW_NOT_FOUND" as const;

  constructor(userFlowId: string) {
    super(`User Flow ${userFlowId} was not found.`);
    this.name = "UserFlowNotFoundError";
  }
}

export class UserFlowVersionConflictError extends Error {
  readonly code = "USER_FLOW_VERSION_CONFLICT" as const;

  constructor(userFlowId: string) {
    super(`User Flow ${userFlowId} changed since it was loaded.`);
    this.name = "UserFlowVersionConflictError";
  }
}

export class UserFlowProjectReadOnlyError extends Error {
  readonly code = "USER_FLOW_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "UserFlowProjectReadOnlyError";
  }
}

/** A newly referenced Screen must be an active Screen of the same Project. */
export class UserFlowScreenUnavailableError extends Error {
  readonly code = "USER_FLOW_SCREEN_UNAVAILABLE" as const;

  constructor() {
    super("The Screen is not an active Screen of this Project.");
    this.name = "UserFlowScreenUnavailableError";
  }
}

export class UserFlowNodeNotFoundError extends Error {
  readonly code = "USER_FLOW_NODE_NOT_FOUND" as const;

  constructor(nodeId: string) {
    super(`Node ${nodeId} is not in the current version of this User Flow.`);
    this.name = "UserFlowNodeNotFoundError";
  }
}

/** A confirmed `Convert and Bind` plan no longer matches the current version. */
export class UserFlowConversionStaleError extends Error {
  readonly code = "USER_FLOW_CONVERSION_STALE" as const;

  constructor(userFlowId: string) {
    super(`The Convert and Bind preview of User Flow ${userFlowId} is stale.`);
    this.name = "UserFlowConversionStaleError";
  }
}

export class UserFlowBindNotFoundError extends Error {
  readonly code = "USER_FLOW_BIND_NOT_FOUND" as const;

  constructor(bindId: string) {
    super(`Bind ${bindId} was not found.`);
    this.name = "UserFlowBindNotFoundError";
  }
}

/** The bind is already on the current version, or its node left it. */
export class UserFlowRebindNotNeededError extends Error {
  readonly code = "USER_FLOW_REBIND_NOT_NEEDED" as const;

  constructor(bindId: string) {
    super(`Bind ${bindId} has nothing to rebind.`);
    this.name = "UserFlowRebindNotNeededError";
  }
}

export class UserFlowRebindStaleError extends Error {
  readonly code = "USER_FLOW_REBIND_STALE" as const;

  constructor(bindId: string) {
    super(`The Rebind preview of bind ${bindId} is stale.`);
    this.name = "UserFlowRebindStaleError";
  }
}

/** Only a step without a live Screen reference can be promoted to a Screen. */
export class UserFlowNodeNotPromotableError extends Error {
  readonly code = "USER_FLOW_NODE_NOT_PROMOTABLE" as const;

  constructor(nodeId: string) {
    super(`Node ${nodeId} already references a Screen.`);
    this.name = "UserFlowNodeNotPromotableError";
  }
}

/** The 500 visible item / 750 link hard scene is the most a document holds. */
export class UserFlowSceneLimitError extends Error {
  readonly code = "USER_FLOW_SCENE_LIMIT" as const;

  constructor() {
    super(
      `A User Flow holds at most ${USER_FLOW_VISIBLE_ITEM_LIMIT} visible items and ${USER_FLOW_LINK_LIMIT} links.`,
    );
    this.name = "UserFlowSceneLimitError";
  }
}

export class UserFlowTemplateNotFoundError extends Error {
  readonly code = "USER_FLOW_TEMPLATE_NOT_FOUND" as const;

  constructor(templateId: string) {
    super(`User Flow template ${templateId} was not found.`);
    this.name = "UserFlowTemplateNotFoundError";
  }
}

/** A newly placed card must show an active record of the same Project. */
export class UserFlowRecordUnavailableError extends Error {
  readonly code = "USER_FLOW_RECORD_UNAVAILABLE" as const;

  constructor() {
    super(
      "The record is not an active Work, Decision or Risk of this Project.",
    );
    this.name = "UserFlowRecordUnavailableError";
  }
}

export interface UserFlowOptions {
  generateId?: () => string;
  now?: () => Date;
}

function isActiveScreenOf(projectId: string, lookup: ScreenLookup | undefined) {
  return (
    lookup?.kind === "found" &&
    lookup.projectId === projectId &&
    !(lookup.archivedAt || lookup.trashedAt || lookup.redactedAt)
  );
}

/**
 * User Flow seam. A Screen node holds a live Screen id and flow-local text;
 * every read resolves that id through the common broken-reference presentation
 * and never retargets it. Inputs are strict, so a node cannot carry a copied
 * Screen title or body, an extra semantic type, or a Screen id on a non-Screen
 * node.
 */
export function createUserFlow(
  store: UserFlowStore,
  options: UserFlowOptions = {},
): UserFlowAccess {
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  async function view(accountId: string, record: UserFlowRecord) {
    const screenIds = [
      ...new Set(
        record.document.nodes.flatMap(({ screenId }) =>
          screenId ? [screenId] : [],
        ),
      ),
    ];
    const lookups =
      screenIds.length === 0
        ? new Map<string, ScreenLookup>()
        : await store.lookupScreens(accountId, screenIds);
    const cards = record.document.cards ?? [];
    const recordLookups =
      cards.length === 0
        ? new Map<string, RecordLookup>()
        : await store.lookupRecords(
            accountId,
            cards.map(({ kind, recordId }) => ({ id: recordId, kind })),
          );
    return buildUserFlowView(record, lookups, recordLookups);
  }

  async function bindViews(
    accountId: string,
    current: UserFlowRecord,
    binds: UserFlowBindRecord[],
  ) {
    const documents = new Map<number, UserFlowDocument | null>();
    async function documentAt(version: number) {
      if (version === current.version) {
        return current.document;
      }
      if (!documents.has(version)) {
        documents.set(
          version,
          await store.findVersion(
            accountId,
            current.projectId,
            current.id,
            version,
          ),
        );
      }
      return documents.get(version) ?? null;
    }
    const lookups =
      binds.length === 0
        ? new Map<string, RecordLookup>()
        : await store.lookupRecords(
            accountId,
            binds.map(({ recordId, recordType }) => ({
              id: recordId,
              kind: recordType,
            })),
          );
    return await Promise.all(
      binds.map(async (bind) =>
        buildUserFlowBindView({
          bind,
          boundDocument: await documentAt(bind.boundVersion),
          current,
          lookup: lookups.get(recordLookupKey(bind.recordType, bind.recordId)),
          originDocument: await documentAt(bind.originVersion),
        }),
      ),
    );
  }

  async function requireActiveRecord(
    accountId: string,
    projectId: string,
    cards: Array<{ kind: RecordLookupKind; recordId: string }>,
  ) {
    if (cards.length === 0) {
      return;
    }
    const lookups = await store.lookupRecords(
      accountId,
      cards.map(({ kind, recordId }) => ({ id: recordId, kind })),
    );
    for (const { kind, recordId } of cards) {
      const lookup = lookups.get(recordLookupKey(kind, recordId));
      if (
        !(
          lookup?.kind === "found" &&
          lookup.projectId === projectId &&
          !lookup.archived &&
          !lookup.trashed
        )
      ) {
        throw new UserFlowRecordUnavailableError();
      }
    }
  }

  /**
   * Stored form of an input document. An unchanged live reference keeps the
   * time it was established; a new or repointed one is stamped now, and must
   * resolve to an active Screen of the Project.
   */
  async function toStoredDocument(
    accountId: string,
    projectId: string,
    previous: UserFlowDocument,
    input: ParsedUserFlowDocumentInput,
  ): Promise<UserFlowDocument> {
    const before = new Map(previous.nodes.map((node) => [node.id, node]));
    const placedAt = now().toISOString();
    // An unlinked Screen node is only the placeholder a template instance
    // started with; it cannot be introduced or retyped by a save.
    for (const node of input.nodes) {
      const existing = before.get(node.id);
      if (
        node.kind === "Screen" &&
        node.screenId === null &&
        !(existing?.kind === "Screen" && existing.screenId === null)
      ) {
        throw new UserFlowScreenUnavailableError();
      }
    }
    const fresh = input.nodes.flatMap((node) =>
      node.screenId && before.get(node.id)?.screenId !== node.screenId
        ? [node.screenId]
        : [],
    );
    const cardsBefore = new Map(
      (previous.cards ?? []).map((card) => [card.id, card]),
    );
    const requestedCards = input.cards ?? previous.cards ?? [];
    await requireActiveRecord(
      accountId,
      projectId,
      requestedCards.filter((card) => {
        const existing = cardsBefore.get(card.id);
        return !(
          existing?.kind === card.kind && existing.recordId === card.recordId
        );
      }),
    );
    if (fresh.length > 0) {
      const lookups = await store.lookupScreens(accountId, [...new Set(fresh)]);
      if (!fresh.every((id) => isActiveScreenOf(projectId, lookups.get(id)))) {
        throw new UserFlowScreenUnavailableError();
      }
    }
    return {
      cards: requestedCards.map((card) => {
        const existing = cardsBefore.get(card.id);
        const unchanged =
          existing?.kind === card.kind && existing.recordId === card.recordId;
        return {
          id: card.id,
          kind: card.kind,
          placedAt: unchanged ? existing.placedAt : placedAt,
          position: card.position,
          recordId: card.recordId,
        };
      }),
      links: input.links,
      nodes: input.nodes.map((node) => {
        const existing = before.get(node.id);
        const unchanged =
          existing !== undefined && existing.screenId === node.screenId;
        return {
          id: node.id,
          kind: node.kind,
          placedAt: unchanged ? existing.placedAt : placedAt,
          position: node.position,
          screenId: node.screenId,
          sectionId: node.sectionId ?? null,
          style: node.style,
          text: node.text,
        };
      }),
    };
  }

  async function load(
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) {
    const record = await store.find(accountId, projectId, userFlowId);
    if (!record) {
      throw new UserFlowNotFoundError(userFlowId);
    }
    return record;
  }

  function assertWithinScene(document: UserFlowDocument) {
    if (
      document.nodes.length + (document.cards ?? []).length >
        USER_FLOW_VISIBLE_ITEM_LIMIT ||
      document.links.length > USER_FLOW_LINK_LIMIT
    ) {
      throw new UserFlowSceneLimitError();
    }
  }

  async function appendDocument(
    accountId: string,
    current: UserFlowRecord,
    document: UserFlowDocument,
  ) {
    assertWithinScene(document);
    const saved = await store.appendVersion(accountId, {
      document,
      expectedVersion: current.version,
      projectId: current.projectId,
      userFlowId: current.id,
    });
    if (!saved) {
      throw new UserFlowNotFoundError(current.id);
    }
    return view(accountId, saved);
  }

  async function loadAt(
    accountId: string,
    projectId: string,
    userFlowId: string,
    expectedVersion: number,
  ) {
    const current = await load(accountId, projectId, userFlowId);
    if (current.version !== expectedVersion) {
      throw new UserFlowVersionConflictError(current.id);
    }
    return current;
  }

  return {
    async binds(accountId, projectId, userFlowId) {
      const parsed = userFlowInputSchema.parse({ projectId, userFlowId });
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      const binds = await store.listBinds(
        accountId,
        parsed.projectId,
        current.id,
      );
      return bindViews(accountId, current, binds ?? []);
    },

    async cardRecords(accountId, projectId) {
      const parsed = userFlowProjectInputSchema.parse({ projectId });
      const records = await store.listCardRecords(accountId, parsed.projectId);
      if (!records) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return records;
    },

    async previewConvert(accountId, input) {
      const parsed = previewConvertUserFlowNodeInputSchema.parse(input);
      const source = await store.readConversionSource(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      if (!source) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      const plan = buildUserFlowConvertPlan(source, parsed);
      if (!plan) {
        throw new UserFlowNodeNotFoundError(parsed.nodeId);
      }
      return plan;
    },

    async convertNode(accountId, input) {
      const parsed = convertUserFlowNodeInputSchema.parse(input);
      const { plan } = parsed;
      const source = await store.readConversionSource(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      if (!source) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      // Only the exact previewed plan may be confirmed; a changed flow is refused.
      const current =
        plan.userFlowId === parsed.userFlowId &&
        plan.projectId === parsed.projectId &&
        plan.nodeId === parsed.nodeId
          ? buildUserFlowConvertPlan(source, {
              nodeId: plan.nodeId,
              target: plan.record.type,
              workType: plan.record.workType ?? "Task",
            })
          : null;
      if (!(current && isSameUserFlowPlan(plan, current))) {
        throw new UserFlowConversionStaleError(parsed.userFlowId);
      }
      const bind = await store.convertNode(accountId, parsed);
      if (!bind) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      const [bindView] = await bindViews(accountId, source.record, [bind]);
      if (!bindView) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      return bindView;
    },

    async previewRebind(accountId, input) {
      const parsed = previewRebindUserFlowBindInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      const binds = await store.listBinds(
        accountId,
        parsed.projectId,
        current.id,
      );
      const bind = binds?.find(({ id }) => id === parsed.bindId);
      if (!bind) {
        throw new UserFlowBindNotFoundError(parsed.bindId);
      }
      const plan = buildUserFlowRebindPlan(current, bind);
      if (!plan) {
        throw new UserFlowRebindNotNeededError(bind.id);
      }
      return plan;
    },

    async rebind(accountId, input) {
      const parsed = rebindUserFlowBindInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      const binds = await store.listBinds(
        accountId,
        parsed.projectId,
        current.id,
      );
      const bind = binds?.find(({ id }) => id === parsed.bindId);
      if (!bind) {
        throw new UserFlowBindNotFoundError(parsed.bindId);
      }
      const derived = buildUserFlowRebindPlan(current, bind);
      if (!(derived && isSameUserFlowPlan(parsed.plan, derived))) {
        throw new UserFlowRebindStaleError(bind.id);
      }
      const moved = await store.rebind(accountId, parsed);
      if (!moved) {
        throw new UserFlowBindNotFoundError(bind.id);
      }
      const [bindView] = await bindViews(accountId, current, [moved]);
      if (!bindView) {
        throw new UserFlowBindNotFoundError(bind.id);
      }
      return bindView;
    },

    async promoteToScreen(accountId, input) {
      const parsed = promoteUserFlowNodeInputSchema.parse(input);
      const current = await loadAt(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
        parsed.expectedVersion,
      );
      const node = current.document.nodes.find(
        ({ id }) => id === parsed.nodeId,
      );
      if (!node) {
        throw new UserFlowNodeNotFoundError(parsed.nodeId);
      }
      if (node.screenId !== null) {
        throw new UserFlowNodeNotPromotableError(node.id);
      }
      const { screen } = parsed;
      const screenId =
        screen.mode === "link"
          ? screen.screenId
          : (screen.screenId ?? generateId());
      if (screen.mode === "link") {
        const lookups = await store.lookupScreens(accountId, [screenId]);
        if (!isActiveScreenOf(parsed.projectId, lookups.get(screenId))) {
          throw new UserFlowScreenUnavailableError();
        }
      } else {
        // The single new Screen master; it is never a copy of another Screen.
        const created = await store.createScreen(accountId, {
          id: screenId,
          projectId: parsed.projectId,
          title: screen.title,
        });
        if (!created) {
          throw new UserFlowProjectNotFoundError(parsed.projectId);
        }
      }
      const placedAt = now().toISOString();
      return appendDocument(accountId, current, {
        ...current.document,
        nodes: current.document.nodes.map((item) =>
          item.id === node.id
            ? { ...item, kind: "Screen", placedAt, screenId }
            : item,
        ),
      });
    },

    async placeCard(accountId, input) {
      const parsed = placeUserFlowCardInputSchema.parse(input);
      const current = await loadAt(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
        parsed.expectedVersion,
      );
      await requireActiveRecord(accountId, parsed.projectId, [parsed]);
      return appendDocument(accountId, current, {
        ...current.document,
        cards: [
          ...(current.document.cards ?? []),
          {
            id: generateId(),
            kind: parsed.kind,
            placedAt: now().toISOString(),
            position: parsed.position,
            recordId: parsed.recordId,
          },
        ],
      });
    },

    async saveTemplate(accountId, input) {
      const parsed = saveUserFlowTemplateInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      const known = new Set(current.document.nodes.map(({ id }) => id));
      const missing = parsed.nodeIds.find((id) => !known.has(id));
      if (missing) {
        throw new UserFlowNodeNotFoundError(missing);
      }
      const template = await store.createTemplate(accountId, {
        id: parsed.id ?? generateId(),
        name: parsed.name,
        projectId: parsed.projectId,
        structure: buildUserFlowTemplateStructure(
          current.document,
          parsed.nodeIds,
        ),
      });
      if (!template) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return template;
    },

    async templates(accountId, projectId) {
      const parsed = userFlowProjectInputSchema.parse({ projectId });
      const templates = await store.listTemplates(accountId, parsed.projectId);
      if (!templates) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return templates;
    },

    async createFromTemplate(accountId, input) {
      const parsed = createUserFlowFromTemplateInputSchema.parse(input);
      const template = await store.findTemplate(
        accountId,
        parsed.projectId,
        parsed.templateId,
      );
      if (!template) {
        throw new UserFlowTemplateNotFoundError(parsed.templateId);
      }
      // Fresh ids everywhere; the new flow keeps no id, Project or bind of the source.
      const record = await store.create(accountId, {
        document: instantiateUserFlowTemplate(
          template.structure,
          generateId,
          now().toISOString(),
        ),
        id: parsed.id ?? generateId(),
        projectId: parsed.projectId,
        title: parsed.title,
      });
      if (!record) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return view(accountId, record);
    },

    async create(accountId, input) {
      const parsed = createUserFlowInputSchema.parse(input);
      const record = await store.create(accountId, {
        document: { links: [], nodes: [] },
        id: parsed.id ?? generateId(),
        projectId: parsed.projectId,
        title: parsed.title,
      });
      if (!record) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return view(accountId, record);
    },

    async get(accountId, projectId, userFlowId) {
      const parsed = userFlowInputSchema.parse({ projectId, userFlowId });
      return view(
        accountId,
        await load(accountId, parsed.projectId, parsed.userFlowId),
      );
    },

    async list(accountId, projectId) {
      const parsed = userFlowProjectInputSchema.parse({ projectId });
      const records = await store.list(accountId, parsed.projectId);
      if (!records) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return records.map((record) => ({
        id: record.id,
        projectId: record.projectId,
        title: record.title,
        updatedAt: record.updatedAt,
        version: record.version,
      }));
    },

    async save(accountId, input) {
      const parsed = saveUserFlowVersionInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      if (current.version !== parsed.expectedVersion) {
        throw new UserFlowVersionConflictError(current.id);
      }
      const document = await toStoredDocument(
        accountId,
        parsed.projectId,
        current.document,
        parsed.document,
      );
      const saved = await store.appendVersion(accountId, {
        document,
        expectedVersion: parsed.expectedVersion,
        projectId: parsed.projectId,
        userFlowId: parsed.userFlowId,
      });
      if (!saved) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      return view(accountId, saved);
    },

    async placeNode(accountId, input) {
      const parsed = placeUserFlowNodeInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      if (current.version !== parsed.expectedVersion) {
        throw new UserFlowVersionConflictError(current.id);
      }
      const nodeId = parsed.nodeId ?? generateId();
      const document = await toStoredDocument(
        accountId,
        parsed.projectId,
        current.document,
        {
          links: current.document.links,
          nodes: [
            ...current.document.nodes.map((node) => ({
              ...node,
              sectionId: node.sectionId ?? null,
              style: node.style ?? "default",
            })),
            {
              id: nodeId,
              kind: parsed.kind,
              position: parsed.position,
              screenId: parsed.screenId,
              sectionId: null,
              style: parsed.style,
              text: parsed.text,
            },
          ],
        },
      );
      assertWithinScene(document);
      const saved = await store.appendVersion(accountId, {
        document,
        expectedVersion: parsed.expectedVersion,
        projectId: parsed.projectId,
        userFlowId: parsed.userFlowId,
      });
      if (!saved) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      return view(accountId, saved);
    },

    async viewport(accountId, projectId, userFlowId) {
      const parsed = userFlowInputSchema.parse({ projectId, userFlowId });
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      const saved = await store.findViewport(accountId, current.id);
      return saved
        ? {
            ...saved,
            collapsed: liveCollapsedSections(
              current.document.nodes,
              saved.collapsed,
            ),
          }
        : null;
    },

    async saveViewport(accountId, input) {
      const parsed = saveUserFlowViewportInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      // Personal working position: it writes no version and no Project content.
      const viewport = {
        ...parsed.viewport,
        collapsed: liveCollapsedSections(
          current.document.nodes,
          parsed.viewport.collapsed,
        ),
      };
      await store.saveViewport(accountId, current.id, viewport);
      return viewport;
    },

    async screens(accountId, projectId) {
      const parsed = userFlowProjectInputSchema.parse({ projectId });
      const screens = await store.listScreens(accountId, parsed.projectId);
      if (!screens) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return screens;
    },
  };
}
