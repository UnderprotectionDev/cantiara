import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import ProjectSourceRecordView from "./project-source-record-view";

const mocks = vi.hoisted(() => ({
  sourceInput: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.useQuery }));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    projectSourceRecord: {
      queryOptions: ({ input }: { input: unknown }) => {
        mocks.sourceInput(input);
        return { queryKey: ["projectSourceRecord", input] };
      },
    },
  },
}));

const incident = {
  createdAt: "2026-09-27T10:00:00.000Z",
  detectedHow: "Support reports.",
  id: "incident/1",
  impact: "Requests were delayed.",
  learning: "Keep the queue visible.",
  occurredAt: "2026-09-27T09:30:00.000Z",
  projectId: "project-1",
  resolution: "Restarted the worker pool.",
  revision: 2,
  rootCause: "A worker stopped acknowledging messages.",
  sourceType: "Production Incident",
  status: "Resolved",
  title: "Queue delay",
  updatedAt: "2026-09-27T10:00:00.000Z",
};

describe("Project source record detail", () => {
  afterEach(() => {
    mocks.sourceInput.mockReset();
    mocks.useQuery.mockReset();
  });

  test("opens the selected typed source record as a read-only detail", () => {
    mocks.useQuery.mockReturnValue({ data: incident, isError: false });

    const html = renderToStaticMarkup(
      <ProjectSourceRecordView
        projectId="project-1"
        sourceId="incident/1"
        sourceType="Production Incident"
      />,
    );

    expect(mocks.sourceInput).toHaveBeenCalledWith({
      sourceId: "incident/1",
      sourceType: "Production Incident",
    });
    expect(html).toContain("Queue delay");
    expect(html).toContain("Resolved");
    expect(html).toContain("Requests were delayed.");
    expect(html).toContain("A worker stopped acknowledging messages.");
    expect(html).not.toContain("<button");
  });

  test("does not render a source record in a different Project route", () => {
    mocks.useQuery.mockReturnValue({ data: incident, isError: false });

    const html = renderToStaticMarkup(
      <ProjectSourceRecordView
        projectId="other-project"
        sourceId="incident/1"
        sourceType="Production Incident"
      />,
    );

    expect(html).toContain("Source record is unavailable.");
    expect(html).not.toContain("Queue delay");
  });
});
