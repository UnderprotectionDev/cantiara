import { describe, expect, test } from "vitest";
import { previewSmartCollectionMembership } from "./smart-collection-membership-preview";

describe("Smart Collection membership preview", () => {
  test("previews the direct Work field changes for an in-scope Work", () => {
    expect(
      previewSmartCollectionMembership(
        {
          sourceType: "Work",
          projectId: "project-b",
          workspaceId: "workspace-a",
          status: "Not Started",
          workType: "Bug",
        },
        {
          sourceType: "Work",
          workspaceId: "workspace-a",
          scope: { projectIds: ["project-a", "project-b"] },
          conditions: { status: "In Progress", type: "Task" },
        },
      ),
    ).toEqual([
      { field: "Status", from: "Not Started", to: "In Progress" },
      { field: "Work type", from: "Bug", to: "Task" },
    ]);
  });

  test("does not preview records outside the target scope or source type", () => {
    const view = {
      sourceType: "Work" as const,
      workspaceId: "workspace-a",
      scope: { projectIds: ["project-a"] },
      conditions: { status: "In Progress" as const },
    };

    expect(
      previewSmartCollectionMembership(
        {
          sourceType: "Work",
          projectId: "project-b",
          workspaceId: "workspace-a",
          status: "Not Started",
        },
        view,
      ),
    ).toBeNull();
    expect(
      previewSmartCollectionMembership(
        {
          sourceType: "Document",
          projectId: "project-a",
          workspaceId: "workspace-a",
          documentType: "Spec",
        },
        view,
      ),
    ).toBeNull();
  });

  test("does not suggest an incomplete Document change when a Tag also differs", () => {
    expect(
      previewSmartCollectionMembership(
        {
          sourceType: "Document",
          projectId: "project-a",
          workspaceId: "workspace-a",
          documentType: "Research Note",
        },
        {
          sourceType: "Document",
          workspaceId: "workspace-a",
          scope: { projectIds: ["project-a"] },
          conditions: { documentType: "Spec", tag: "launch" },
        },
      ),
    ).toBeNull();
  });

  test("keeps Wiki Document previews inside the owning Workspace", () => {
    const view = {
      sourceType: "Wiki Document" as const,
      workspaceId: "workspace-a",
      scope: { projectIds: [] },
      conditions: { documentType: "Spec" as const },
    };

    expect(
      previewSmartCollectionMembership(
        {
          sourceType: "Wiki Document",
          projectId: null,
          workspaceId: "workspace-b",
          documentType: "Research Note",
        },
        view,
      ),
    ).toBeNull();
    expect(
      previewSmartCollectionMembership(
        {
          sourceType: "Wiki Document",
          projectId: null,
          workspaceId: "workspace-a",
          documentType: "Research Note",
        },
        view,
      ),
    ).toEqual([{ field: "Document type", from: "Research Note", to: "Spec" }]);
  });
});
