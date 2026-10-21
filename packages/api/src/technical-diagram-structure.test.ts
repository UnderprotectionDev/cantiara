import { describe, expect, test } from "vitest";

import {
  ARCHITECTURE_NODE_KINDS,
  architectureModelSchema,
  canonicalStructuralModel,
  dataModelModelSchema,
  diagramGraph,
  emptyStructuralModel,
  parseStoredStructuralModel,
  resolveStructuralModel,
  SEQUENCE_MESSAGE_KINDS,
  StructuralModelError,
  sequenceModelSchema,
  TECHNICAL_DIAGRAM_TYPES,
} from "./technical-diagram-structure";

const SQL_STATEMENT = /CREATE TABLE|ALTER TABLE/i;

const architecture = {
  links: [
    { from: "api", kind: "Writes to", label: null, to: "db" },
    { from: "edge", kind: "Contains", label: null, to: "api" },
  ],
  nodes: [
    { id: "edge", kind: "Boundary", label: "Trust boundary" },
    { id: "api", kind: "Service", label: "API" },
    { id: "db", kind: "Datastore", label: "PostgreSQL" },
  ],
};

const dataModel = {
  relations: [
    {
      cardinality: "One to many",
      fromColumnId: "task.project",
      fromTableId: "task",
      id: "task-project",
      onDelete: "CASCADE",
      onUpdate: "NO ACTION",
      toColumnId: "project.id",
      toTableId: "project",
    },
  ],
  tables: [
    {
      columns: [
        {
          default: "gen_random_uuid()",
          id: "project.id",
          name: "id",
          nullable: false,
          primaryKey: true,
          type: "uuid",
          unique: false,
        },
      ],
      id: "project",
      indexes: [],
      name: "project",
    },
    {
      columns: [
        {
          default: null,
          id: "task.id",
          name: "id",
          nullable: false,
          primaryKey: true,
          type: "uuid",
          unique: false,
        },
        {
          default: null,
          id: "task.project",
          name: "project_id",
          nullable: false,
          primaryKey: false,
          type: "uuid",
          unique: false,
        },
      ],
      id: "task",
      indexes: [
        {
          columnIds: ["task.project"],
          id: "task-project-idx",
          name: "task_project_idx",
          unique: false,
        },
      ],
      name: "task",
    },
  ],
};

const sequence = {
  participants: [
    { bind: null, id: "founder", kind: "Actor", label: "Founder" },
    {
      bind: {
        boundLabel: "API",
        diagramId: "arch-1",
        nodeId: "api",
        versionId: null,
      },
      id: "api",
      kind: "Component",
      label: "API",
    },
    { bind: null, id: "db", kind: "Component", label: "Database" },
  ],
  steps: [
    {
      from: "founder",
      id: "m1",
      kind: "Message",
      label: "Save project",
      messageKind: "Sync",
      to: "api",
    },
    {
      condition: "valid",
      groupKind: "Alt",
      id: "g1",
      kind: "Group",
      steps: [
        {
          from: "api",
          id: "m2",
          kind: "Message",
          label: "Insert",
          messageKind: "Async",
          to: "db",
        },
      ],
    },
    {
      from: "api",
      id: "m3",
      kind: "Message",
      label: "Saved",
      messageKind: "Return",
      to: "founder",
    },
  ],
};

describe("Technical Diagram structural model", () => {
  test("keeps three independent types with their own typed model", () => {
    expect(TECHNICAL_DIAGRAM_TYPES).toEqual([
      "Technical Architecture",
      "Data Model",
      "Technical Sequence",
    ]);
    expect(emptyStructuralModel("Technical Architecture")).toEqual({
      links: [],
      nodes: [],
    });
    expect(emptyStructuralModel("Data Model")).toEqual({
      relations: [],
      tables: [],
    });
    expect(emptyStructuralModel("Technical Sequence")).toEqual({
      participants: [],
      steps: [],
    });
    expect(() =>
      resolveStructuralModel("Data Model", architecture),
    ).toThrowError(StructuralModelError);
  });

  test("golden Architecture model uses the closed catalog and typed links", () => {
    expect(ARCHITECTURE_NODE_KINDS).toEqual([
      "Component",
      "Service",
      "Datastore",
      "Queue/Event Bus",
      "External System",
      "Boundary",
    ]);
    const parsed = architectureModelSchema.parse(architecture);
    expect(canonicalStructuralModel(parsed)).toBe(
      '{"links":[{"from":"api","kind":"Writes to","label":null,"to":"db"},{"from":"edge","kind":"Contains","label":null,"to":"api"}],"nodes":[{"id":"api","kind":"Service","label":"API"},{"id":"db","kind":"Datastore","label":"PostgreSQL"},{"id":"edge","kind":"Boundary","label":"Trust boundary"}]}',
    );
    const shuffled = {
      links: [...architecture.links].reverse(),
      nodes: [...architecture.nodes].reverse(),
    };
    expect(
      canonicalStructuralModel(architectureModelSchema.parse(shuffled)),
    ).toBe(canonicalStructuralModel(parsed));
  });

  test("counterpart: BPMN, org chart and Gantt shapes are not in the catalog", () => {
    for (const kind of ["BPMN Task", "Org Unit", "Gantt Bar", "Rectangle"]) {
      expect(
        architectureModelSchema.safeParse({
          links: [],
          nodes: [{ id: "x", kind, label: "X" }],
        }).success,
      ).toBe(false);
    }
    expect(
      architectureModelSchema.safeParse({
        links: [{ from: "a", kind: "Flows to", label: null, to: "b" }],
        nodes: [
          { id: "a", kind: "Component", label: "A" },
          { id: "b", kind: "Component", label: "B" },
        ],
      }).success,
    ).toBe(false);
  });

  test("rejects broken Architecture links and misplaced containment", () => {
    const nodes = [
      { id: "a", kind: "Service", label: "A" },
      { id: "b", kind: "Service", label: "B" },
    ];
    const attempt = (links: unknown[]) =>
      architectureModelSchema.safeParse({ links, nodes }).success;
    expect(attempt([{ from: "a", kind: "Calls", to: "missing" }])).toBe(false);
    expect(attempt([{ from: "a", kind: "Calls", to: "a" }])).toBe(false);
    expect(attempt([{ from: "a", kind: "Contains", to: "b" }])).toBe(false);
    expect(
      attempt([
        { from: "a", kind: "Calls", to: "b" },
        { from: "a", kind: "Calls", to: "b" },
      ]),
    ).toBe(false);
  });

  test("Architecture nodes are not a CMDB master record", () => {
    expect(
      architectureModelSchema.safeParse({
        links: [],
        nodes: [
          {
            id: "a",
            kind: "Service",
            label: "A",
            owner: "team-x",
            serviceCatalogId: "svc-1",
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("golden Data Model is a designed PostgreSQL schema", () => {
    const parsed = dataModelModelSchema.parse(dataModel);
    expect(parsed.tables.map(({ name }) => name)).toEqual(["project", "task"]);
    expect(parsed.relations[0]).toMatchObject({
      cardinality: "One to many",
      onDelete: "CASCADE",
      onUpdate: "NO ACTION",
    });
    expect(parsed.tables[0]?.columns[0]).toMatchObject({
      default: "gen_random_uuid()",
      nullable: false,
      primaryKey: true,
      type: "uuid",
    });
    expect(parsed.tables[1]?.indexes[0]?.columnIds).toEqual(["task.project"]);
  });

  test("counterpart: Data Model emits no SQL and takes no DDL, DBML or ORM source", () => {
    expect(JSON.stringify(dataModelModelSchema.parse(dataModel))).not.toMatch(
      SQL_STATEMENT,
    );
    for (const extra of [
      { ddl: "CREATE TABLE t ();" },
      { dbml: "Table t {}" },
      { drizzleSchemaFile: "schema.ts" },
      { databaseUrl: "postgres://live" },
    ]) {
      expect(
        dataModelModelSchema.safeParse({ ...dataModel, ...extra }).success,
      ).toBe(false);
    }
    expect(
      dataModelModelSchema.safeParse({ relations: [], tables: "CREATE TABLE" })
        .success,
    ).toBe(false);
  });

  test("validates Data Model keys, types, nullability and referential actions", () => {
    const withColumn = (patch: Record<string, unknown>) => ({
      ...dataModel,
      tables: dataModel.tables.map((table) =>
        table.id === "task"
          ? {
              ...table,
              columns: table.columns.map((column) =>
                column.id === "task.project" ? { ...column, ...patch } : column,
              ),
            }
          : table,
      ),
    });
    expect(
      dataModelModelSchema.safeParse(withColumn({ type: "varchar(40)" }))
        .success,
    ).toBe(false);
    expect(
      dataModelModelSchema.safeParse(withColumn({ type: "mysql_tinyint" }))
        .success,
    ).toBe(false);
    expect(
      dataModelModelSchema.safeParse({
        ...dataModel,
        relations: [{ ...dataModel.relations[0], onDelete: "SET NULL" }],
      }).success,
    ).toBe(false);
    expect(
      dataModelModelSchema.safeParse(
        withColumn({ nullable: true, primaryKey: true }),
      ).success,
    ).toBe(false);
    expect(
      dataModelModelSchema.safeParse({
        ...dataModel,
        relations: [{ ...dataModel.relations[0], toColumnId: "missing" }],
      }).success,
    ).toBe(false);
  });

  test("golden Technical Sequence keeps participants, message kinds and control groups", () => {
    expect(SEQUENCE_MESSAGE_KINDS).toEqual([
      "Sync",
      "Async",
      "Event",
      "Return",
    ]);
    const parsed = sequenceModelSchema.parse(sequence);
    expect(parsed.participants.map(({ id }) => id)).toEqual([
      "founder",
      "api",
      "db",
    ]);
    expect(parsed.steps.map(({ kind }) => kind)).toEqual([
      "Message",
      "Group",
      "Message",
    ]);
    expect(diagramGraph(parsed).links.map(({ id }) => id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
    // Step order is part of the meaning and survives canonical serialization.
    expect(JSON.parse(canonicalStructuralModel(parsed)).steps[0].id).toBe("m1");
  });

  test("lifeline bind is exact and never retargets to a new version", () => {
    const parsed = sequenceModelSchema.parse(sequence);
    expect(parsed.participants[1]?.bind).toEqual({
      boundLabel: "API",
      diagramId: "arch-1",
      nodeId: "api",
      versionId: null,
    });
    // Rewriting the Architecture does not touch the Sequence model.
    architectureModelSchema.parse({
      ...architecture,
      nodes: architecture.nodes.filter(({ id }) => id !== "api"),
      links: [],
    });
    expect(sequenceModelSchema.parse(sequence)).toEqual(parsed);
    expect(
      sequenceModelSchema.safeParse({
        ...sequence,
        participants: [
          {
            ...sequence.participants[1],
            bind: { diagramId: "arch-1", nodeId: "api", boundLabel: "API" },
          },
          ...sequence.participants.filter(({ id }) => id !== "api"),
        ],
      }).success,
    ).toBe(true);
  });

  test("counterpart: Sequence is not a User Flow, Work-status transition, log, trace or incident timeline", () => {
    for (const kind of ["Decision", "Screen", "Status Change", "Log Line"]) {
      expect(
        sequenceModelSchema.safeParse({
          ...sequence,
          steps: [
            {
              from: "founder",
              id: "x",
              kind: "Message",
              label: "x",
              messageKind: kind,
              to: "api",
            },
          ],
        }).success,
      ).toBe(false);
    }
    for (const extra of [
      { traceId: "abc" },
      { timestamp: "2026-10-21T00:00:00Z" },
      { incidentId: "inc-1" },
      { workStatus: "Doing" },
      { screenId: "login" },
    ]) {
      expect(
        sequenceModelSchema.safeParse({
          ...sequence,
          steps: [{ ...sequence.steps[0], ...extra }],
        }).success,
      ).toBe(false);
    }
    expect(
      sequenceModelSchema.safeParse({
        ...sequence,
        steps: [
          {
            condition: "x",
            groupKind: "Parallel",
            id: "g",
            kind: "Group",
            steps: [sequence.steps[0]],
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("rejects unknown participants, orphan returns and nested groups", () => {
    const attempt = (steps: unknown[]) =>
      sequenceModelSchema.safeParse({ ...sequence, steps }).success;
    expect(attempt([{ ...sequence.steps[0], id: "x", to: "ghost" }])).toBe(
      false,
    );
    expect(
      attempt([
        {
          from: "api",
          id: "r",
          kind: "Message",
          label: "Saved",
          messageKind: "Return",
          to: "founder",
        },
      ]),
    ).toBe(false);
    expect(
      attempt([
        {
          condition: "x",
          groupKind: "Loop",
          id: "outer",
          kind: "Group",
          steps: [
            {
              condition: "y",
              groupKind: "Opt",
              id: "inner",
              kind: "Group",
              steps: [sequence.steps[0]],
            },
          ],
        },
      ]),
    ).toBe(false);
  });

  test("a stored legacy empty model reads as an empty model of its own type", () => {
    expect(
      parseStoredStructuralModel("Data Model", { links: [], nodes: [] }),
    ).toEqual({ relations: [], tables: [] });
    expect(
      parseStoredStructuralModel("Technical Sequence", {
        links: [],
        nodes: [],
      }),
    ).toEqual({ participants: [], steps: [] });
    expect(parseStoredStructuralModel("Data Model", architecture)).toBeNull();
  });

  test("counterpart: Mermaid text, SQL and DSL are not canonical input", () => {
    for (const type of TECHNICAL_DIAGRAM_TYPES) {
      for (const source of [
        "graph TD\nA --> B",
        "CREATE TABLE a (id uuid);",
        "Table a { id uuid }",
        { dsl: "A -> B" },
        { mermaid: "graph TD" },
      ]) {
        expect(() => resolveStructuralModel(type, source)).toThrowError(
          StructuralModelError,
        );
      }
    }
  });

  test("coordinates are view metadata, not part of any model", () => {
    expect(
      architectureModelSchema.safeParse({
        ...architecture,
        nodes: architecture.nodes.map((node) => ({ ...node, x: 1, y: 2 })),
      }).success,
    ).toBe(false);
    expect(
      dataModelModelSchema.safeParse({ ...dataModel, layout: {} }).success,
    ).toBe(false);
  });

  test("counterpart: Wireframe object language is not reused", () => {
    for (const kind of ["Button", "Input", "Screen", "Frame", "Text"]) {
      expect(
        architectureModelSchema.safeParse({
          links: [],
          nodes: [{ id: "w", kind, label: "W" }],
        }).success,
      ).toBe(false);
    }
  });
});
