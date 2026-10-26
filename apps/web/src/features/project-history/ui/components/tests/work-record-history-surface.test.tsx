import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import WorkRecordHistorySurface from "../work-record-history-surface";

vi.mock("@/env", () => ({
  env: { VITE_SERVER_URL: "https://api.example.org" },
}));

const NEVER = () => Promise.reject(new Error("Unexpected fetch"));

vi.mock("@/utils/orpc", () => ({
  client: {},
  orpc: {
    projectActivity: {
      infiniteOptions: () => ({
        getNextPageParam: () => undefined,
        initialPageParam: undefined,
        queryFn: NEVER,
        queryKey: ["activity"],
        staleTime: Number.POSITIVE_INFINITY,
      }),
    },
    projectStoryTimeline: {
      queryOptions: () => ({
        queryFn: NEVER,
        queryKey: ["story"],
        staleTime: Number.POSITIVE_INFINITY,
      }),
    },
    work: {
      queryOptions: () => ({
        queryFn: NEVER,
        queryKey: ["work"],
        staleTime: Number.POSITIVE_INFINITY,
      }),
    },
  },
}));

function render(type: string) {
  const cache = new QueryClient();
  cache.setQueryData(["work"], { id: "w1", type });
  cache.setQueryData(["activity"], {
    pageParams: [undefined],
    pages: [
      {
        entries: [],
        nextCursor: null,
        projectId: "p1",
        rows: [],
        sources: [],
        unattributed: [],
        windowReached: false,
      },
    ],
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={cache}>
      <WorkRecordHistorySurface projectId="p1" workId="w1" />
    </QueryClientProvider>,
  );
}

test("every Work shows its Record history", () => {
  expect(render("Task")).toContain("Record history");
});

test("the Feature Story Timeline is requested only for a Feature-type Work", () => {
  expect(render("Task")).not.toContain("Story Timeline");
  expect(render("Feature")).toContain("Loading Story Timeline");
});
