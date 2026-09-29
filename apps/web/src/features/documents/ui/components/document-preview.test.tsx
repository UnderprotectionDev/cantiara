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
            name: "Current list",
            presentation: "List",
            projectId: "project-1",
            works: [
              {
                id: "work-1",
                key: "PRO-1",
                title: "Current Work",
                status: "In Progress",
                type: "Task",
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
  expect(markup).toContain("Services");
  expect(markup).toContain("API");
  expect(markup).toContain("Open source record");
});
