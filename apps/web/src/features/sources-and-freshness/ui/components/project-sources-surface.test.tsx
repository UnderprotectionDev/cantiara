import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import ProjectSourcesSurface from "./project-sources-surface";

vi.mock("@/env", () => ({
  env: { VITE_SERVER_URL: "https://api.example.org" },
}));

vi.mock("@/utils/orpc", () => ({
  client: {},
  orpc: {
    projectSources: {
      queryOptions: () => ({
        queryKey: ["sources"],
        staleTime: Number.POSITIVE_INFINITY,
        queryFn: () => Promise.reject(new Error("Unexpected fetch")),
      }),
    },
  },
}));

test("saved Source access times follow the selected account timezone, locale and date format", () => {
  const cache = new QueryClient();
  cache.setQueryData(["sources"], {
    readOnly: false,
    records: [
      {
        id: "source-1",
        version: {
          title: "Research",
          url: "https://example.org/research",
          accessedAt: "2026-10-11T22:30:00Z",
          capturedContent: "Original finding",
        },
      },
    ],
  });
  const render = (preferences: AccountPreferences) =>
    renderToStaticMarkup(
      <QueryClientProvider client={cache}>
        <ProjectSourcesSurface
          preferences={preferences}
          projectId="project-1"
        />
      </QueryClientProvider>,
    );
  expect(
    render({ ...DEFAULT_ACCOUNT_PREFERENCES, dateFormat: "dd/MM/yyyy" }),
  ).toContain("12/10/2026 01:30");
  expect(
    render({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      locale: "en-US",
      timeZone: "America/New_York",
      dateFormat: "MM/dd/yyyy",
    }),
  ).toContain("10/11/2026 6:30 PM");
});
