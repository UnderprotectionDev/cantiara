import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import DocumentPreview from "./document-preview";

const ignoreLiveWorkAction = () => undefined;

test("renders CRLF Mermaid fences as Mermaid previews", () => {
  const source = "```mermaid\r\ngraph TD; A-->B;\r\n```\r\n";
  const markup = renderToStaticMarkup(<DocumentPreview source={source} />);

  expect(markup).toContain(
    "<code>```mermaid\ngraph TD; A--&gt;B;\r\n```</code>",
  );
});

test("renders stable section ids and explains when a targeted section is missing", () => {
  const markup = renderToStaticMarkup(
    <DocumentPreview
      source={"## Release readiness {#release-gate}\n\nConfirm the launch."}
      targetSectionId="release-gate"
    />,
  );
  const missingMarkup = renderToStaticMarkup(
    <DocumentPreview
      source="## Another section {#other}"
      targetSectionId="deleted"
    />,
  );

  expect(markup).toContain('<h2 id="release-gate">Release readiness</h2>');
  expect(markup).not.toContain("{#release-gate}");
  expect(missingMarkup).toContain("This section is missing.");
});

test("renders current live Work fields and a safe broken target", () => {
  const markup = renderToStaticMarkup(
    <DocumentPreview
      liveWorkBlocks={[
        {
          workId: "work-1",
          source: {
            id: "work-1",
            projectId: "project-1",
            key: "PRO-1",
            title: "Current title",
            type: "Task",
            status: "In Progress",
            plannedStartDate: null,
            priority: [{ name: "Impact", rank: "High" }],
            targetDate: null,
          },
        },
        { workId: "missing", source: null },
      ]}
      onLiveWorkAction={ignoreLiveWorkAction}
      source={':::live-work{workId="work-1"}\n\n:::live-work{workId="missing"}'}
    />,
  );

  expect(markup).toContain("Live Work block");
  expect(markup).toContain("Current title");
  expect(markup).toContain("In Progress");
  expect(markup).toContain("Priority metrics: Impact: High");
  expect(markup).toContain("Open source record");
  expect(markup).toContain("Change status");
  expect(markup).toContain("Close");
  expect(markup).toContain("Source record is unavailable.");
  expect(markup).not.toContain("missing</");
});

test("renders named collection and Diagram View blocks from their resolved sources", () => {
  const markup = renderToStaticMarkup(
    <DocumentPreview
      liveOtherBlocks={[
        {
          id: "view-1",
          kind: "Smart Collection",
          viewId: null,
          source: {
            id: "view-1",
            collectionId: "collection-1",
            collectionName: "Active Work",
            isSubscribed: false,
            name: "Current list",
            notifyOnLeave: false,
            presentation: "List",
            projectId: "project-1",
            conditions: {},
            sourceType: "Work",
            scope: { projectIds: ["project-1"] },
            workspaceId: "workspace-1",
            documents: [],
            projectSourceRecords: [],
            works: [
              {
                createdAt: "2026-10-01T09:00:00.000Z",
                effort: null,
                id: "work-1",
                key: "PRO-1",
                title: "Current Work",
                status: "In Progress",
                statusChangedAt: "2026-10-02T09:00:00.000Z",
                type: "Task",
                projectId: "project-1",
                membershipReasons: ["Project: Product project"],
              },
            ],
          },
        },
        {
          id: "diagram-1",
          kind: "Technical Diagram",
          viewId: "view-2",
          source: {
            id: "diagram-1",
            title: "Architecture",
            projectId: "project-1",
            type: "Technical Architecture",
            authorityMode: "Imported Independent Copy",
            model: {
              nodes: [{ id: "api", label: "API", kind: "Component" }],
              links: [],
            },
            view: { id: "view-2", name: "Services", selectedNodeIds: ["api"] },
          },
        },
      ]}
      source={
        ':::live-collection{viewId="view-1"}\n\n:::live-diagram{diagramId="diagram-1" viewId="view-2"}'
      }
    />,
  );
  expect(markup).toContain("Current Work");
  expect(markup).toContain("Membership reason:");
  expect(markup).toContain("Project: Product project");
  expect(markup).toContain("Services");
  expect(markup).toContain("API");
  expect(markup).toContain("Open source record");
});

test("renders Document and Project source members with live membership reasons", () => {
  const markup = renderToStaticMarkup(
    <DocumentPreview
      liveOtherBlocks={[
        {
          id: "document-view",
          kind: "Smart Collection",
          viewId: null,
          source: {
            id: "document-view",
            collectionId: "document-collection",
            collectionName: "Launch documents",
            isSubscribed: false,
            name: "Specs",
            notifyOnLeave: false,
            presentation: "Table",
            projectId: "project-1",
            conditions: { documentType: "Spec", tag: "launch" },
            sourceType: "Document",
            scope: { projectIds: ["project-1"] },
            workspaceId: "workspace-1",
            works: [],
            projectSourceRecords: [],
            documents: [
              {
                id: "document-1",
                title: "Launch specification",
                type: "Spec",
                projectId: "project-1",
                workspaceId: null,
                membershipReasons: [
                  "Project: Product project",
                  "Document type: Spec",
                  "Tag: launch",
                ],
              },
            ],
          },
        },
        {
          id: "risk-view",
          kind: "Smart Collection",
          viewId: null,
          source: {
            id: "risk-view",
            collectionId: "risk-collection",
            collectionName: "Open risks",
            isSubscribed: false,
            name: "Mitigating",
            notifyOnLeave: false,
            presentation: "List",
            projectId: "project-1",
            conditions: { status: "Mitigating" },
            sourceType: "Risk",
            scope: { projectIds: ["project-1"] },
            workspaceId: "workspace-1",
            works: [],
            documents: [],
            projectSourceRecords: [
              {
                id: "risk-1",
                title: "Partner API delay",
                status: "Mitigating",
                projectId: "project-1",
                sourceType: "Risk",
                membershipReasons: [
                  "Project: Product project",
                  "Status: Mitigating",
                ],
              },
            ],
          },
        },
      ]}
      source={
        ':::live-collection{viewId="document-view"}\n\n:::live-collection{viewId="risk-view"}'
      }
    />,
  );

  expect(markup).toContain("Launch specification");
  expect(markup).toContain("Document type: Spec");
  expect(markup).toContain("Tag: launch");
  expect(markup).toContain("Partner API delay");
  expect(markup).toContain("Status: Mitigating");
});
