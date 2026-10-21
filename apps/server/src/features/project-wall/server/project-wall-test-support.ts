// biome-ignore-all lint/suspicious/useAwait: Store seam methods are async; the memory store resolves synchronously.
import type {
  ProjectWallCollections,
  ProjectWallDiagrams,
  ProjectWallItemRecord,
  ProjectWallRecord,
  ProjectWallRecordSourceType,
  ProjectWallRelations,
  ProjectWallSkeleton,
  ProjectWallSourceLookup,
  ProjectWallStore,
} from "@cantiara/api/project-wall";
import { projectWallLookupKey } from "@cantiara/api/project-wall";
import type {
  ProjectWallSnapshotData,
  ProjectWallSnapshotRenderer,
} from "@cantiara/api/project-wall-presentation";
import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";

import { ProjectWallProjectReadOnlyError } from "./project-wall";

export interface FakeSourceRecord {
  archived?: boolean;
  id: string;
  ownerAccountId: string;
  projectId: string;
  sourceType: ProjectWallRecordSourceType;
  status: string | null;
  title: string;
  trashed?: boolean;
  values?: Record<string, string | null>;
}

export interface FakeProject {
  archived?: boolean;
  id: string;
  ownerAccountId: string;
  /** The Project shell's recorded catalog selection (metadata only). */
  starterSkeletons?: ProjectWallSkeleton[];
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
      projectWallLookupKey(source.sourceType, source.id),
      structuredClone(source),
    ]),
  );
  const walls = new Map<string, ProjectWallRecord>();
  const viewports = new Map<string, ProjectWallViewport>();
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

  /** Keeps the wall's `updatedAt` as fresh as the database adapter's. */
  function touch(wall: ProjectWallRecord) {
    wall.updatedAt = tick();
  }

  const store: ProjectWallStore = {
    async addCard(accountId, card) {
      const wall = ownedWall(accountId, card.projectId, card.wallId);
      if (!wall) {
        return null;
      }
      const added: ProjectWallItemRecord = {
        density: card.density,
        diagramViewId: card.diagramViewId,
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
      touch(wall);
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
      touch(wall);
      return structuredClone(added);
    },

    async createGroup(accountId, group) {
      const wall = ownedWall(accountId, group.projectId, group.wallId);
      if (!wall) {
        return null;
      }
      const added = { id: group.id, title: group.title };
      wall.groups.push(added);
      touch(wall);
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
      touch(wall);
      return true;
    },

    async removeLink(accountId, link) {
      const wall = ownedWall(accountId, link.projectId, link.wallId);
      if (!wall?.links.some(({ id }) => id === link.linkId)) {
        return false;
      }
      wall.links = wall.links.filter(({ id }) => id !== link.linkId);
      touch(wall);
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
      touch(wall);
      return true;
    },

    async setCardLocked(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      const card = wall ? item(wall, change.cardId) : undefined;
      if (!(wall && card)) {
        return false;
      }
      card.locked = change.locked;
      touch(wall);
      return true;
    },

    async createWall(accountId, wall) {
      if (!ownedProject(accountId, wall.projectId)) {
        return null;
      }
      const stamp = tick();
      const created: ProjectWallRecord = {
        createdAt: stamp,
        focusOrder: [],
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

    async createWallWithGroups(accountId, wall) {
      if (!ownedProject(accountId, wall.projectId)) {
        return null;
      }
      const stamp = tick();
      const created: ProjectWallRecord = {
        createdAt: stamp,
        groups: wall.groups.map((group) => ({
          id: group.id,
          title: group.title,
        })),
        focusOrder: [],
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

    async selectedSkeletons(accountId, projectId) {
      const found = input.projects.find(
        (candidate) =>
          candidate.id === projectId && candidate.ownerAccountId === accountId,
      );
      return found ? [...(found.starterSkeletons ?? [])] : null;
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
        const key = projectWallLookupKey(sourceType, id);
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
      touch(wall);
      return true;
    },

    async removeCard(accountId, card) {
      const wall = ownedWall(accountId, card.projectId, card.wallId);
      if (!(wall && item(wall, card.cardId))) {
        return false;
      }
      wall.items = wall.items.filter(({ id }) => id !== card.cardId);
      wall.focusOrder = wall.focusOrder.filter((id) => id !== card.cardId);
      wall.links = wall.links.filter(
        ({ fromCardId, toCardId }) =>
          fromCardId !== card.cardId && toCardId !== card.cardId,
      );
      touch(wall);
      return true;
    },

    async renameWall(accountId, rename) {
      const wall = ownedWall(accountId, rename.projectId, rename.wallId);
      if (!wall) {
        return false;
      }
      wall.title = rename.title;
      touch(wall);
      return true;
    },

    async setCardDensity(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      const card = item(wall ?? { items: [] }, change.cardId);
      if (!(wall && card)) {
        return false;
      }
      card.density = change.density;
      touch(wall);
      return true;
    },

    async setCardOrder(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      if (!wall) {
        return false;
      }
      const byId = new Map(wall.items.map((card) => [card.id, card]));
      wall.items = change.cardIds.flatMap((id) => {
        const card = byId.get(id);
        return card ? [card] : [];
      });
      return true;
    },

    async findViewport(accountId, wallId) {
      return structuredClone(viewports.get(`${accountId}:${wallId}`) ?? null);
    },

    async saveViewport(accountId, wallId, viewport) {
      viewports.set(`${accountId}:${wallId}`, structuredClone(viewport));
    },

    async setFocusOrder(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      if (!wall) {
        return false;
      }
      wall.focusOrder = [...change.cardIds];
      touch(wall);
      return true;
    },

    async setCardHighlight(accountId, change) {
      const wall = ownedWall(accountId, change.projectId, change.wallId);
      const card = item(wall ?? { items: [] }, change.cardId);
      if (!(wall && card)) {
        return false;
      }
      card.highlight = change.highlight;
      touch(wall);
      return true;
    },
  };

  return {
    /** A deep snapshot of every master record, to prove a wall change left it untouched. */
    sourceSnapshot: () => structuredClone([...sources.values()]),
    /** Master-record edit by the owning feature, e.g. renaming a Work. */
    editSource(
      sourceType: ProjectWallRecordSourceType,
      id: string,
      title: string,
    ) {
      const source = sources.get(projectWallLookupKey(sourceType, id));
      if (source) {
        source.title = title;
      }
    },
    /** Source lifecycle by the owning feature: archive or trash a record. */
    setSourceLifecycle(
      sourceType: ProjectWallRecordSourceType,
      id: string,
      lifecycle: { archived?: boolean; trashed?: boolean },
    ) {
      const source = sources.get(projectWallLookupKey(sourceType, id));
      if (source) {
        Object.assign(source, lifecycle);
      }
    },
    removeSource(sourceType: ProjectWallRecordSourceType, id: string) {
      sources.delete(projectWallLookupKey(sourceType, id));
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

export interface FakeDiagram {
  id: string;
  model: TechnicalDiagramSource["model"];
  ownerAccountId: string;
  projectId: string;
  title: string;
  views: Array<{ id: string; name: string; selectedNodeIds: string[] }>;
}

/**
 * Read-only stand-in for the Technical Diagrams feature. It exposes exactly
 * the read methods the wall may hold; `rename` is the owning feature's edit.
 */
export function createFakeProjectWallDiagrams(input: FakeDiagram[]) {
  const diagrams = new Map(input.map((diagram) => [diagram.id, diagram]));
  function source(
    accountId: string,
    diagram: FakeDiagram | undefined,
    view: FakeDiagram["views"][number] | null,
  ): TechnicalDiagramSource | null {
    if (!diagram || diagram.ownerAccountId !== accountId) {
      return null;
    }
    return {
      authorityMode: "Product-authored Model",
      externalSource: null,
      id: diagram.id,
      model: structuredClone(diagram.model),
      origins: [],
      projectId: diagram.projectId,
      revision: 1,
      title: diagram.title,
      type: "Technical Architecture",
      view: view ? { ...structuredClone(view), layout: {} } : null,
    };
  }
  const access: ProjectWallDiagrams = {
    // biome-ignore lint/suspicious/useAwait: Seam methods are async.
    async get(accountId, diagramId, viewId) {
      const diagram = diagrams.get(diagramId);
      const view = viewId
        ? (diagram?.views.find(({ id }) => id === viewId) ?? null)
        : (diagram?.views.find(({ name }) => name === "Default") ?? null);
      if (viewId && !view) {
        return null;
      }
      return source(accountId, diagram, view);
    },
    // biome-ignore lint/suspicious/useAwait: Seam methods are async.
    async list(accountId, projectId) {
      return [...diagrams.values()]
        .filter((diagram) => diagram.projectId === projectId)
        .flatMap((diagram) => source(accountId, diagram, null) ?? []);
    },
    // biome-ignore lint/suspicious/useAwait: Seam methods are async.
    async listViews(accountId, diagramId) {
      const diagram = diagrams.get(diagramId);
      return diagram?.ownerAccountId === accountId
        ? diagram.views.map((view) => ({
            ...structuredClone(view),
            layout: {},
          }))
        : null;
    },
  };
  return {
    access,
    rename(id: string, title: string) {
      const diagram = diagrams.get(id);
      if (diagram) {
        diagram.title = title;
      }
    },
    snapshot: () => structuredClone([...diagrams.values()]),
  };
}

export interface FakeCollection {
  id: string;
  name: string;
  ownerAccountId: string;
  projectId: string;
  works: Array<{ id: string; key: string; status: string; title: string }>;
}

/**
 * Read-only stand-in for the Smart Collections feature. Membership lives
 * here; `calls` records every `getView` so a test can prove the wall asks the
 * collection and runs no query of its own.
 */
export function createFakeProjectWallCollections(input: FakeCollection[]) {
  const collections = new Map(
    input.map((collection) => [collection.id, structuredClone(collection)]),
  );
  const calls: Array<{ readOnly: boolean; viewId: string }> = [];
  function view(collection: FakeCollection): SmartCollectionViewSource {
    return {
      collectionId: collection.id,
      collectionName: collection.name,
      conditions: [],
      documents: [],
      id: collection.id,
      isSubscribed: false,
      name: collection.name,
      notifyOnLeave: false,
      presentation: "List",
      projectId: collection.projectId,
      projectSourceRecords: [],
      scope: { projectIds: [collection.projectId] },
      sourceType: "Work",
      workspaceId: "workspace-1",
      works: collection.works.map((work) => ({
        createdAt: "2026-01-01T00:00:00.000Z",
        effort: null,
        id: work.id,
        key: work.key,
        membershipReasons: [],
        projectId: collection.projectId,
        status: work.status,
        statusChangedAt: "2026-01-01T00:00:00.000Z",
        title: work.title,
        type: "Task",
      })),
    } as unknown as SmartCollectionViewSource;
  }
  const access: ProjectWallCollections = {
    // biome-ignore lint/suspicious/useAwait: Seam methods are async.
    async getView(accountId, viewId, options) {
      calls.push({ readOnly: options?.readOnly === true, viewId });
      const collection = collections.get(viewId);
      return collection?.ownerAccountId === accountId ? view(collection) : null;
    },
    // biome-ignore lint/suspicious/useAwait: Seam methods are async.
    async listViews(accountId, projectId) {
      return [...collections.values()]
        .filter(
          (collection) =>
            collection.projectId === projectId &&
            collection.ownerAccountId === accountId,
        )
        .map(view);
    },
  };
  return {
    access,
    calls,
    removeWork(viewId: string, workId: string) {
      const collection = collections.get(viewId);
      if (collection) {
        collection.works = collection.works.filter(({ id }) => id !== workId);
      }
    },
  };
}

/** Records what the renderer was asked to freeze; returns fixed bytes. */
export function createFakeSnapshotRenderer() {
  const rendered: ProjectWallSnapshotData[] = [];
  const renderer: ProjectWallSnapshotRenderer = {
    // biome-ignore lint/suspicious/useAwait: Seam methods are async.
    async pdf(data) {
      rendered.push(structuredClone(data));
      return new TextEncoder().encode("%PDF fake");
    },
    // biome-ignore lint/suspicious/useAwait: Seam methods are async.
    async png(data) {
      rendered.push(structuredClone(data));
      return new Uint8Array([137, 80, 78, 71]);
    },
  };
  return { rendered, renderer };
}
