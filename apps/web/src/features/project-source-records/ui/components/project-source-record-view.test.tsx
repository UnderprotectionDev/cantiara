import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import ProjectSourceRecordView from "./project-source-record-view";

const mocks = vi.hoisted(() => ({
  reminderInput: vi.fn(),
  sourceInput: vi.fn(),
  useMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    personalReminders: {
      queryOptions: ({ input }: { input: unknown }) => {
        mocks.reminderInput(input);
        return { queryKey: ["personalReminders", input] };
      },
    },
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
    mocks.reminderInput.mockReset();
    mocks.sourceInput.mockReset();
    mocks.useQuery.mockReset();
  });

  test("opens the selected typed source record with personal reminder actions", () => {
    mocks.useQuery
      .mockReturnValueOnce({ data: incident, isError: false })
      .mockReturnValueOnce({ data: [], isError: false, isPending: false });

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
    expect(mocks.reminderInput).toHaveBeenCalledWith({
      sourceRecordId: "incident/1",
      sourceRecordType: "Production Incident",
    });
    expect(html).toContain("Queue delay");
    expect(html).toContain("Resolved");
    expect(html).toContain("Requests were delayed.");
    expect(html).toContain("A worker stopped acknowledging messages.");
    expect(html).toContain("Remind me");
    expect(html).toContain("Review Later");
  });

  test("omits reminder actions when a source record is shown read-only", () => {
    mocks.useQuery.mockReturnValue({ data: incident, isError: false });

    const html = renderToStaticMarkup(
      <ProjectSourceRecordView
        projectId="project-1"
        readOnly
        sourceId="incident/1"
        sourceType="Production Incident"
      />,
    );

    expect(html).toContain("Queue delay");
    expect(html).not.toContain("Remind me");
    expect(html).not.toContain("Review Later");
    expect(mocks.reminderInput).not.toHaveBeenCalled();
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
