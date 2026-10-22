// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noAwaitInLoops: Timers must settle one after another.

import {
  GITHUB_APP_PERMISSIONS,
  GITHUB_CONTENTS_REASON,
  type GitHubOverview,
  type GitHubRepositoryLink,
} from "@cantiara/api/github-integration";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import {
  type GitHubIntegrationActions,
  GitHubIntegrationView,
} from "../github-integration-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const WORK_CONTROL = /create work|convert|confirm/i;
const WRITE_WORDS = /\bwrite\b/i;

const connected: GitHubRepositoryLink = {
  accountLogin: "acme",
  connection: "Connected",
  disconnectedAt: null,
  externalRecordCount: 3,
  htmlUrl: "https://github.com/new-co/site",
  id: "link-1",
  installationId: 900,
  linkedAt: "2026-10-01T09:00:00.000Z",
  name: "site",
  owner: "new-co",
  previousNames: [
    { name: "web", observedAt: "2026-10-02T09:00:00.000Z", owner: "acme" },
  ],
  pauseReason: null,
  projectId: "p1",
  repositoryId: 11,
  stopReason: null,
  sync: {
    firstSyncOverdue: false,
    lastError: null,
    lastErrorAt: null,
    lastSuccessAt: "2026-10-03T09:00:00.000Z",
    outOfDate: false,
    rateLimitedUntil: null,
  },
  triage: "Pending",
};

function overviewOf(
  links: GitHubRepositoryLink[],
  overrides: Partial<GitHubOverview> = {},
): GitHubOverview {
  return {
    app: {
      configured: true,
      contentsReason: GITHUB_CONTENTS_REASON,
      permissions: GITHUB_APP_PERMISSIONS.map(({ access, permission }) => ({
        access,
        permission,
      })),
    },
    installations: [
      {
        accountLogin: "acme",
        id: "inst-1",
        installationId: 900,
        removedAt: null,
      },
    ],
    links,
    projectId: "p1",
    readOnly: false,
    ...overrides,
  };
}

function actionsOf(
  overrides: Partial<GitHubIntegrationActions> = {},
): GitHubIntegrationActions {
  return {
    loadRepositories: vi.fn().mockResolvedValue([
      {
        fullName: "acme/api",
        htmlUrl: "https://github.com/acme/api",
        linked: false,
        name: "api",
        owner: "acme",
        private: false,
        repositoryId: 12,
      },
      {
        fullName: "new-co/site",
        htmlUrl: "https://github.com/new-co/site",
        linked: true,
        name: "site",
        owner: "new-co",
        private: false,
        repositoryId: 11,
      },
    ]),
    loadPreview: vi
      .fn()
      .mockImplementation((action: "Disconnect" | "Reconnect") =>
        Promise.resolve({
          action,
          affected: { issues: 2, pullRequests: 1, repository: "new-co/site" },
          effects: ["Nothing is written to GitHub."],
          link: connected,
        }),
      ),
    loadTriage: vi.fn().mockResolvedValue({
      groups: [
        {
          key: "open:v1",
          label: "Open, milestone v1",
          records: [
            {
              githubId: 1,
              htmlUrl: "https://github.com/new-co/site/issues/1",
              id: "r1",
              kind: "Issue",
              labels: [],
              lifecycle: "Active",
              linkId: "link-1",
              milestone: "v1",
              needsReconcile: false,
              number: 1,
              origin: null,
              projectId: "p1",
              sourceState: "open",
              sourceUpdatedAt: "2026-09-30T10:00:00.000Z",
              title: "Checkout fails",
            },
          ],
        },
      ],
      linkId: "link-1",
      writesWork: false,
    }),
    onDisconnect: vi.fn().mockResolvedValue(undefined),
    onLink: vi.fn().mockResolvedValue(undefined),
    onReconnect: vi.fn().mockResolvedValue(undefined),
    onSearch: vi.fn().mockResolvedValue([]),
    onSkipTriage: vi.fn().mockResolvedValue(undefined),
    onStartInstall: vi.fn().mockResolvedValue(undefined),
    onSyncNow: vi.fn().mockResolvedValue({
      applied: 2,
      outcome: "ran",
      restoredDiffs: [],
      stale: 0,
    }),
    ...overrides,
  };
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

async function settle() {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function mount(
  overview: GitHubOverview,
  actions: GitHubIntegrationActions = actionsOf(),
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <GitHubIntegrationView actions={actions} overview={overview} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await settle();
  });
  return actions;
}

function buttonNamed(name: string) {
  const match = [...(host?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent === name,
  );
  if (!match) {
    throw new Error(`No button ${name}`);
  }
  return match;
}

test("shows the read-only permission set and why Contents is requested", async () => {
  await mount(overviewOf([]));
  const text = host?.textContent ?? "";
  expect(text).toContain("GitHub App permissions");
  for (const { permission } of GITHUB_APP_PERMISSIONS) {
    expect(text).toContain(`${permission}: read`);
  }
  expect(text).toContain("Why Contents: read");
  expect(text).toContain(GITHUB_CONTENTS_REASON);
  expect(host?.querySelector("ul")?.textContent ?? "").not.toMatch(WRITE_WORDS);
  expect(buttonNamed("Install GitHub App").disabled).toBe(false);
});

test("starts the install and offers Repositories by stable id, hiding linked ones", async () => {
  const actions = await mount(overviewOf([connected]));
  await act(async () => {
    buttonNamed("Install GitHub App").click();
    await settle();
  });
  expect(actions.onStartInstall).toHaveBeenCalledTimes(1);
  const select = host?.querySelector("#github-repository") as HTMLSelectElement;
  expect(
    [...select.options].map((option) => [option.value, option.textContent]),
  ).toEqual([
    ["", "Choose a Repository"],
    ["12", "acme/api"],
  ]);
  expect(
    host?.querySelector('label[for="github-repository"]')?.textContent,
  ).toBe("Repository");
});

test("lists a renamed link once with its earlier name and exact action labels", async () => {
  const actions = await mount(overviewOf([connected]));
  const text = host?.textContent ?? "";
  expect(text).toContain("new-co/site");
  expect(text).toContain("Formerly acme/web");
  expect(text).toContain("Status: Connected");
  expect(host?.querySelectorAll("h4 a")).toHaveLength(1);
  await act(async () => {
    buttonNamed("Disconnect").click();
    await settle();
  });
  expect(actions.loadPreview).toHaveBeenCalledWith("Disconnect", "link-1");
  expect(host?.textContent).toContain(
    "Affects new-co/site: 2 Issues and 1 Pull requests.",
  );
  expect(actions.onDisconnect).not.toHaveBeenCalled();
  await act(async () => {
    buttonNamed("Confirm Disconnect").click();
    await settle();
  });
  expect(actions.onDisconnect).toHaveBeenCalledWith("link-1");
  expect(host?.querySelector('[role="status"]')?.textContent).toBe(
    "Disconnected.",
  );
});

test("shows the stop reason and Reconnect for an uninstalled App without any login control", async () => {
  const actions = await mount(
    overviewOf(
      [
        {
          ...connected,
          connection: "Disconnected",
          stopReason: "App uninstalled",
        },
      ],
      {
        installations: [
          {
            accountLogin: "acme",
            id: "inst-1",
            installationId: 900,
            removedAt: "2026-10-03T09:00:00.000Z",
          },
        ],
      },
    ),
  );
  const text = host?.textContent ?? "";
  expect(text).toContain("Status: Disconnected, App uninstalled");
  expect(text).toContain("GitHub App on acme, uninstalled");
  await act(async () => {
    buttonNamed("Reconnect").click();
    await settle();
  });
  expect(actions.onReconnect).not.toHaveBeenCalled();
  await act(async () => {
    buttonNamed("Confirm Reconnect").click();
    await settle();
  });
  expect(actions.onReconnect).toHaveBeenCalledWith("link-1");
  expect(text).not.toContain("Confirm GitHub Identity");
  expect(text).not.toContain("Sign in");
});

test("shows a refusal as an alert", async () => {
  await mount(
    overviewOf([
      {
        ...connected,
        connection: "Disconnected",
        stopReason: "Access revoked",
      },
    ]),
    actionsOf({
      onReconnect: vi.fn().mockRejectedValue(new Error("Install it again.")),
    }),
  );
  await act(async () => {
    buttonNamed("Reconnect").click();
    await settle();
  });
  await act(async () => {
    buttonNamed("Confirm Reconnect").click();
    await settle();
  });
  expect(host?.querySelector('p[role="alert"]')?.textContent).toBe(
    "Install it again.",
  );
});

test("previews the triage without any Work control and can skip it", async () => {
  const actions = await mount(overviewOf([connected]));
  await act(async () => {
    buttonNamed("Show triage preview").click();
    await settle();
  });
  expect(actions.loadTriage).toHaveBeenCalledWith("link-1");
  const text = host?.textContent ?? "";
  expect(text).toContain("Open, milestone v1 (1)");
  expect(text).toContain("#1 Checkout fails");
  const labels = [...(host?.querySelectorAll("button") ?? [])].map(
    (button) => button.textContent ?? "",
  );
  expect(labels.some((label) => WORK_CONTROL.test(label))).toBe(false);
  await act(async () => {
    buttonNamed("Skip triage").click();
    await settle();
  });
  expect(actions.onSkipTriage).toHaveBeenCalledWith("link-1");
});

test("an archived Project is read-only and an unconfigured App says so", async () => {
  await mount(
    overviewOf([], {
      app: {
        configured: false,
        contentsReason: GITHUB_CONTENTS_REASON,
        permissions: [],
      },
      readOnly: true,
    }),
  );
  expect(host?.textContent).toContain("The GitHub App is not configured");
  expect(host?.textContent).toContain("archived");
  expect(buttonNamed("Install GitHub App").disabled).toBe(true);
  expect(host?.querySelector('form[aria-label="Link Repository"]')).toBeNull();
});

test("operates by keyboard: native buttons are named and described by their Repository", async () => {
  await mount(overviewOf([connected]));
  const disconnect = buttonNamed("Disconnect");
  expect(disconnect.type).toBe("button");
  const describedBy = disconnect.getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(describedBy)?.textContent).toContain(
    "new-co/site",
  );
  expect(host?.querySelector("section[aria-labelledby]")).not.toBeNull();
  expect(host?.querySelector('[aria-live="polite"]')).not.toBeNull();
});

test("Sync now reports what happened and the sync status shows the last success", async () => {
  const actions = await mount(overviewOf([connected]));
  expect(host?.textContent).toContain("Last successful sync:");
  expect(host?.textContent).not.toContain("Out of date");
  await act(async () => {
    buttonNamed("Sync now").click();
    await settle();
  });
  expect(actions.onSyncNow).toHaveBeenCalledWith("link-1");
  expect(host?.querySelector('[role="status"]')?.textContent).toBe(
    "Synced. 2 GitHub records updated, 0 already newer.",
  );
});

test("an Out of date link says so and shows the last error and the rate-limit wait", async () => {
  await mount(
    overviewOf([
      {
        ...connected,
        sync: {
          firstSyncOverdue: false,
          lastError: "GitHub rate limit reached.",
          lastErrorAt: "2026-10-03T09:40:00.000Z",
          lastSuccessAt: "2026-10-03T09:00:00.000Z",
          outOfDate: true,
          rateLimitedUntil: "2026-10-03T10:00:00.000Z",
        },
      },
    ]),
  );
  const text = host?.textContent ?? "";
  expect(text).toContain("Out of date");
  expect(text).toContain("Last error: GitHub rate limit reached.");
  expect(text).toContain("Rate limit: GitHub asked us to wait until");
  expect(host?.querySelectorAll("time").length).toBeGreaterThanOrEqual(3);
});

test("a paused link shows Paused with its reason, offers Reconnect and no Sync now", async () => {
  await mount(
    overviewOf([
      { ...connected, connection: "Paused", pauseReason: "Project archived" },
    ]),
  );
  expect(host?.textContent).toContain("Status: Paused, Project archived");
  expect(() => buttonNamed("Sync now")).toThrow();
  buttonNamed("Reconnect");
  buttonNamed("Disconnect");
});

test("the Reconnect preview takes focus and can be cancelled from the keyboard", async () => {
  const actions = await mount(
    overviewOf([
      { ...connected, connection: "Paused", pauseReason: "Project archived" },
    ]),
  );
  await act(async () => {
    buttonNamed("Reconnect").click();
    await settle();
  });
  const heading = host?.querySelector("h5");
  expect(heading?.textContent).toBe("Reconnect preview");
  expect(document.activeElement).toBe(heading);
  expect(buttonNamed("Reconnect").getAttribute("aria-expanded")).toBe("true");
  await act(async () => {
    buttonNamed("Cancel").click();
    await settle();
  });
  expect(host?.querySelector("h5")).toBeNull();
  expect(actions.onReconnect).not.toHaveBeenCalled();
});
