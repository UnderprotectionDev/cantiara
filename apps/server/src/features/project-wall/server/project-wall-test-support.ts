// biome-ignore-all lint/suspicious/useAwait: Store seam methods are async; the memory store resolves synchronously.
import type {
  ProjectWallItemRecord,
  ProjectWallRecord,
  ProjectWallRelations,
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
        groupId: null,
        highlight: null,
        id: card.id,
        locked: false,
        placedAt: card.placedAt,
        position: card.position,
        sourceId: card.sourceId,
        sourceType: card.sourceType,
      };
      wall.items.push(added);
      return structuredClone(added);
    },

    async addLink(accountId, link) {
      const wall = ownedWall(accountId, link.projectId, link.wallId);
      if (!wall) {
        return null;
      }
      const added = {
        fromCardId: link.fromCardId,
        id: link.id,
        label: link.label,
        toCardId: link.toCardId,
      };
      wall.links.push(added);
      return structuredClone(added);
    },

    async createGroup(accountId, group) {
      const wall = ownedWall(accountId, group.projectId, group.wallId);
      if (!wall) {
        return null;
      }
      const added = { collapsed: false, id: group.id, title: group.title };
      wall.groups.push(added);
      return structuredClone(added);
    },

    async deleteGroup(accountId, group) {
      const wall = ownedWall(accountId, group.projectId, group.wallId);
      if (!wall?.groups.some(({ id }) => id === group.groupId)) {
        return false;
      }
      wall.groups = wall.groups.filter(({ id }) => id !== group.groupId);
      for (const card of wall.items) {
        if (card.groupId === group.groupId) {
          card.groupId = null;
        }
      }
      return true;
    },

    async removeLink(accountId, link) {
      const wall = ownedWall(accountId, link.projectId, link.wallId);
      if (!wall?.links.some(({ id }) => id === link.linkId)) {
        return false;
      }
      wall.links = wall.links.filter(({ id }) => id !== link.linkId);
      return true;
    },

    async setCardGroup(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      const card = wall ? item(wall, change.cardId) : undefined;
      if (!(wall && card)) {
        return false;
      }
      if (
        change.groupId !== null &&
        !wall.groups.some(({ id }) => id === change.groupId)
      ) {
        return false;
      }
      card.groupId = change.groupId;
      return true;
    },

    async setCardLocked(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      const card = wall ? item(wall, change.cardId) : undefined;
      if (!card) {
        return false;
      }
      card.locked = change.locked;
      return true;
    },

    async setGroupCollapsed(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      const group = wall?.groups.find(({ id }) => id === change.groupId);
      if (!group) {
        return false;
      }
      group.collapsed = change.collapsed;
      return true;
    },

    async createWall(accountId, wall) {
      if (!ownedProject(accountId, wall.projectId)) {
        return null;
      }
      const stamp = tick();
      const created: ProjectWallRecord = {
        createdAt: stamp,
        groups: [],
        id: wall.id,
        items: [],
        links: [],
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
        if (card && !card.locked) {
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
      wall.links = wall.links.filter(
        ({ fromCardId, toCardId }) =>
          fromCardId !== card.cardId && toCardId !== card.cardId,
      );
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
    /** Source lifecycle by the owning feature: archive or trash a record. */
    setSourceLifecycle(
      sourceType: ProjectWallSourceType,
      id: string,
      lifecycle: { archived?: boolean; trashed?: boolean },
    ) {
      const source = sources.get(recordLookupKey(sourceType, id));
      if (source) {
        Object.assign(source, lifecycle);
      }
    },
    removeSource(sourceType: ProjectWallSourceType, id: string) {
      sources.delete(recordLookupKey(sourceType, id));
    },
    store,
    wallRows: () => structuredClone([...walls.values()]),
  };
}

/**
 * Stand-in for the catalog relations seam. It records every relation row it
 * is asked to write, so a test can prove that the wall writes none on its own.
 */
export function createFakeProjectWallRelations() {
  const rows: Array<{
    kind: string;
    source: { recordId: string; recordType: string };
    target: { recordId: string; recordType: string };
  }> = [];
  const calls = { create: 0, preview: 0 };

  const relations: ProjectWallRelations = {
    async create(_accountId, input) {
      calls.create += 1;
      rows.push({
        kind: input.kind,
        source: input.source,
        target: input.target,
      });
      return {
        receiptId: `receipt-${calls.create}`,
        relation: null,
        relationId: input.previewId,
        signals: [],
      };
    },
    async previewCreate(_accountId, input) {
      calls.preview += 1;
      const previewId = [
        input.kind,
        input.source.recordType,
        input.source.recordId,
        input.target.recordType,
        input.target.recordId,
      ].join("|");
      const endpoint = (value: typeof input.source) => ({
        ...value,
        broken: null,
        key: null,
        label: null,
        originPosition: null,
        projectId: null,
        status: null,
        title: value.recordId,
        workType: null,
      });
      return {
        baseRevision: 0,
        blockingStatus: null,
        id: previewId,
        inverseLabel: input.kind,
        kind: input.kind,
        label: input.kind,
        previewId,
        source: endpoint(input.source),
        target: endpoint(input.target),
      };
    },
  };
  return { calls, relations, rows: () => structuredClone(rows) };
}
