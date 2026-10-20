import {
  type AddProjectWallCardInput,
  addProjectWallCardInputSchema,
  buildProjectWallView,
  type CreateProjectWallFromSkeletonInput,
  type CreateProjectWallGroupInput,
  type CreateProjectWallInput,
  type CreateProjectWallPersistentRelationInput,
  createProjectWallFromSkeletonInputSchema,
  createProjectWallGroupInputSchema,
  createProjectWallInputSchema,
  createProjectWallPersistentRelationInputSchema,
  type DrawProjectWallLinkInput,
  drawProjectWallLinkInputSchema,
  type MoveProjectWallCardsInput,
  moveProjectWallCardsInputSchema,
  type PreviewProjectWallPersistentRelationInput,
  type ProjectWallAccess,
  type ProjectWallGroupInput,
  type ProjectWallRecord,
  type ProjectWallRelations,
  type ProjectWallStore,
  previewProjectWallPersistentRelationInputSchema,
  projectWallCardEndpoint,
  projectWallGroupInputSchema,
  projectWallSkeletonHeadings,
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
import { recordLookupKey } from "@cantiara/api/user-flow";

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
      "The record is not an active Work, Decision or Risk of this Project.",
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

/** A skeleton materializes only when the Project shell selected it. */
export class ProjectWallSkeletonNotSelectedError extends Error {
  readonly code = "PROJECT_WALL_SKELETON_NOT_SELECTED" as const;

  constructor(skeleton: string) {
    super(`${skeleton} is not selected for this Project.`);
    this.name = "ProjectWallSkeletonNotSelectedError";
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

export interface ProjectWallOptions {
  generateId?: () => string;
  now?: () => Date;
  /**
   * The catalog relations seam. The wall never writes a relation itself: it
   * previews and then asks this seam, and only on an explicit confirmation.
   */
  relations?: ProjectWallRelations;
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
  const { relations } = options;

  async function view(accountId: string, record: ProjectWallRecord) {
    const lookups =
      record.items.length === 0
        ? new Map()
        : await store.lookupSources(
            accountId,
            record.items.map(({ sourceId, sourceType }) => ({
              id: sourceId,
              sourceType,
            })),
          );
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
      return projectWallCardEndpoint(card);
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
      const lookups = await store.lookupSources(accountId, [
        { id: input.sourceId, sourceType: input.sourceType },
      ]);
      const lookup = lookups.get(
        recordLookupKey(input.sourceType, input.sourceId),
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

    async createFromSkeleton(
      accountId,
      rawInput: CreateProjectWallFromSkeletonInput,
    ) {
      const input = createProjectWallFromSkeletonInputSchema.parse(rawInput);
      const selected = await store.selectedSkeletons(
        accountId,
        input.projectId,
      );
      if (!selected) {
        throw new ProjectWallProjectNotFoundError(input.projectId);
      }
      if (!selected.includes(input.skeleton)) {
        throw new ProjectWallSkeletonNotSelectedError(input.skeleton);
      }
      // Only the wall and its empty headings: no card, link, task or record.
      const created = await store.createWallWithGroups(accountId, {
        groups: projectWallSkeletonHeadings(input.skeleton).map((title) => ({
          id: generateId(),
          title,
        })),
        id: generateId(),
        projectId: input.projectId,
        title: input.skeleton,
      });
      if (!created) {
        throw new ProjectWallProjectNotFoundError(input.projectId);
      }
      return view(accountId, created);
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

    async skeletons(accountId, projectId) {
      const selected = await store.selectedSkeletons(accountId, projectId);
      if (!selected) {
        throw new ProjectWallProjectNotFoundError(projectId);
      }
      return selected;
    },

    async sourceOptions(accountId, projectId) {
      const sources = await store.listSourceOptions(accountId, projectId);
      if (!sources) {
        throw new ProjectWallProjectNotFoundError(projectId);
      }
      return sources;
    },

    async unbindLink(accountId, rawInput: UnbindProjectWallLinkInput) {
      const input = unbindProjectWallLinkInputSchema.parse(rawInput);
      await requireLink(accountId, input.projectId, input.wallId, input.linkId);
      await store.removeLink(accountId, input);
      return reload(accountId, input.projectId, input.wallId);
    },
  };
}
