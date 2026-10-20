// biome-ignore-all lint/suspicious/useAwait: Store seam methods are async; the memory store resolves synchronously.
import type {
  ProjectWallItemRecord,
  ProjectWallRecord,
  ProjectWallSourceLookup,
  ProjectWallSourceType,
  ProjectWallStore,
} from "@cantiara/api/project-wall";
import { recordLookupKey } from "@cantiara/api/user-flow";

import { ProjectWallProjectReadOnlyError } from "./project-wall";

export interface FakeSourceRecord {
  archived?: boolean;
  id: string;
  ownerAccountId: string;
  projectId: string;
  sourceType: ProjectWallSourceType;
  status: string | null;
  title: string;
  trashed?: boolean;
  values?: Record<string, string | null>;
}

export interface FakeProject {
  archived?: boolean;
  id: string;
  ownerAccountId: string;
}

/**
 * In-memory Project Wall store. Master records live in a separate map the
 * store can only read, because the store interface has no source write; the
 * seam test snapshots them around every wall change.
 */
export function createFakeProjectWallStore(input: {
  projects: FakeProject[];
  sources: FakeSourceRecord[];
}) {
  const sources = new Map(
    input.sources.map((source) => [
      recordLookupKey(source.sourceType, source.id),
      structuredClone(source),
    ]),
  );
  const walls = new Map<string, ProjectWallRecord>();
  let clock = 0;
  const tick = () => {
    clock += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString();
  };

  function ownedProject(accountId: string, projectId: string) {
    const found = input.projects.find(
      (candidate) =>
        candidate.id === projectId && candidate.ownerAccountId === accountId,
    );
    if (found?.archived) {
      throw new ProjectWallProjectReadOnlyError(projectId);
    }
    return found ?? null;
  }

  function ownedWall(accountId: string, projectId: string, wallId: string) {
    const wall = walls.get(wallId);
    if (!(wall && wall.projectId === projectId)) {
      return null;
    }
    return ownedProject(accountId, projectId) ? wall : null;
  }

  function item(wall: { items: ProjectWallItemRecord[] }, cardId: string) {
    return wall.items.find((candidate) => candidate.id === cardId);
  }

  const store: ProjectWallStore = {
    async addCard(accountId, card) {
      const wall = ownedWall(accountId, card.projectId, card.wallId);
      if (!wall) {
        return null;
      }
      const added: ProjectWallItemRecord = {
        density: card.density,
        highlight: null,
        id: card.id,
        placedAt: card.placedAt,
        position: card.position,
        sourceId: card.sourceId,
        sourceType: card.sourceType,
      };
      wall.items.push(added);
      return structuredClone(added);
    },

    async createWall(accountId, wall) {
      if (!ownedProject(accountId, wall.projectId)) {
        return null;
      }
      const stamp = tick();
      const created: ProjectWallRecord = {
        createdAt: stamp,
        id: wall.id,
        items: [],
        projectId: wall.projectId,
        title: wall.title,
        updatedAt: stamp,
      };
      walls.set(created.id, created);
      return structuredClone(created);
    },

    async deleteWall(accountId, projectId, wallId) {
      if (!ownedWall(accountId, projectId, wallId)) {
        return false;
      }
      walls.delete(wallId);
      return true;
    },

    async findWall(accountId, projectId, wallId) {
      const wall = walls.get(wallId);
      if (!(wall && wall.projectId === projectId)) {
        return null;
      }
      const owner = input.projects.find(({ id }) => id === projectId);
      return owner?.ownerAccountId === accountId ? structuredClone(wall) : null;
    },

    async listSourceOptions(accountId, projectId) {
      const owner = input.projects.find(({ id }) => id === projectId);
      if (owner?.ownerAccountId !== accountId) {
        return null;
      }
      return [...sources.values()]
        .filter(
          (source) =>
            source.projectId === projectId &&
            !source.archived &&
            !source.trashed,
        )
        .map(({ id, sourceType, title }) => ({ id, sourceType, title }));
    },

    async listWalls(accountId, projectId) {
      const owner = input.projects.find(({ id }) => id === projectId);
      if (owner?.ownerAccountId !== accountId) {
        return null;
      }
      return [...walls.values()]
        .filter((wall) => wall.projectId === projectId)
        .map((wall) => ({
          cardCount: wall.items.length,
          createdAt: wall.createdAt,
          id: wall.id,
          projectId: wall.projectId,
          title: wall.title,
          updatedAt: wall.updatedAt,
        }));
    },

    async lookupSources(accountId, refs) {
      const lookups = new Map<string, ProjectWallSourceLookup>();
      for (const { id, sourceType } of refs) {
        const key = recordLookupKey(sourceType, id);
        const source = sources.get(key);
        if (!source) {
          continue;
        }
        lookups.set(
          key,
          source.ownerAccountId === accountId
            ? {
                archived: source.archived ?? false,
                kind: "found",
                projectId: source.projectId,
                status: source.status,
                title: source.title,
                trashed: source.trashed ?? false,
                values: { ...source.values },
              }
            : { kind: "inaccessible" },
        );
      }
      return lookups;
    },

    async moveCards(accountId, move) {
      const wall = ownedWall(accountId, move.projectId, move.wallId);
      if (!wall) {
        return false;
      }
      for (const { cardId, position } of move.moves) {
        const card = item(wall, cardId);
        if (card) {
          card.position = position;
        }
      }
      return true;
    },

    async removeCard(accountId, card) {
      const wall = ownedWall(accountId, card.projectId, card.wallId);
      if (!(wall && item(wall, card.cardId))) {
        return false;
      }
      wall.items = wall.items.filter(({ id }) => id !== card.cardId);
      return true;
    },

    async renameWall(accountId, rename) {
      const wall = ownedWall(accountId, rename.projectId, rename.wallId);
      if (!wall) {
        return false;
      }
      wall.title = rename.title;
      return true;
    },

    async setCardDensity(accountId, change) {
      const card = item(
        ownedWall(accountId, change.projectId, change.wallId) ?? {
          items: [],
        },
        change.cardId,
      );
      if (!card) {
        return false;
      }
      card.density = change.density;
      return true;
    },

    async setCardHighlight(accountId, change) {
      const card = item(
        ownedWall(accountId, change.projectId, change.wallId) ?? {
          items: [],
        },
        change.cardId,
      );
      if (!card) {
        return false;
      }
      card.highlight = change.highlight;
      return true;
    },
  };

  return {
    /** A deep snapshot of every master record, to prove a wall change left it untouched. */
    sourceSnapshot: () => structuredClone([...sources.values()]),
    /** Master-record edit by the owning feature, e.g. renaming a Work. */
    editSource(sourceType: ProjectWallSourceType, id: string, title: string) {
      const source = sources.get(recordLookupKey(sourceType, id));
      if (source) {
        source.title = title;
      }
    },
    removeSource(sourceType: ProjectWallSourceType, id: string) {
      sources.delete(recordLookupKey(sourceType, id));
    },
    store,
    wallRows: () => structuredClone([...walls.values()]),
  };
}
