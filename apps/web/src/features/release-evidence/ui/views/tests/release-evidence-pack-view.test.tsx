// @vitest-environment happy-dom

import {
  deriveReleaseEvidencePack,
  deriveReleaseOpenScopeSignal,
  RELEASE_EVIDENCE_NOTE,
  type ReleaseEvidenceFacts,
} from "@cantiara/api/release-evidence";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ReleaseEvidencePackView } from "../release-evidence-pack-view";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SCORE_OR_VERDICT = /score|ready to publish|not ready|pass rate/i;
const PUBLISH_CONTROL = /publish|approve|accept|mark done/i;

const ok = <T,>(value: T) => ({ available: true as const, value });

const facts = (
  status: string,
  overrides: Partial<ReleaseEvidenceFacts> = {},
): ReleaseEvidenceFacts => ({
  assessment: ok(null),
  checklist: [{ checked: false, id: "c1", text: "Tag the repo" }],
  decisions: ok([]),
  gaps: ok([{ id: "g1", state: "Open", title: "Upgrade path" }]),
  inconsistencies: ok([]),
  publishDiff: { available: false, reason: "No approved snapshot owner yet." },
  pullRequests: ok([]),
  readOnly: false,
  release: {
    id: "rel1",
    name: "tidekit 1.0",
    projectId: "p1",
    status,
    versionLabel: null,
  },
  risks: ok([{ id: "k1", open: true, state: "Open", title: "Data loss" }]),
  scope: ok([
    {
      expectedOutcome: null,
      id: "w1",
      key: "TID-1",
      status: "In Progress",
      title: "Ship",
    },
  ]),
  tests: ok({ cases: [], contextChanges: [], handoffs: [], sessionTests: [] }),
  ...overrides,
});

const actions = () => ({
  onAddItem: vi.fn(() => Promise.resolve()),
  onCloseSignal: vi.fn(() => Promise.resolve()),
  onRemoveItem: vi.fn(() => Promise.resolve()),
  onSetItem: vi.fn(() => Promise.resolve()),
});

let root: Root | undefined;
let host: HTMLElement | undefined;

function render(input: ReleaseEvidenceFacts, closed = false) {
  host = document.createElement("div");
  document.body.append(host);
  const handlers = actions();
  act(() => {
    root = createRoot(host as HTMLElement);
    root.render(
      <ReleaseEvidencePackView
        actions={handlers}
        pack={deriveReleaseEvidencePack(input)}
        projectId="p1"
        signal={deriveReleaseOpenScopeSignal(input, closed)}
      />,
    );
  });
  return { handlers, host };
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

test("every attention and source row names why and opens its source; no score, verdict or publish control", () => {
  const { host: el } = render(facts("Preparing"));
  expect(el.textContent).toContain("Release Evidence Pack");
  const links = [...el.querySelectorAll("a")].filter(
    (link) => link.textContent === "Open source record",
  );
  expect(links.length).toBeGreaterThan(5);
  expect(el.querySelector('a[href="/projects/p1#work-w1"]')).not.toBeNull();
  expect(
    el.querySelector('a[href="/projects/p1#source-risk-k1"]'),
  ).not.toBeNull();
  // The fixed header note itself says there is no score and no gate.
  const text = (el.textContent ?? "").replace(RELEASE_EVIDENCE_NOTE, "");
  expect(text).not.toMatch(SCORE_OR_VERDICT);
  for (const button of el.querySelectorAll("button")) {
    expect(button.textContent).not.toMatch(PUBLISH_CONTROL);
  }
});

test("a missing source stays visible as unavailable and as attention", () => {
  const { host: el } = render(facts("Preparing"));
  expect(el.textContent).toContain(
    "Source unavailable: No approved snapshot owner yet.",
  );
  expect(el.textContent).toContain("Publish diff source is unavailable");
  expect(el.textContent).toContain("TID-1 has no Expected Outcome");
});

test("the checklist adds, checks and removes through its own handlers only", () => {
  const { handlers, host: el } = render(facts("Preparing"));
  const box = el.querySelector<HTMLInputElement>("#release-checklist-c1");
  act(() => {
    box?.click();
  });
  expect(handlers.onSetItem).toHaveBeenCalledWith("c1", true);
  const remove = [...el.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Remove"),
  );
  act(() => {
    remove?.click();
  });
  expect(handlers.onRemoveItem).toHaveBeenCalledWith("c1");
  expect(el.textContent).toContain("Add item");
});

test("a Published release with open Work shows a closeable signal that changes no status", () => {
  const { handlers, host: el } = render(facts("Published"));
  expect(el.textContent).toContain("does not change any status");
  const close = [...el.querySelectorAll("button")].find(
    (button) => button.textContent === "Close signal",
  );
  act(() => {
    close?.click();
  });
  expect(handlers.onCloseSignal).toHaveBeenCalled();
});

test("a closed signal is not shown again", () => {
  const { host: el } = render(facts("Published"), true);
  expect(el.textContent).not.toContain("does not change any status");
});
