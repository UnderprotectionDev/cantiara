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
