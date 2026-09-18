import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { accountPreferencesQueryOptions, orpc } from "@/utils/orpc";

import SessionsView from "./sessions-view";

describe("Sessions view", () => {
  test("exposes the accessible session journey without exposing a token", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(orpc.sessions.queryOptions().queryKey, [
      {
        current: true,
        device: "Safari on macOS",
        id: "current-session",
        lastActivityAt: "2026-09-16T09:00:00.000Z",
      },
      {
        current: false,
        device: "Safari on iPhone",
        id: "other-session",
        lastActivityAt: "2026-09-16T08:00:00.000Z",
      },
    ]);
    queryClient.setQueryData(
      accountPreferencesQueryOptions("account-1").queryKey,
      {
        ...DEFAULT_ACCOUNT_PREFERENCES,
        isSaved: true,
        revision: 1,
        savedAt: "2026-09-16T09:00:00.000Z",
        locale: "tr-TR",
        timeZone: "Europe/London",
      },
    );
    queryClient.setQueryData(orpc.webCaptureLinks.queryOptions().queryKey, [
      {
        browser: "Firefox",
        createdAt: "2026-09-16T07:00:00.000Z",
        device: "Founder Mac",
        id: "link-1",
        lastUse: "2026-09-16T08:30:00.000Z",
      },
    ]);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <SessionsView accountId="account-1" />
      </QueryClientProvider>,
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Sessions</h1>");
    expect(html).toContain("Current");
    expect(html).toContain("Revoke Session");
    expect(html).toContain("Revoke Other Sessions");
    expect(html).toContain("<time");
    expect(html).toContain('dateTime="2026-09-16T09:00:00.000Z"');
    expect(html).toContain("16 Eyl 2026 10:00");
    expect(html).toContain("Extension links");
    expect(html).toContain("Generate pairing code");
    expect(html).toContain("Browser: Firefox");
    expect(html).toContain("Last use");
    expect(html).toContain("Revoke");
    expect(html).not.toContain("session-secret");
    expect(html).not.toContain("extension-token");
  });
});
