// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noAwaitInLoops: Timers must settle one after another.

import type { GitHubExternalRecord } from "@cantiara/api/github-integration";
import type {
  GitHubCreateWorkPreview,
  GitHubWorkLinksOverview,
} from "@cantiara/api/github-work-links";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import {
  type GitHubWorkLinkActions,
  GitHubWorkLinksPanel,
} from "../github-work-links-panel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EVIDENCE_WORDS = /evidence|embed|usage/i;

function record(
  overrides: Partial<GitHubExternalRecord> & { id: string; number: number },
): GitHubExternalRecord {
  return {
    githubId: overrides.number,
    htmlUrl: `https://github.com/acme/web/issues/${overrides.number}`,
    kind: "Pull request",
    labels: [],
    lifecycle: "Active",
    linkId: "link-1",
    milestone: null,
    needsReconcile: false,
    origin: null,
    projectId: "p1",
    sourceState: "open",
    sourceUpdatedAt: "2026-10-01T09:00:00.000Z",
    title: `Record ${overrides.number}`,
    ...overrides,
  };
}

const records = [
  record({ id: "pr-1", number: 3, title: "Fix checkout" }),
  record({ id: "issue-1", kind: "Issue", number: 4, title: "Add dark mode" }),
];

const data: GitHubWorkLinksOverview = {
  links: [
    {
      createdAt: "2026-10-01T09:00:00.000Z",
      htmlUrl: "https://github.com/acme/web/issues/3",
      id: "wl-1",
      kind: "Pull request",
      label: "#3 Fix checkout",
      matchedKey: "CAN-1",
      number: 3,
      origin: "Key match",
      projectId: "p1",
      recordId: "pr-1",
      repository: "acme/web",
      repositoryLinkId: "link-1",
      role: "Required for completion",
      sourceState: "open",
      value: null,
      workId: "w1",
      workKey: "CAN-1",
      workTitle: "Checkout retry",
    },
  ],
  readOnly: false,
  signals: [
    {
      occurredAt: "2026-10-01T09:00:00.000Z",
      presentation: "Action Required",
      record: {
        htmlUrl: "https://github.com/acme/web/issues/3",
        id: "pr-1",
        kind: "Pull request",
        number: 3,
        sourceState: "open",
        title: "Fix checkout",
      },
      signalId: "work-pr-status-conflict:w1:pr-1",
      signalType: "work-pr-status-conflict",
      summary: "CAN-1 is Completed and Pull request #3 is open.",
      work: { id: "w1", key: "CAN-1", title: "Checkout retry" },
    },
  ],
  suggestions: [
    {
      closingIntent: true,
      id: "pr-9:CAN-99",
      key: "CAN-99",
      reason: "No Work with this key",
      recordId: "pr-1",
      workId: null,
      workKey: null,
      workTitle: null,
    },
  ],
  works: [
    {
      closureResult: null,
      id: "w1",
      key: "CAN-1",
      status: "Not Started",
      title: "Checkout retry",
    },
    {
      closureResult: null,
      id: "w2",
      key: "CAN-2",
      status: "Not Started",
      title: "Fix layout",
    },
  ],
};

const preview: GitHubCreateWorkPreview = {
  draft: {
    description: "From GitHub Issue #4: https://github.com/acme/web/issues/4",
    startingStatus: "Not Started",
    title: "Add dark mode",
    type: "Task",
  },
  effects: ["Later edits on either side do not sync to the other."],
  recordId: "issue-1",
  source: {
    htmlUrl: "https://github.com/acme/web/issues/4",
    kind: "Issue",
    number: 4,
    title: "Add dark mode",
  },
  syncsFields: false,
  writesGitHub: false,
};

function actionsOf(): GitHubWorkLinkActions {
  return {
    onCreateWork: vi.fn().mockResolvedValue(undefined),
    onDismissSignal: vi.fn().mockResolvedValue(undefined),
    onLinkWork: vi.fn().mockResolvedValue(undefined),
    onPreviewCreateWork: vi.fn().mockResolvedValue(preview),
    onUnlink: vi.fn().mockResolvedValue(undefined),
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

async function mount(actions: GitHubWorkLinkActions = actionsOf()) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <GitHubWorkLinksPanel
        actions={actions}
        data={data}
        records={records}
        repositories={[{ id: "link-1", label: "acme/web" }]}
      />,
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

async function choose(selector: string, value: string) {
  const select = host?.querySelector(selector) as HTMLSelectElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
  });
}

test("shows each link with its role and origin, the attention signal and a suggestion that only suggests", async () => {
  await mount();
  const text = host?.textContent ?? "";
  expect(text).toContain("CAN-1 Checkout retry is linked to Pull request");
  expect(text).toContain("Required for completion");
  expect(text).toContain("Key match CAN-1");
  expect(text).toContain("CAN-1 is Completed and Pull request #3 is open.");
  expect(text).toContain("CAN-99: No Work with this key");
  expect(text).toContain("did not link on their own");
  // A link is not an Evidence link and not a usage embed.
  expect(text).not.toMatch(EVIDENCE_WORDS);
});

test("Unlink and Dismiss are buttons that name their item and call the actions", async () => {
  const actions = await mount();
  expect(buttonNamed("Unlink").getAttribute("aria-describedby")).toBe(
    "github-work-link-wl-1",
  );
  await act(async () => {
    buttonNamed("Unlink").click();
    await settle();
  });
  expect(actions.onUnlink).toHaveBeenCalledWith("wl-1");
  await act(async () => {
    buttonNamed("Dismiss").click();
    await settle();
  });
  expect(actions.onDismissSignal).toHaveBeenCalledWith(
    "work-pr-status-conflict:w1:pr-1",
  );
});

test("Link Work offers the closed role catalog and Required for completion only for a Pull request", async () => {
  const actions = await mount();
  const role = () =>
    host?.querySelector("#github-link-role") as HTMLSelectElement;
  expect([...role().options].map((option) => option.textContent)).toEqual([
    "Required for completion",
    "Contextual",
  ]);
  const required = () => role().options[0] as HTMLOptionElement;
  expect(required().disabled).toBe(true);
  await choose("#github-link-record", "pr-1");
  expect(required().disabled).toBe(false);
  await choose("#github-link-work", "w2");
  await choose("#github-link-role", "Required for completion");
  await act(async () => {
    buttonNamed("Link Work").click();
    await settle();
  });
  expect(actions.onLinkWork).toHaveBeenCalledWith({
    recordId: "pr-1",
    role: "Required for completion",
    target: "record",
    workId: "w2",
  });
  await choose("#github-link-record", "issue-1");
  expect(required().disabled).toBe(true);
  expect(role().value).toBe("Contextual");
});

test("Create work and link previews a one-time draft and creates only after Confirm", async () => {
  const actions = await mount();
  await act(async () => {
    buttonNamed("Preview Work draft").click();
    await settle();
  });
  expect(actions.onPreviewCreateWork).not.toHaveBeenCalled();
  expect(host?.textContent).toContain("Choose an Issue.");
  await choose("#github-create-work-issue", "issue-1");
  await act(async () => {
    buttonNamed("Preview Work draft").click();
    await settle();
  });
  expect(actions.onPreviewCreateWork).toHaveBeenCalledWith("issue-1");
  expect(actions.onCreateWork).not.toHaveBeenCalled();
  expect(host?.textContent).toContain("Starting status Not Started");
  expect(host?.textContent).toContain(
    "Later edits on either side do not sync to the other.",
  );
  await act(async () => {
    buttonNamed("Create work and link").click();
    await settle();
  });
  expect(actions.onCreateWork).toHaveBeenCalledWith({
    description: preview.draft.description,
    recordId: "issue-1",
    title: "Add dark mode",
    type: "Task",
  });
});

test("the Pull request list offers no Issue to create Work from", async () => {
  await mount();
  const select = host?.querySelector(
    "#github-create-work-issue",
  ) as HTMLSelectElement;
  expect([...select.options].map((option) => option.textContent)).toEqual([
    "Choose an Issue",
    "#4 Add dark mode",
  ]);
});
