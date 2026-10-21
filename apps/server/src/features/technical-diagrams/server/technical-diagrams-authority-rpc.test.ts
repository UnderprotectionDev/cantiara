import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import {
  assertPreviewedConversion,
  previewAuthorityConversion,
} from "@cantiara/api/technical-diagram-authority";
import {
  emptyStructuralModel,
  resolveStructuralModel,
  StructuralModelError,
} from "@cantiara/api/technical-diagram-structure";
import type {
  TechnicalDiagramSource,
  TechnicalDiagramsAccess,
} from "@cantiara/api/technical-diagrams";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

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
      const created: TechnicalDiagramSource = {
        authorityMode: input.authorityMode,
        externalSource:
          input.authorityMode === "External Source Link"
            ? input.externalSource
            : null,
        id: input.clientIdempotencyKey,
        model:
          input.authorityMode === "Product-authored Model"
            ? (input.model ?? emptyStructuralModel(input.type))
            : emptyStructuralModel(input.type),
        origins: [],
        projectId: input.projectId,
        title: input.title,
        type: input.type,
        view: null,
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
      diagram.model = resolveStructuralModel(diagram.type, input.model);
      return Promise.resolve(present(diagram.id));
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
  return { client: createRouterClient(appRouter, { context }), diagrams };
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
