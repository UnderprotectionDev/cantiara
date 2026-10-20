import {
  type AddProjectWallCardInput,
  addProjectWallCardInputSchema,
  buildProjectWallView,
  type CreateProjectWallGroupInput,
  type CreateProjectWallInput,
  type CreateProjectWallPersistentRelationInput,
  createProjectWallGroupInputSchema,
  createProjectWallInputSchema,
  createProjectWallPersistentRelationInputSchema,
  type DrawProjectWallLinkInput,
  drawProjectWallLinkInputSchema,
  type MoveProjectWallCardsInput,
  moveProjectWallCardsInputSchema,
  PROJECT_WALL_DIAGRAM_PREVIEW_NODE_LIMIT,
  type PreviewProjectWallPersistentRelationInput,
  type ProjectWallAccess,
  type ProjectWallCollections,
  type ProjectWallDiagrams,
  type ProjectWallGroupInput,
  type ProjectWallItemRecord,
  type ProjectWallRecord,
  type ProjectWallRelations,
  type ProjectWallSourceLookup,
  type ProjectWallSourceOption,
  type ProjectWallStore,
  previewProjectWallPersistentRelationInputSchema,
  projectWallCardEndpoint,
  projectWallExtraSourcePath,
  projectWallGroupInputSchema,
  projectWallLookupKey,
  type RemoveProjectWallCardInput,
  type RenameProjectWallInput,
  removeProjectWallCardInputSchema,
  renameProjectWallInputSchema,
  type SetProjectWallCardDensityInput,
  type SetProjectWallCardGroupInput,
  type SetProjectWallCardHighlightInput,
  type SetProjectWallCardLockInput,
  type SetProjectWallGroupCollapsedInput,
  setProjectWallCardDensityInputSchema,
  setProjectWallCardGroupInputSchema,
  setProjectWallCardHighlightInputSchema,
  setProjectWallCardLockInputSchema,
  setProjectWallGroupCollapsedInputSchema,
  type UnbindProjectWallLinkInput,
  unbindProjectWallLinkInputSchema,
} from "@cantiara/api/project-wall";
import {
  buildProjectWallSnapshotData,
  buildProjectWallSnapshotPreview,
  type ExportProjectWallSnapshotInput,
  exportProjectWallSnapshotInputSchema,
  PROJECT_WALL_SNAPSHOT_CARD_LIMIT,
  type PreviewProjectWallSnapshotInput,
  type ProjectWallSnapshotRenderer,
  previewProjectWallSnapshotInputSchema,
  type SetProjectWallFocusOrderInput,
  setProjectWallFocusOrderInputSchema,
} from "@cantiara/api/project-wall-presentation";

export class ProjectWallProjectNotFoundError extends Error {
  readonly code = "PROJECT_WALL_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ProjectWallProjectNotFoundError";
  }
}

export class ProjectWallNotFoundError extends Error {
  readonly code = "PROJECT_WALL_NOT_FOUND" as const;

  constructor(wallId: string) {
    super(`Project Wall ${wallId} was not found.`);
    this.name = "ProjectWallNotFoundError";
  }
}

export class ProjectWallCardNotFoundError extends Error {
  readonly code = "PROJECT_WALL_CARD_NOT_FOUND" as const;

  constructor(cardId: string) {
    super(`Card ${cardId} is not on this Project Wall.`);
    this.name = "ProjectWallCardNotFoundError";
  }
}

export class ProjectWallProjectReadOnlyError extends Error {
  readonly code = "PROJECT_WALL_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "ProjectWallProjectReadOnlyError";
  }
}

/** A newly placed card must show an active record of the same Project. */
export class ProjectWallSourceUnavailableError extends Error {
  readonly code = "PROJECT_WALL_SOURCE_UNAVAILABLE" as const;

  constructor() {
    super(
      "The record is not an active Work, Decision, Risk, Technical Diagram or Smart Collection of this Project.",
    );
    this.name = "ProjectWallSourceUnavailableError";
  }
}

/** One record is one live card per wall; it may sit on other walls too. */
export class ProjectWallCardDuplicateError extends Error {
  readonly code = "PROJECT_WALL_CARD_DUPLICATE" as const;

  constructor() {
    super("This record is already a card on this Project Wall.");
    this.name = "ProjectWallCardDuplicateError";
  }
}

export class ProjectWallLinkNotFoundError extends Error {
  readonly code = "PROJECT_WALL_LINK_NOT_FOUND" as const;

  constructor(linkId: string) {
    super(`Visual link ${linkId} is not on this Project Wall.`);
    this.name = "ProjectWallLinkNotFoundError";
  }
}

export class ProjectWallGroupNotFoundError extends Error {
  readonly code = "PROJECT_WALL_GROUP_NOT_FOUND" as const;

  constructor(groupId: string) {
    super(`Group ${groupId} is not on this Project Wall.`);
    this.name = "ProjectWallGroupNotFoundError";
  }
}

/** A Visual link becomes a relation only after its current preview. */
export class ProjectWallRelationPreviewRequiredError extends Error {
  readonly code = "PROJECT_WALL_RELATION_PREVIEW_REQUIRED" as const;

  constructor() {
    super("Review the current relation preview before confirming.");
    this.name = "ProjectWallRelationPreviewRequiredError";
  }
}

/** A Smart Collection block summarizes records; it is not a relation endpoint. */
export class ProjectWallRelationUnavailableError extends Error {
  readonly code = "PROJECT_WALL_RELATION_UNAVAILABLE" as const;

  constructor() {
    super("A Smart Collection block cannot be a relation endpoint.");
    this.name = "ProjectWallRelationUnavailableError";
  }
}

/** A snapshot cannot be taken: nothing selected, too large, or no renderer. */
export class ProjectWallSnapshotError extends Error {
  readonly code = "PROJECT_WALL_SNAPSHOT_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProjectWallSnapshotError";
  }
}

function slug(value: string) {
  const text = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return text === "" ? "project-wall" : text.slice(0, 40);
}

export interface ProjectWallOptions {
  /**
   * Read-only Smart Collections seam. The wall reads the collection's own
   * result and keeps no query or membership of its own.
   */
  collections?: ProjectWallCollections;
  /** Read-only Technical Diagrams seam: a card previews, never edits. */
  diagrams?: ProjectWallDiagrams;
  generateId?: () => string;
  now?: () => Date;
  /**
   * The catalog relations seam. The wall never writes a relation itself: it
   * previews and then asks this seam, and only on an explicit confirmation.
   */
  relations?: ProjectWallRelations;
  /** Static PNG/PDF renderer of the internal `Frozen copy` snapshot. */
  renderer?: ProjectWallSnapshotRenderer;
}

/**
 * Project Wall seam. Walls are flat and Project-scoped. A card holds only the
 * source id and wall view state; every read resolves the source live, so the
 * wall can never carry a copied title, note, task or file. Layout, density and
 * highlight go through wall-only store methods and never touch a source.
 */
export function createProjectWall(
  store: ProjectWallStore,
  options: ProjectWallOptions = {},
): ProjectWallAccess {
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const { collections, diagrams, relations, renderer } = options;

  async function lookupDiagram(
    accountId: string,
    ref: Pick<ProjectWallItemRecord, "diagramViewId" | "sourceId">,
  ): Promise<ProjectWallSourceLookup | null> {
    const diagram = await diagrams?.get(
      accountId,
      ref.sourceId,
      ref.diagramViewId ?? undefined,
    );
    if (!diagram) {
      return null;
    }
    const selected = diagram.view?.selectedNodeIds ?? [];
    const nodes = (
      selected.length > 0
        ? diagram.model.nodes.filter(({ id }) => selected.includes(id))
        : diagram.model.nodes
    ).slice(0, PROJECT_WALL_DIAGRAM_PREVIEW_NODE_LIMIT);
    const shown = new Set(nodes.map(({ id }) => id));
    return {
      archived: false,
      kind: "found",
      preview: {
        diagramType: diagram.type,
        kind: "Technical Diagram",
        links: diagram.model.links.filter(
          (link) => shown.has(link.from) && shown.has(link.to),
        ),
        nodes,
        pin: "Live",
        viewName: diagram.view?.name ?? null,
      },
      projectId: diagram.projectId,
      status: null,
      title: diagram.title,
      values: {},
    };
  }

  async function lookupCollection(
    accountId: string,
    ref: Pick<ProjectWallItemRecord, "sourceId">,
  ): Promise<ProjectWallSourceLookup | null> {
    // Read-only: the result and its membership are the collection's own.
    const collection = await collections?.getView(accountId, ref.sourceId, {
      readOnly: true,
    });
    if (!collection) {
      return null;
    }
    const records = [
      ...collection.works.map((entry) => ({
        id: entry.id,
        recordType: "Work",
        status: entry.status,
        title: entry.title,
      })),
      ...collection.projectSourceRecords.map((entry) => ({
        id: entry.id,
        recordType: entry.sourceType as string,
        status: entry.status,
        title: entry.title,
      })),
      ...collection.documents.map((entry) => ({
        id: entry.id,
        recordType: "Document",
        status: null,
        title: entry.title,
      })),
    ];
    return {
      archived: false,
      kind: "found",
      preview: {
        collectionName: collection.collectionName,
        kind: "Smart Collection",
        openAllPath: projectWallExtraSourcePath(
          collection.projectId,
          "Smart Collection",
          ref.sourceId,
        ),
        records,
        total: records.length,
      },
      projectId: collection.projectId,
      status: null,
      title: collection.collectionName,
      values: {},
    };
  }

  /**
   * Resolves every card source live. Work, Decision and Risk come from the
   * wall store's read-only lookup; a diagram and a collection are read through
   * their own feature's read seam, so the wall owns no diagram model, no
   * collection query and no membership.
   */
  async function lookupSources(
    accountId: string,
    refs: Pick<
      ProjectWallItemRecord,
      "diagramViewId" | "sourceId" | "sourceType"
    >[],
  ) {
    const lookups = new Map<string, ProjectWallSourceLookup>();
    const records = refs.flatMap(({ sourceId, sourceType }) =>
      sourceType === "Technical Diagram" || sourceType === "Smart Collection"
        ? []
        : [{ id: sourceId, sourceType }],
    );
    if (records.length > 0) {
      for (const [key, value] of await store.lookupSources(
        accountId,
        records,
      )) {
        lookups.set(key, value);
      }
    }
    await Promise.all(
      refs.map(async (ref) => {
        let found: ProjectWallSourceLookup | null = null;
        if (ref.sourceType === "Technical Diagram") {
          found = await lookupDiagram(accountId, ref);
        } else if (ref.sourceType === "Smart Collection") {
          found = await lookupCollection(accountId, ref);
        }
        if (found) {
          lookups.set(
            projectWallLookupKey(ref.sourceType, ref.sourceId),
            found,
          );
        }
      }),
    );
    return lookups;
  }

  async function view(accountId: string, record: ProjectWallRecord) {
    const lookups =
      record.items.length === 0
        ? new Map()
        : await lookupSources(accountId, record.items);
    return buildProjectWallView(record, lookups);
  }

  async function load(accountId: string, projectId: string, wallId: string) {
    const record = await store.findWall(accountId, projectId, wallId);
    if (!record) {
      throw new ProjectWallNotFoundError(wallId);
    }
    return record;
  }

  async function reload(accountId: string, projectId: string, wallId: string) {
    return view(accountId, await load(accountId, projectId, wallId));
  }

  async function requireCard(
    accountId: string,
    projectId: string,
    wallId: string,
    cardIds: string[],
  ) {
    const wall = await load(accountId, projectId, wallId);
    const known = new Set(wall.items.map(({ id }) => id));
    for (const cardId of cardIds) {
      if (!known.has(cardId)) {
        throw new ProjectWallCardNotFoundError(cardId);
      }
    }
    return wall;
  }

  async function requireLink(
    accountId: string,
    projectId: string,
    wallId: string,
    linkId: string,
  ) {
    const wall = await load(accountId, projectId, wallId);
    const link = wall.links.find(({ id }) => id === linkId);
    if (!link) {
      throw new ProjectWallLinkNotFoundError(linkId);
    }
    return { link, wall };
  }

  async function requireGroup(
    accountId: string,
    projectId: string,
    wallId: string,
    groupId: string,
  ) {
    const wall = await load(accountId, projectId, wallId);
    if (!wall.groups.some(({ id }) => id === groupId)) {
      throw new ProjectWallGroupNotFoundError(groupId);
    }
    return wall;
  }

  /** From -> source, To -> target: the line direction is the relation direction. */
  async function previewLinkRelation(
    accountId: string,
    input: PreviewProjectWallPersistentRelationInput,
  ) {
    if (!relations) {
      throw new Error("Project Wall has no relations seam configured.");
    }
    const { link, wall } = await requireLink(
      accountId,
      input.projectId,
      input.wallId,
      input.linkId,
    );
    const endpoint = (cardId: string) => {
      const card = wall.items.find(({ id }) => id === cardId);
      if (!card) {
        throw new ProjectWallCardNotFoundError(cardId);
      }
      const endpointOfCard = projectWallCardEndpoint(card);
      if (!endpointOfCard) {
        throw new ProjectWallRelationUnavailableError();
      }
      return endpointOfCard;
    };
    const source = endpoint(link.fromCardId);
    const target = endpoint(link.toCardId);
    const relation = await relations.previewCreate(accountId, {
      kind: input.kind,
      source,
      target,
    });
    return { link, relation, relations, source, target };
  }

  async function diagramOptions(accountId: string, projectId: string) {
    const listed = (await diagrams?.list(accountId, projectId)) ?? [];
    const perDiagram = await Promise.all(
      listed.map(async (diagram) => {
        const views = (await diagrams?.listViews(accountId, diagram.id)) ?? [];
        if (views.length === 0) {
          return [
            {
              id: diagram.id,
              sourceType: "Technical Diagram",
              title: diagram.title,
            },
          ] satisfies ProjectWallSourceOption[];
        }
        return views.map(
          (diagramView): ProjectWallSourceOption => ({
            diagramViewId: diagramView.id,
            id: diagram.id,
            sourceType: "Technical Diagram",
            title: `${diagram.title} · ${diagramView.name}`,
          }),
        );
      }),
    );
    return perDiagram.flat();
  }

  async function collectionOptions(accountId: string, projectId: string) {
    const views = (await collections?.listViews(accountId, projectId)) ?? [];
    return views.map(
      (collection): ProjectWallSourceOption => ({
        id: collection.id,
        sourceType: "Smart Collection",
        title:
          collection.name === collection.collectionName
            ? collection.collectionName
            : `${collection.collectionName} · ${collection.name}`,
      }),
    );
  }

  /**
   * Reads the live wall once and freezes the selected group or region into
   * plain data. It never writes: no lock, no share grant, no wall change.
   */
  async function freeze(
    accountId: string,
    input: PreviewProjectWallSnapshotInput,
  ) {
    const wall = await reload(accountId, input.projectId, input.wallId);
    let { cards } = wall;
    let scopeLabel: string;
    let scope: "group" | "region";
    if (input.groupId === undefined) {
      const known = new Set(wall.cards.map(({ id }) => id));
      for (const cardId of input.cardIds ?? []) {
        if (!known.has(cardId)) {
          throw new ProjectWallCardNotFoundError(cardId);
        }
      }
      const selected = new Set(input.cardIds);
      cards = wall.cards.filter(({ id }) => selected.has(id));
      scope = "region";
      scopeLabel = `Region of ${cards.length} card${cards.length === 1 ? "" : "s"}`;
    } else {
      const group = wall.groups.find(({ id }) => id === input.groupId);
      if (!group) {
        throw new ProjectWallGroupNotFoundError(input.groupId);
      }
      cards = wall.cards.filter(({ groupId }) => groupId === group.id);
      scope = "group";
      scopeLabel = `Group: ${group.title}`;
    }
    if (cards.length === 0) {
      throw new ProjectWallSnapshotError("Select at least one card.");
    }
    if (cards.length > PROJECT_WALL_SNAPSHOT_CARD_LIMIT) {
      throw new ProjectWallSnapshotError(
        `Select at most ${PROJECT_WALL_SNAPSHOT_CARD_LIMIT} cards per snapshot.`,
      );
    }
    return {
      data: buildProjectWallSnapshotData(wall, cards, scopeLabel, now()),
      scope,
      wallTitle: wall.title,
    };
  }

  return {
    async addCard(accountId, rawInput: AddProjectWallCardInput) {
      const input = addProjectWallCardInputSchema.parse(rawInput);
      const wall = await load(accountId, input.projectId, input.wallId);
      if (
        wall.items.some(
          (item) =>
            item.sourceType === input.sourceType &&
            item.sourceId === input.sourceId,
        )
      ) {
        throw new ProjectWallCardDuplicateError();
      }
      const lookups = await lookupSources(accountId, [
        {
          diagramViewId: input.diagramViewId ?? null,
          sourceId: input.sourceId,
          sourceType: input.sourceType,
        },
      ]);
      const lookup = lookups.get(
        projectWallLookupKey(input.sourceType, input.sourceId),
      );
      if (
        !(
          lookup?.kind === "found" &&
          lookup.projectId === input.projectId &&
          !lookup.archived &&
          !lookup.trashed
        )
      ) {
        throw new ProjectWallSourceUnavailableError();
      }
      const added = await store.addCard(accountId, {
        density: input.density,
        diagramViewId: input.diagramViewId ?? null,
        id: generateId(),
        placedAt: now().toISOString(),
        position: input.position,
        projectId: input.projectId,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        wallId: input.wallId,
      });
      if (!added) {
        throw new ProjectWallNotFoundError(input.wallId);
      }
      return reload(accountId, input.projectId, input.wallId);
    },

    async createGroup(accountId, rawInput: CreateProjectWallGroupInput) {
      const input = createProjectWallGroupInputSchema.parse(rawInput);
      const created = await store.createGroup(accountId, {
        id: generateId(),
        projectId: input.projectId,
        title: input.title,
        wallId: input.wallId,
      });
      if (!created) {
        throw new ProjectWallNotFoundError(input.wallId);
      }
      return reload(accountId, input.projectId, input.wallId);
    },

    async createPersistentRelation(
      accountId,
      rawInput: CreateProjectWallPersistentRelationInput,
    ) {
      const input =
        createProjectWallPersistentRelationInputSchema.parse(rawInput);
      // Recompute the preview from the live link and cards: a stale, foreign
      // or missing preview id never reaches the relations write.
      const preview = await previewLinkRelation(accountId, input);
      if (preview.relation.previewId !== input.previewId) {
        throw new ProjectWallRelationPreviewRequiredError();
      }
      return preview.relations.create(accountId, {
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: input.kind,
        previewId: input.previewId,
        source: preview.source,
        target: preview.target,
      });
    },

    async create(accountId, rawInput: CreateProjectWallInput) {
      const input = createProjectWallInputSchema.parse(rawInput);
      const created = await store.createWall(accountId, {
        id: generateId(),
        projectId: input.projectId,
        title: input.title,
      });
      if (!created) {
        throw new ProjectWallProjectNotFoundError(input.projectId);
      }
      return view(accountId, created);
    },

    async deleteGroup(accountId, rawInput: ProjectWallGroupInput) {
      const input = projectWallGroupInputSchema.parse(rawInput);
      await requireGroup(
        accountId,
        input.projectId,
        input.wallId,
        input.groupId,
      );
      await store.deleteGroup(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },

    async drawLink(accountId, rawInput: DrawProjectWallLinkInput) {
      const input = drawProjectWallLinkInputSchema.parse(rawInput);
      await requireCard(accountId, input.projectId, input.wallId, [
        input.fromCardId,
        input.toCardId,
      ]);
      // Wall view state only: no relation row is written for a Visual link.
      const added = await store.addLink(accountId, {
        fromCardId: input.fromCardId,
        id: generateId(),
        label: input.label,
        projectId: input.projectId,
        toCardId: input.toCardId,
        wallId: input.wallId,
      });
      if (!added) {
        throw new ProjectWallNotFoundError(input.wallId);
      }
      return reload(accountId, input.projectId, input.wallId);
    },

    async delete(accountId, projectId, wallId) {
      if (!(await store.deleteWall(accountId, projectId, wallId))) {
        throw new ProjectWallNotFoundError(wallId);
      }
    },

    get(accountId, projectId, wallId) {
      return reload(accountId, projectId, wallId);
    },

    async list(accountId, projectId) {
      const walls = await store.listWalls(accountId, projectId);
      if (!walls) {
        throw new ProjectWallProjectNotFoundError(projectId);
      }
      return walls;
    },

    async moveCards(accountId, rawInput: MoveProjectWallCardsInput) {
      const input = moveProjectWallCardsInputSchema.parse(rawInput);
      const wall = await requireCard(
        accountId,
        input.projectId,
        input.wallId,
        input.moves.map(({ cardId }) => cardId),
      );
      // `Lock Position` fixes a card in manual drag; the rest of a
      // multi-select still moves.
      const locked = new Set(
        wall.items.filter((item) => item.locked).map(({ id }) => id),
      );
      const moves = input.moves.filter(({ cardId }) => !locked.has(cardId));
      if (moves.length === 0) {
        return view(accountId, wall);
      }
      if (!(await store.moveCards(accountId, { ...input, moves }))) {
        throw new ProjectWallNotFoundError(input.wallId);
      }
      return reload(accountId, input.projectId, input.wallId);
    },

    async previewPersistentRelation(
      accountId,
      rawInput: PreviewProjectWallPersistentRelationInput,
    ) {
      const input =
        previewProjectWallPersistentRelationInputSchema.parse(rawInput);
      const { link, relation } = await previewLinkRelation(accountId, input);
      return { linkId: link.id, relation };
    },

    async removeCard(accountId, rawInput: RemoveProjectWallCardInput) {
      const input = removeProjectWallCardInputSchema.parse(rawInput);
      await requireCard(accountId, input.projectId, input.wallId, [
        input.cardId,
      ]);
      await store.removeCard(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },

    async rename(accountId, rawInput: RenameProjectWallInput) {
      const input = renameProjectWallInputSchema.parse(rawInput);
      if (!(await store.renameWall(accountId, input))) {
        throw new ProjectWallNotFoundError(input.wallId);
      }
      return reload(accountId, input.projectId, input.wallId);
    },

    async setCardDensity(accountId, rawInput: SetProjectWallCardDensityInput) {
      const input = setProjectWallCardDensityInputSchema.parse(rawInput);
      await requireCard(accountId, input.projectId, input.wallId, [
        input.cardId,
      ]);
      await store.setCardDensity(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },

    async setCardGroup(accountId, rawInput: SetProjectWallCardGroupInput) {
      const input = setProjectWallCardGroupInputSchema.parse(rawInput);
      await requireCard(accountId, input.projectId, input.wallId, [
        input.cardId,
      ]);
      if (input.groupId !== null) {
        await requireGroup(
          accountId,
          input.projectId,
          input.wallId,
          input.groupId,
        );
      }
      await store.setCardGroup(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },

    async setCardHighlight(
      accountId,
      rawInput: SetProjectWallCardHighlightInput,
    ) {
      const input = setProjectWallCardHighlightInputSchema.parse(rawInput);
      await requireCard(accountId, input.projectId, input.wallId, [
        input.cardId,
      ]);
      await store.setCardHighlight(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },

    async setCardLock(accountId, rawInput: SetProjectWallCardLockInput) {
      const input = setProjectWallCardLockInputSchema.parse(rawInput);
      await requireCard(accountId, input.projectId, input.wallId, [
        input.cardId,
      ]);
      await store.setCardLocked(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },

    async setGroupCollapsed(
      accountId,
      rawInput: SetProjectWallGroupCollapsedInput,
    ) {
      const input = setProjectWallGroupCollapsedInputSchema.parse(rawInput);
      await requireGroup(
        accountId,
        input.projectId,
        input.wallId,
        input.groupId,
      );
      await store.setGroupCollapsed(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },

    async sourceOptions(accountId, projectId) {
      const sources = await store.listSourceOptions(accountId, projectId);
      if (!sources) {
        throw new ProjectWallProjectNotFoundError(projectId);
      }
      return [
        ...sources,
        ...(await diagramOptions(accountId, projectId)),
        ...(await collectionOptions(accountId, projectId)),
      ];
    },

    async setFocusOrder(accountId, rawInput: SetProjectWallFocusOrderInput) {
      const input = setProjectWallFocusOrderInputSchema.parse(rawInput);
      // View metadata only: it lists existing cards and copies no content.
      await requireCard(
        accountId,
        input.projectId,
        input.wallId,
        input.cardIds,
      );
      if (!(await store.setFocusOrder(accountId, input))) {
        throw new ProjectWallNotFoundError(input.wallId);
      }
      return reload(accountId, input.projectId, input.wallId);
    },

    async previewSnapshot(
      accountId,
      rawInput: PreviewProjectWallSnapshotInput,
    ) {
      const input = previewProjectWallSnapshotInputSchema.parse(rawInput);
      const { data, scope } = await freeze(accountId, input);
      return buildProjectWallSnapshotPreview(data, scope);
    },

    async exportSnapshot(accountId, rawInput: ExportProjectWallSnapshotInput) {
      const input = exportProjectWallSnapshotInputSchema.parse(rawInput);
      if (!renderer) {
        throw new ProjectWallSnapshotError("Snapshot export is unavailable.");
      }
      const { data, scope, wallTitle } = await freeze(accountId, input);
      const preview = buildProjectWallSnapshotPreview(data, scope);
      const stem = `${slug(wallTitle)}-${data.generatedOn}-snapshot`;
      const png = input.format === "PNG";
      const bytes = png ? await renderer.png(data) : await renderer.pdf(data);
      return {
        files: [
          {
            base64: Buffer.from(bytes).toString("base64"),
            fileName: `${stem}.${png ? "png" : "pdf"}`,
            mimeType: png
              ? ("image/png" as const)
              : ("application/pdf" as const),
          },
        ],
        format: input.format,
        generatedAt: data.generatedAt,
        preview,
      };
    },

    async unbindLink(accountId, rawInput: UnbindProjectWallLinkInput) {
      const input = unbindProjectWallLinkInputSchema.parse(rawInput);
      await requireLink(accountId, input.projectId, input.wallId, input.linkId);
      await store.removeLink(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },
  };
}
