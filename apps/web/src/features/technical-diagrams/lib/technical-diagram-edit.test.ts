import {
  architectureModelSchema,
  dataModelModelSchema,
  emptyStructuralModel,
  sequenceModelSchema,
} from "@cantiara/api/technical-diagram-structure";
import { describe, expect, test } from "vitest";

import {
  addArchitectureLink,
  addArchitectureNode,
  addColumn,
  addControlGroup,
  addMessage,
  addParticipant,
  addRelation,
  addTable,
  removeArchitectureNode,
  removeParticipant,
} from "./technical-diagram-edit";

describe("Technical Diagram model edits", () => {
  test("builds a valid Architecture model and drops links with a removed node", () => {
    let model = emptyStructuralModel("Technical Architecture");
    model = addArchitectureNode(model, { kind: "Service", label: "API" });
    model = addArchitectureNode(model, { kind: "Datastore", label: "DB" });
    const [api, db] = model.nodes;
    model = addArchitectureLink(model, {
      from: api?.id ?? "",
      kind: "Writes to",
      to: db?.id ?? "",
    });
    expect(architectureModelSchema.safeParse(model).success).toBe(true);
    expect(removeArchitectureNode(model, db?.id ?? "").links).toEqual([]);
  });

  test("builds a valid Data Model with a key relation", () => {
    let model = emptyStructuralModel("Data Model");
    model = addTable(model, "project");
    model = addTable(model, "task");
    const [project, task] = model.tables;
    model = addColumn(model, task?.id ?? "", {
      default: null,
      name: "project_id",
      nullable: false,
      primaryKey: false,
      type: "uuid",
      unique: false,
    });
    const taskColumn = model.tables[1]?.columns[1];
    model = addRelation(model, {
      cardinality: "One to many",
      fromColumnId: taskColumn?.id ?? "",
      fromTableId: task?.id ?? "",
      onDelete: "CASCADE",
      onUpdate: "NO ACTION",
      toColumnId: project?.columns[0]?.id ?? "",
      toTableId: project?.id ?? "",
    });
    expect(dataModelModelSchema.safeParse(model).success).toBe(true);
  });

  test("builds a valid Sequence with a control group and removes a lifeline with its messages", () => {
    let model = emptyStructuralModel("Technical Sequence");
    model = addParticipant(model, { bind: null, kind: "Actor", label: "User" });
    model = addParticipant(model, {
      bind: null,
      kind: "Component",
      label: "API",
    });
    const [user, api] = model.participants;
    const call = {
      from: user?.id ?? "",
      label: "Open",
      messageKind: "Sync" as const,
      to: api?.id ?? "",
    };
    model = addMessage(model, call);
    model = addControlGroup(
      model,
      { condition: "cached", groupKind: "Alt" },
      { ...call, label: "Read cache", messageKind: "Async" },
    );
    expect(sequenceModelSchema.safeParse(model).success).toBe(true);
    expect(removeParticipant(model, api?.id ?? "").steps).toEqual([]);
  });
});
