import {
  type AddProjectWallCardInput,
  addProjectWallCardInputSchema,
  buildProjectWallView,
  type CreateProjectWallInput,
  createProjectWallInputSchema,
  type MoveProjectWallCardsInput,
  moveProjectWallCardsInputSchema,
  type ProjectWallAccess,
  type ProjectWallRecord,
  type ProjectWallStore,
  type RemoveProjectWallCardInput,
  type RenameProjectWallInput,
  removeProjectWallCardInputSchema,
  renameProjectWallInputSchema,
  type SetProjectWallCardDensityInput,
  type SetProjectWallCardHighlightInput,
  setProjectWallCardDensityInputSchema,
  setProjectWallCardHighlightInputSchema,
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

export interface ProjectWallOptions {
  generateId?: () => string;
  now?: () => Date;
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
      await requireCard(
        accountId,
        input.projectId,
        input.wallId,
        input.moves.map(({ cardId }) => cardId),
      );
      if (!(await store.moveCards(accountId, input))) {
        throw new ProjectWallNotFoundError(input.wallId);
      }
      return reload(accountId, input.projectId, input.wallId);
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

    async sourceOptions(accountId, projectId) {
      const sources = await store.listSourceOptions(accountId, projectId);
      if (!sources) {
        throw new ProjectWallProjectNotFoundError(projectId);
      }
      return sources;
    },
  };
}
