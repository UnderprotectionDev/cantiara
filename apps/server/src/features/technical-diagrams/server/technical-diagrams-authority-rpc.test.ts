import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import {
  assertPreviewedConversion,
  previewAuthorityConversion,
} from "@cantiara/api/technical-diagram-authority";
import {
  buildConvertToRecordPlan,
  DiagramConversionError,
  type DiagramRecordCardRecord,
  isSameConvertToRecordPlan,
  pinDiagramToVersion,
} from "@cantiara/api/technical-diagram-card";
import {
  diagramGraph,
  emptyStructuralModel,
  resolveStructuralModel,
  StructuralModelError,
} from "@cantiara/api/technical-diagram-structure";
import {
  assertVersionBind,
  createCheckpoint,
  pruneDiagramViewSelection,
  restoreFromCheckpoint,
  type TechnicalDiagramVersion,
} from "@cantiara/api/technical-diagram-version";
import {
  diagramGroups,
  liveCollapsedGroups,
  type TechnicalDiagramViewport,
} from "@cantiara/api/technical-diagram-viewport";
import type {
  TechnicalDiagramSource,
  TechnicalDiagramsAccess,
} from "@cantiara/api/technical-diagrams";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

const VIEWPORT_WORDS = /zoom|collapsed|center/;
const DIAGRAM_VERSION_COMMAND = /diagramversion/i;
const DIAGRAM_RECORD_CARD_COMMAND = /diagramrecordcard/i;
const AUTHORITY_COMMAND =
  /diagram.*(authority|mode|reclassif)|(authority|mode|reclassif).*diagram/i;
const accountId = "account-1";
const externalSource = {
  lastCheckedAt: "2026-10-20T09:00:00.000Z",
  revision: null,
  tool: "Excalidraw",
  url: "https://excalidraw.com/#room=abc",
};

/** In-memory Technical Diagrams store applying the shared authority rules. */
function createFixture() {
  const diagrams = new Map<string, TechnicalDiagramSource>();
  const versions = new Map<string, TechnicalDiagramVersion>();
  /** Master records the cards read; the fixture proves cards never write them. */
  const records = new Map<
    string,
    { projectId: string; status: string; title: string; type: string }
  >();
  const cards = new Map<string, DiagramRecordCardRecord>();
  const links = new Map<
    string,
    { diagramId: string; nodeId: string; versionId: string }
  >();
  /** Personal viewports keyed by account, diagram and view; nothing else holds them. */
  const viewports = new Map<string, TechnicalDiagramViewport>();
  const viewportKey = (account: string, diagramId: string, viewId?: string) =>
    JSON.stringify([account, diagramId, viewId ?? ""]);
  const present = (id: string): TechnicalDiagramSource | null => {
    const diagram = diagrams.get(id);
    return diagram ? { ...diagram, origins: [...diagram.origins] } : null;
  };
  const access = {
    convertAuthority: async (_account, input) => {
      const source = diagrams.get(input.sourceDiagramId);
      if (!source) {
        return null;
      }
      const preview = await assertPreviewedConversion(source, input);
      const created: TechnicalDiagramSource = {
        authorityMode: preview.targetMode,
        externalSource: input.externalSource ?? null,
        id: input.clientIdempotencyKey,
        model:
          preview.targetMode === "External Source Link"
            ? emptyStructuralModel(source.type)
            : source.model,
        origins: [
          {
            authorityMode: source.authorityMode,
            diagramId: source.id,
            relation: "Originates from",
            title: source.title,
          },
        ],
        projectId: source.projectId,
        revision: 1,
        title: input.title,
        type: source.type,
        view: null,
      };
      diagrams.set(created.id, created);
      source.origins.push({
        authorityMode: created.authorityMode,
        diagramId: created.id,
        relation: "Derived",
        title: created.title,
      });
      return present(created.id);
    },
    create: (_account, input) => {
      const createdModel =
        input.authorityMode === "Product-authored Model"
          ? (input.model ?? emptyStructuralModel(input.type))
          : emptyStructuralModel(input.type);
      const created: TechnicalDiagramSource = {
        authorityMode: input.authorityMode,
        externalSource:
          input.authorityMode === "External Source Link"
            ? input.externalSource
            : null,
        id: input.clientIdempotencyKey,
        model: createdModel,
        origins: [],
        projectId: input.projectId,
        revision: 1,
        title: input.title,
        type: input.type,
        view: {
          id: `${input.clientIdempotencyKey}:default`,
          layout: {},
          name: "Default",
          selectedNodeIds: diagramGraph(createdModel).nodes.map(({ id }) => id),
        },
      };
      diagrams.set(created.id, created);
      return Promise.resolve(present(created.id));
    },
    get: (_account, id) => Promise.resolve(present(id)),
    saveModel: (_account, input) => {
      const diagram = diagrams.get(input.diagramId);
      if (!diagram) {
        return Promise.resolve(null);
      }
      if (diagram.authorityMode === "External Source Link") {
        throw new StructuralModelError("External content stays external.");
      }
      const model = resolveStructuralModel(diagram.type, input.model);
      if ("participants" in model) {
        // Mirrors the adapter: a pinned lifeline is checked against the
        // checkpoint, never the live source.
        for (const { bind } of model.participants) {
          if (bind?.versionId) {
            try {
              assertVersionBind(versions.get(bind.versionId) ?? null, bind);
            } catch (error) {
              throw new StructuralModelError((error as Error).message, {
                cause: error,
              });
            }
          }
        }
      }
      diagram.model = model;
      diagram.revision += 1;
      if (diagram.view) {
        // Mirrors the adapter: the built-in Default view is re-derived from the
        // live model on every save, so a no-view Live card keeps following it.
        const pruned = pruneDiagramViewSelection(diagram.view, model);
        diagram.view = {
          ...diagram.view,
          layout: pruned.layout,
          selectedNodeIds: pruned.selectedNodeIds,
        };
      }
      return Promise.resolve(present(diagram.id));
    },
    createVersion: (_account, input) => {
      const diagram = diagrams.get(input.diagramId);
      if (!diagram) {
        return Promise.resolve(null);
      }
      const existing = versions.get(input.clientIdempotencyKey);
      if (existing) {
        return Promise.resolve(existing);
      }
      const ofDiagram = [...versions.values()].filter(
        ({ diagramId }) => diagramId === diagram.id,
      );
      const version = createCheckpoint(diagram, {
        createdAt: "2026-10-21T08:00:00.000Z",
        id: input.clientIdempotencyKey,
        name: input.name,
        number: ofDiagram.length + 1,
      });
      versions.set(version.id, version);
      return Promise.resolve(version);
    },
    getVersion: (_account, id) => Promise.resolve(versions.get(id) ?? null),
    listVersions: (_account, id) =>
      Promise.resolve(
        diagrams.has(id)
          ? [...versions.values()].filter(({ diagramId }) => diagramId === id)
          : null,
      ),
    restoreVersion: (_account, input) => {
      const diagram = diagrams.get(input.diagramId);
      const version = versions.get(input.versionId);
      if (!(diagram && version)) {
        return Promise.resolve(null);
      }
      const restored = restoreFromCheckpoint(
        diagram,
        version,
        input.expectedRevision,
      );
      diagram.model = restored.model;
      diagram.revision = restored.revision;
      return Promise.resolve(present(diagram.id));
    },
    placeRecordCard: (_account, input) => {
      if (!diagrams.has(input.diagramId)) {
        return Promise.resolve(null);
      }
      const card: DiagramRecordCardRecord = {
        diagramId: input.diagramId,
        id: input.clientIdempotencyKey,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        x: input.x ?? 0,
        y: input.y ?? 0,
      };
      cards.set(card.id, card);
      return Promise.resolve(card);
    },
    moveRecordCard: (_account, input) => {
      const card = cards.get(input.cardId);
      if (!card) {
        return Promise.resolve(null);
      }
      card.x = input.x;
      card.y = input.y;
      return Promise.resolve(card);
    },
    listRecordCards: (_account, diagramId) =>
      Promise.resolve(
        diagrams.has(diagramId)
          ? [...cards.values()]
              .filter((card) => card.diagramId === diagramId)
              .map((card) => {
                const record = records.get(
                  `${card.sourceType}:${card.sourceId}`,
                );
                return {
                  ...card,
                  broken: record
                    ? null
                    : {
                        canOpenSourceRecord: false,
                        reason: "Permanently deleted" as const,
                      },
                  openPath: record ? `/open/${card.sourceId}` : null,
                  status: record?.status ?? null,
                  title: record?.title ?? null,
                };
              })
          : null,
      ),
    previewConvertToRecord: (_account, input) => {
      const diagram = diagrams.get(input.diagramId);
      const version = versions.get(input.versionId);
      if (!(diagram && version)) {
        return Promise.resolve(null);
      }
      const plan = buildConvertToRecordPlan(
        { diagram, projectName: "Cantiara", version },
        { ...input, workType: input.workType ?? "Task" },
      );
      if (!plan) {
        throw new DiagramConversionError(
          "The node is not in this Diagram Version.",
        );
      }
      return Promise.resolve(plan);
    },
    convertToRecord: async (account, input) => {
      const derived = await access.previewConvertToRecord(account, {
        diagramId: input.plan.diagram.id,
        nodeId: input.plan.node.id,
        target: input.plan.record.type,
        versionId: input.plan.version.versionId,
        workType: input.plan.record.workType ?? "Task",
      });
      if (!(derived && isSameConvertToRecordPlan(input.plan, derived))) {
        throw new DiagramConversionError("The conversion preview changed.");
      }
      const recordId = input.clientIdempotencyKey;
      if (!links.has(recordId)) {
        records.set(`${input.plan.record.type}:${recordId}`, {
          projectId: input.plan.targetProject.id,
          status: "Open",
          title: input.plan.record.title,
          type: input.plan.record.type,
        });
        links.set(recordId, {
          diagramId: input.plan.diagram.id,
          nodeId: input.plan.node.id,
          versionId: input.plan.version.versionId,
        });
      }
      return {
        nodeId: input.plan.node.id,
        recordId,
        recordType: input.plan.record.type,
        version: input.plan.version,
      };
    },
    viewport: (account, input) =>
      Promise.resolve(
        diagrams.has(input.diagramId)
          ? {
              viewport:
                viewports.get(
                  viewportKey(account, input.diagramId, input.viewId),
                ) ?? null,
            }
          : null,
      ),
    saveViewport: (account, input) => {
      const diagram = diagrams.get(input.diagramId);
      if (!diagram) {
        return Promise.resolve(null);
      }
      const viewport = {
        ...input.viewport,
        collapsed: liveCollapsedGroups(
          diagramGroups(diagram.model),
          input.viewport.collapsed ?? [],
        ),
      };
      viewports.set(
        viewportKey(account, input.diagramId, input.viewId),
        viewport,
      );
      return Promise.resolve(viewport);
    },
    previewAuthorityConversion: (_account, input) => {
      const source = diagrams.get(input.sourceDiagramId);
      return source
        ? previewAuthorityConversion(source, input)
        : Promise.resolve(null);
    },
  } as TechnicalDiagramsAccess;
  const context = {
    auth: null,
    db: {} as Context["db"],
    session: {
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"],
    technicalDiagrams: access,
  } as unknown as Context;
  return {
    access,
    cards,
    client: createRouterClient(appRouter, { context }),
    diagrams,
    links,
    records,
    versions,
  };
}

const create = (
  client: ReturnType<typeof createFixture>["client"],
  key: string,
) =>
  client.createTechnicalDiagram({
    authorityMode: "Product-authored Model",
    clientIdempotencyKey: key,
    model: {
      links: [{ from: "api", kind: "Calls", label: null, to: "db" }],
      nodes: [
        { id: "api", kind: "Service", label: "API" },
        { id: "db", kind: "Datastore", label: "Database" },
      ],
    },
    projectId: "project-1",
    title: "Platform",
    type: "Technical Architecture",
  });

const keys = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

describe("Technical Diagrams authority modes", () => {
  test("creates Product-authored Model and External Source Link", async () => {
    const { client } = createFixture();
    expect(await create(client, keys[0] as string)).toMatchObject({
      authorityMode: "Product-authored Model",
      externalSource: null,
    });
    const external = await client.createTechnicalDiagram({
      authorityMode: "External Source Link",
      clientIdempotencyKey: keys[1] as string,
      externalSource,
      projectId: "project-1",
      title: "Whiteboard",
      type: "Technical Architecture",
    });
    expect(external).toMatchObject({
      authorityMode: "External Source Link",
      externalSource,
      model: { links: [], nodes: [] },
    });
  });

  test("refuses to mint Repository-derived View or an unlinked External Source Link", async () => {
    const { client, diagrams } = createFixture();
    await expect(
      client.createTechnicalDiagram({
        authorityMode: "Repository-derived View",
        clientIdempotencyKey: keys[0] as string,
        projectId: "project-1",
        title: "Repo",
        type: "Data Model",
      } as never),
    ).rejects.toThrow();
    await expect(
      client.createTechnicalDiagram({
        authorityMode: "External Source Link",
        clientIdempotencyKey: keys[0] as string,
        externalSource: { ...externalSource, url: "http://insecure.test" },
        projectId: "project-1",
        title: "Insecure",
        type: "Data Model",
      }),
    ).rejects.toThrow();
    expect(diagrams.size).toBe(0);
  });

  test("exposes no in-place authority change command", () => {
    const commands = Object.keys(appRouter).filter((name) =>
      AUTHORITY_COMMAND.test(name),
    );
    expect(commands.sort()).toEqual([
      "convertDiagramAuthority",
      "previewDiagramAuthorityConversion",
    ]);
  });

  test("converts authority into a new identity with two-way origin only after preview", async () => {
    const { client, diagrams } = createFixture();
    await create(client, keys[0] as string);
    const request = {
      sourceDiagramId: keys[0] as string,
      targetMode: "Imported Independent Copy" as const,
      title: "Imported platform",
    };
    await expect(
      client.convertDiagramAuthority({
        ...request,
        clientIdempotencyKey: keys[1] as string,
        previewToken: "0".repeat(64),
      }),
    ).rejects.toThrow();
    expect(diagrams.size).toBe(1);

    const preview = await client.previewDiagramAuthorityConversion(request);
    expect(preview).toMatchObject({
      canConvert: true,
      newIdentity: true,
      sourceMode: "Product-authored Model",
      targetMode: "Imported Independent Copy",
    });
    expect(diagrams.size).toBe(1);

    const converted = await client.convertDiagramAuthority({
      ...request,
      clientIdempotencyKey: keys[1] as string,
      previewToken: preview.previewToken,
    });
    expect(converted.id).not.toBe(keys[0]);
    expect(converted.authorityMode).toBe("Imported Independent Copy");
    expect(converted.origins).toEqual([
      expect.objectContaining({
        diagramId: keys[0],
        relation: "Originates from",
      }),
    ]);
    const source = await client.technicalDiagram({
      diagramId: keys[0] as string,
    });
    expect(source.authorityMode).toBe("Product-authored Model");
    expect(source.origins).toEqual([
      expect.objectContaining({ diagramId: keys[1], relation: "Derived" }),
    ]);
  });

  test("converts to External Source Link with the exact link and no copied content", async () => {
    const { client } = createFixture();
    await create(client, keys[0] as string);
    const request = {
      externalSource,
      sourceDiagramId: keys[0] as string,
      targetMode: "External Source Link" as const,
      title: "Board",
    };
    const preview = await client.previewDiagramAuthorityConversion(request);
    const converted = await client.convertDiagramAuthority({
      ...request,
      clientIdempotencyKey: keys[2] as string,
      previewToken: preview.previewToken,
    });
    expect(converted).toMatchObject({
      authorityMode: "External Source Link",
      externalSource,
      model: { links: [], nodes: [] },
    });
  });
});

describe("Technical Diagrams three types", () => {
  const dataModel = {
    relations: [],
    tables: [
      {
        columns: [
          {
            default: null,
            id: "p.id",
            name: "id",
            nullable: false,
            primaryKey: true,
            type: "uuid",
            unique: false,
          },
        ],
        id: "p",
        indexes: [],
        name: "project",
      },
    ],
  };
  const sequence = {
    participants: [
      { bind: null, id: "a", kind: "Actor" as const, label: "Founder" },
      { bind: null, id: "b", kind: "Component" as const, label: "API" },
    ],
    steps: [
      {
        from: "a",
        id: "m1",
        kind: "Message" as const,
        label: "Open",
        messageKind: "Sync" as const,
        to: "b",
      },
    ],
  };

  test("creates Technical Architecture, Data Model and Technical Sequence in a Project", async () => {
    const { client } = createFixture();
    const architecture = await create(client, keys[0] as string);
    const data = await client.createTechnicalDiagram({
      authorityMode: "Product-authored Model",
      clientIdempotencyKey: keys[1] as string,
      model: dataModel,
      projectId: "project-1",
      title: "Schema",
      type: "Data Model",
    });
    const flow = await client.createTechnicalDiagram({
      authorityMode: "Product-authored Model",
      clientIdempotencyKey: keys[2] as string,
      model: sequence,
      projectId: "project-1",
      title: "Open project",
      type: "Technical Sequence",
    });
    expect([architecture.type, data.type, flow.type]).toEqual([
      "Technical Architecture",
      "Data Model",
      "Technical Sequence",
    ]);
    expect(data.model).toMatchObject({ tables: [{ name: "project" }] });
    expect(flow.model).toMatchObject({
      participants: [{ id: "a" }, { id: "b" }],
    });
  });

  test("an empty new diagram starts with the empty model of its own type", async () => {
    const { client } = createFixture();
    const data = await client.createTechnicalDiagram({
      authorityMode: "Product-authored Model",
      clientIdempotencyKey: keys[0] as string,
      projectId: "project-1",
      title: "Schema",
      type: "Data Model",
    });
    expect(data.model).toEqual({ relations: [], tables: [] });
  });

  test("refuses a model of another type, a DSL string and Mermaid text", async () => {
    const { client, diagrams } = createFixture();
    const attempts = [
      { links: [], nodes: [] },
      "graph TD\nA --> B",
      { mermaid: "graph TD" },
    ].map((model) =>
      client.createTechnicalDiagram({
        authorityMode: "Product-authored Model",
        clientIdempotencyKey: keys[0] as string,
        model,
        projectId: "project-1",
        title: "Schema",
        type: "Data Model",
      } as never),
    );
    const outcomes = await Promise.allSettled(attempts);
    expect(outcomes.map(({ status }) => status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(diagrams.size).toBe(0);
  });

  test("edits the canonical model only through the typed structure command", async () => {
    const { client } = createFixture();
    await create(client, keys[0] as string);
    const saved = await client.saveTechnicalDiagramStructure({
      diagramId: keys[0] as string,
      model: {
        links: [],
        nodes: [{ id: "queue", kind: "Queue/Event Bus", label: "Jobs" }],
      },
    });
    expect(saved.model).toMatchObject({ nodes: [{ id: "queue" }] });
    await expect(
      client.saveTechnicalDiagramStructure({
        diagramId: keys[0] as string,
        model: dataModel,
      }),
    ).rejects.toThrow();
    expect(Object.keys(appRouter)).not.toContain("saveTechnicalDiagramSql");
  });

  test("an External Source Link keeps no editable structural model", async () => {
    const { client } = createFixture();
    await client.createTechnicalDiagram({
      authorityMode: "External Source Link",
      clientIdempotencyKey: keys[0] as string,
      externalSource,
      projectId: "project-1",
      title: "Board",
      type: "Data Model",
    });
    await expect(
      client.saveTechnicalDiagramStructure({
        diagramId: keys[0] as string,
        model: dataModel,
      }),
    ).rejects.toThrow();
  });
});

describe("Diagram Versions", () => {
  const versionKeys = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ];
  const renamed = {
    links: [],
    nodes: [{ id: "api", kind: "Service" as const, label: "Gateway" }],
  };

  test("a checkpoint is immutable while the live diagram keeps editing", async () => {
    const { client } = createFixture();
    await create(client, keys[0] as string);
    const version = await client.createDiagramVersion({
      clientIdempotencyKey: versionKeys[0] as string,
      diagramId: keys[0] as string,
      name: "Before rename",
    });
    await client.saveTechnicalDiagramStructure({
      diagramId: keys[0] as string,
      model: renamed,
    });
    const reread = await client.technicalDiagramVersion({
      versionId: version.id,
    });
    expect(reread).toEqual(version);
    expect(reread.model).toMatchObject({ nodes: [{ label: "API" }, {}] });
    expect(reread.authorityMode).toBe("Product-authored Model");
    const live = await client.technicalDiagram({
      diagramId: keys[0] as string,
    });
    expect(live.revision).toBe(2);
    expect(live.model).toMatchObject({ nodes: [{ label: "Gateway" }] });
  });

  test("a retried confirmation key returns the same checkpoint", async () => {
    const { client, versions } = createFixture();
    await create(client, keys[0] as string);
    const input = {
      clientIdempotencyKey: versionKeys[0] as string,
      diagramId: keys[0] as string,
      name: "Baseline",
    };
    const first = await client.createDiagramVersion(input);
    expect(await client.createDiagramVersion(input)).toEqual(first);
    expect(versions.size).toBe(1);
  });

  test("an External Source Link has no Diagram Version", async () => {
    const { client, versions } = createFixture();
    await client.createTechnicalDiagram({
      authorityMode: "External Source Link",
      clientIdempotencyKey: keys[0] as string,
      externalSource,
      projectId: "project-1",
      title: "Board",
      type: "Technical Architecture",
    });
    await expect(
      client.createDiagramVersion({
        clientIdempotencyKey: versionKeys[0] as string,
        diagramId: keys[0] as string,
        name: "Board v1",
      }),
    ).rejects.toThrow();
    expect(versions.size).toBe(0);
  });

  test("restore writes a new live revision and never rewrites the checkpoint", async () => {
    const { client, versions } = createFixture();
    await create(client, keys[0] as string);
    const version = await client.createDiagramVersion({
      clientIdempotencyKey: versionKeys[0] as string,
      diagramId: keys[0] as string,
      name: "Before rename",
    });
    const edited = await client.saveTechnicalDiagramStructure({
      diagramId: keys[0] as string,
      model: renamed,
    });
    const restored = await client.restoreDiagramVersion({
      diagramId: keys[0] as string,
      expectedRevision: edited.revision,
      versionId: version.id,
    });
    expect(restored.revision).toBe(edited.revision + 1);
    expect(restored.model).toEqual(version.model);
    expect(versions.size).toBe(1);
    expect(
      await client.technicalDiagramVersion({ versionId: version.id }),
    ).toEqual(version);
    // A stale view of the pre-restore revision is refused.
    await expect(
      client.restoreDiagramVersion({
        diagramId: keys[0] as string,
        expectedRevision: edited.revision,
        versionId: version.id,
      }),
    ).rejects.toThrow();
  });

  test("exposes no command that edits or deletes a checkpoint", () => {
    const commands = Object.keys(appRouter).filter((name) =>
      DIAGRAM_VERSION_COMMAND.test(name),
    );
    expect(commands.sort()).toEqual([
      "createDiagramVersion",
      "restoreDiagramVersion",
      "technicalDiagramVersion",
      "technicalDiagramVersions",
    ]);
  });

  test("a Diagram View stores ids and layout only, so it follows the live source while a version does not", async () => {
    const { client } = createFixture();
    await create(client, keys[0] as string);
    const version = await client.createDiagramVersion({
      clientIdempotencyKey: versionKeys[0] as string,
      diagramId: keys[0] as string,
      name: "Before rename",
    });
    await client.saveTechnicalDiagramStructure({
      diagramId: keys[0] as string,
      model: renamed,
    });
    const view = { selectedNodeIds: ["api"] };
    const live = await client.technicalDiagram({
      diagramId: keys[0] as string,
    });
    const labels = (model: Parameters<typeof diagramGraph>[0]) =>
      diagramGraph(model)
        .nodes.filter(({ id }) => view.selectedNodeIds.includes(id))
        .map(({ label }) => label);
    expect(labels(live.model)).toEqual(["Gateway"]);
    expect(labels(version.model)).toEqual(["API"]);
  });

  test("the built-in Default view keeps following added elements, so a no-view Live card stays live", async () => {
    const { client, diagrams } = createFixture();
    const diagramKey = keys[0] as string;
    await create(client, diagramKey);
    expect(diagrams.get(diagramKey)?.view?.selectedNodeIds).toEqual([
      "api",
      "db",
    ]);
    await client.saveTechnicalDiagramStructure({
      diagramId: diagramKey,
      model: {
        links: [{ from: "api", kind: "Calls", label: null, to: "db" }],
        nodes: [
          { id: "api", kind: "Service", label: "API" },
          { id: "db", kind: "Datastore", label: "Database" },
          { id: "gateway", kind: "Service", label: "Gateway" },
        ],
      },
    });
    // An element added after the card was embedded still shows on it.
    expect(diagrams.get(diagramKey)?.view?.selectedNodeIds).toEqual([
      "api",
      "db",
      "gateway",
    ]);
  });
});

describe("Sequence lifeline bound to an exact Diagram Version", () => {
  const sequenceWith = (versionId: string | null, label = "API") => ({
    participants: [
      {
        bind: {
          boundLabel: label,
          diagramId: keys[0] as string,
          nodeId: "api",
          versionId,
        },
        id: "svc",
        kind: "Component" as const,
        label: "Service",
      },
    ],
    steps: [],
  });

  async function setup() {
    const fixture = createFixture();
    await create(fixture.client, keys[0] as string);
    await fixture.client.createTechnicalDiagram({
      authorityMode: "Product-authored Model",
      clientIdempotencyKey: keys[1] as string,
      projectId: "project-1",
      title: "Flow",
      type: "Technical Sequence",
    });
    const version = await fixture.client.createDiagramVersion({
      clientIdempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      diagramId: keys[0] as string,
      name: "Baseline",
    });
    return { ...fixture, version };
  }

  test("stores a validated exact version and keeps it when the source moves on", async () => {
    const { client, version } = await setup();
    const saved = await client.saveTechnicalDiagramStructure({
      diagramId: keys[1] as string,
      model: sequenceWith(version.id),
    });
    expect(saved.model).toMatchObject({
      participants: [{ bind: { versionId: version.id } }],
    });
    // The source renames its node and gets a newer version: no retargeting.
    await client.saveTechnicalDiagramStructure({
      diagramId: keys[0] as string,
      model: {
        links: [],
        nodes: [{ id: "api", kind: "Service", label: "Gateway" }],
      },
    });
    await client.createDiagramVersion({
      clientIdempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      diagramId: keys[0] as string,
      name: "Newer",
    });
    const after = await client.technicalDiagram({
      diagramId: keys[1] as string,
    });
    expect(after.model).toMatchObject({
      participants: [{ bind: { boundLabel: "API", versionId: version.id } }],
    });
  });

  test("refuses an unknown version and a node the version does not hold", async () => {
    const { client, version } = await setup();
    await expect(
      client.saveTechnicalDiagramStructure({
        diagramId: keys[1] as string,
        model: sequenceWith("missing-version"),
      }),
    ).rejects.toThrow();
    await expect(
      client.saveTechnicalDiagramStructure({
        diagramId: keys[1] as string,
        model: sequenceWith(version.id, "Gateway"),
      }),
    ).rejects.toThrow();
  });
});

describe("Live cards and composition", () => {
  const cardKeys = [
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  ];
  const diagramKey = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const versionKey = "ffffffff-ffff-4fff-8fff-ffffffffffff";

  async function seed() {
    const fixture = createFixture();
    await create(fixture.client, diagramKey);
    const version = await fixture.client.createDiagramVersion({
      clientIdempotencyKey: versionKey,
      diagramId: diagramKey,
      name: "Launch",
    });
    return { ...fixture, version };
  }

  test("a card keeps the live read and the Exact read apart, and exact ignores later live edits", async () => {
    const { client, diagrams, version } = await seed();
    await client.saveTechnicalDiagramStructure({
      diagramId: diagramKey,
      model: {
        links: [],
        nodes: [{ id: "api", kind: "Service", label: "Gateway" }],
      },
    });
    const live = diagrams.get(diagramKey) as TechnicalDiagramSource;
    expect(live.exactVersion ?? null).toBeNull();
    const exact = pinDiagramToVersion(live, version);
    expect(exact?.exactVersion).toMatchObject({
      kind: "Diagram Version",
      name: "Launch",
      versionId: versionKey,
    });
    expect(
      diagramGraph((exact as TechnicalDiagramSource).model).nodes,
    ).toHaveLength(2);
    expect(diagramGraph(live.model).nodes).toHaveLength(1);
  });

  test("a record card stores identity and position, never the record", async () => {
    const { cards, client, records } = await seed();
    records.set("Risk:risk-1", {
      projectId: "project-1",
      status: "Open",
      title: "Vendor lock-in",
      type: "Risk",
    });
    const before = structuredClone([...records.entries()]);
    const placed = await client.placeDiagramRecordCard({
      clientIdempotencyKey: cardKeys[0] as string,
      diagramId: diagramKey,
      sourceId: "risk-1",
      sourceType: "Risk",
      x: 10,
      y: 20,
    });
    expect(Object.keys(placed).sort()).toEqual([
      "diagramId",
      "id",
      "sourceId",
      "sourceType",
      "x",
      "y",
    ]);
    await client.moveDiagramRecordCard({
      cardId: placed.id,
      diagramId: diagramKey,
      x: 300,
      y: 400,
    });
    expect(cards.get(placed.id)).toMatchObject({ x: 300, y: 400 });
    expect([...records.entries()]).toEqual(before);
    expect(
      await client.technicalDiagramRecordCards({ diagramId: diagramKey }),
    ).toMatchObject([
      { broken: null, status: "Open", title: "Vendor lock-in", x: 300, y: 400 },
    ]);
  });

  test("a deleted source reads as a broken card, not stale content", async () => {
    const { client, records } = await seed();
    records.set("Work:work-1", {
      projectId: "project-1",
      status: "Not Started",
      title: "Old title",
      type: "Work",
    });
    await client.placeDiagramRecordCard({
      clientIdempotencyKey: cardKeys[0] as string,
      diagramId: diagramKey,
      sourceId: "work-1",
      sourceType: "Work",
    });
    records.delete("Work:work-1");
    const [card] = await client.technicalDiagramRecordCards({
      diagramId: diagramKey,
    });
    expect(card).toMatchObject({
      broken: { reason: "Permanently deleted" },
      title: null,
    });
  });

  test("exposes no command that writes a record from a card or edits it", () => {
    const names = Object.keys(appRouter).filter((name) =>
      DIAGRAM_RECORD_CARD_COMMAND.test(name),
    );
    expect(names.sort()).toEqual([
      "moveDiagramRecordCard",
      "placeDiagramRecordCard",
      "removeDiagramRecordCard",
      "technicalDiagramRecordCards",
    ]);
  });

  test("Convert to record and link previews target, fields, exact version and origin, then writes one record", async () => {
    const { client, diagrams, links, records } = await seed();
    const input = {
      diagramId: diagramKey,
      nodeId: "db",
      target: "Decision" as const,
      versionId: versionKey,
    };
    const plan = await client.previewDiagramNodeConversion(input);
    expect(records.size).toBe(0);
    expect(plan).toMatchObject({
      authorityEffect: "None",
      originLocation: { nodeId: "db", versionId: versionKey },
      record: { title: "Database", type: "Decision", workType: null },
      recordCount: 1,
      targetProject: { id: "project-1" },
      version: { kind: "Diagram Version", name: "Launch", number: 1 },
    });
    const before = structuredClone(diagrams.get(diagramKey));
    const first = await client.convertDiagramNodeToRecord({
      clientIdempotencyKey: cardKeys[1] as string,
      plan,
    });
    const retry = await client.convertDiagramNodeToRecord({
      clientIdempotencyKey: cardKeys[1] as string,
      plan,
    });
    expect(retry).toEqual(first);
    expect(records.size).toBe(1);
    expect(links.get(cardKeys[1] as string)).toEqual({
      diagramId: diagramKey,
      nodeId: "db",
      versionId: versionKey,
    });
    expect(diagrams.get(diagramKey)).toEqual(before);
  });

  test("refuses a node the exact version does not hold and a tampered plan", async () => {
    const { client } = await seed();
    await expect(
      client.previewDiagramNodeConversion({
        diagramId: diagramKey,
        nodeId: "missing",
        target: "Risk",
        versionId: versionKey,
      }),
    ).rejects.toThrow();
    const plan = await client.previewDiagramNodeConversion({
      diagramId: diagramKey,
      nodeId: "api",
      target: "Risk",
      versionId: versionKey,
    });
    await expect(
      client.convertDiagramNodeToRecord({
        clientIdempotencyKey: cardKeys[1] as string,
        plan: {
          ...plan,
          record: { ...plan.record, title: "Something else" },
        },
      }),
    ).rejects.toThrow();
  });
});

describe("Personal viewport (#425)", () => {
  const saved = { center: { x: 120, y: 40 }, collapsed: [], zoom: 1.5 };

  test("an Account's last viewport is restored per diagram and view, and writes no diagram data", async () => {
    const { client, diagrams } = createFixture();
    const diagram = await create(client, keys[0] as string);
    const before = JSON.stringify(diagrams.get(diagram.id));
    expect(
      await client.technicalDiagramViewport({ diagramId: diagram.id }),
    ).toBe(null);
    await client.saveTechnicalDiagramViewport({
      diagramId: diagram.id,
      viewport: saved,
    });
    await client.saveTechnicalDiagramViewport({
      diagramId: diagram.id,
      viewId: "view-2",
      viewport: { ...saved, zoom: 0.5 },
    });
    expect(
      await client.technicalDiagramViewport({ diagramId: diagram.id }),
    ).toEqual(saved);
    expect(
      (
        await client.technicalDiagramViewport({
          diagramId: diagram.id,
          viewId: "view-2",
        })
      )?.zoom,
    ).toBe(0.5);
    // Not content: the model, revision and view are untouched.
    expect(JSON.stringify(diagrams.get(diagram.id))).toBe(before);
  });

  test("never serves another Account's viewport", async () => {
    const { access, client } = createFixture();
    const diagram = await create(client, keys[0] as string);
    await client.saveTechnicalDiagramViewport({
      diagramId: diagram.id,
      viewport: saved,
    });
    expect(
      await access.viewport("account-2", { diagramId: diagram.id }),
    ).toEqual({ viewport: null });
  });

  test("drops collapsed ids of groups the diagram no longer has", async () => {
    const { client } = createFixture();
    const diagram = await create(client, keys[0] as string);
    const result = await client.saveTechnicalDiagramViewport({
      diagramId: diagram.id,
      viewport: { ...saved, collapsed: ["deleted-boundary"] },
    });
    expect(result.collapsed).toEqual([]);
  });

  test("rejects selection, search and out-of-range fields; unknown diagram is not found", async () => {
    const { client } = createFixture();
    const diagram = await create(client, keys[0] as string);
    await expect(
      client.saveTechnicalDiagramViewport({
        diagramId: diagram.id,
        viewport: { ...saved, search: "api" } as never,
      }),
    ).rejects.toThrow();
    await expect(
      client.saveTechnicalDiagramViewport({
        diagramId: diagram.id,
        viewport: { ...saved, zoom: 40 },
      }),
    ).rejects.toThrow();
    await expect(
      client.technicalDiagramViewport({ diagramId: "missing" }),
    ).rejects.toThrow();
  });

  test("the structural model, snapshot and export surface carry no viewport", async () => {
    const { client } = createFixture();
    const diagram = await create(client, keys[0] as string);
    await client.saveTechnicalDiagramViewport({
      diagramId: diagram.id,
      viewport: saved,
    });
    const read = await client.technicalDiagram({ diagramId: diagram.id });
    expect(JSON.stringify(read)).not.toMatch(VIEWPORT_WORDS);
  });
});
