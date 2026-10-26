// @vitest-environment happy-dom

import {
  deriveValueChain,
  type ValueChain,
  type ValueChainFacts,
} from "@cantiara/api/value-chain";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ValueChainView } from "../value-chain-view";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SCORE_OR_VERDICT = /health|on track|complete\b|percent|%|ready/i;
const WRITE_CONTROL = /\b(save|link|attach|create|mark|publish|approve)\b/i;

const G = { id: "g1", type: "Project Goal" } as const;
const facts: ValueChainFacts = {
  associations: [
    {
      child: { id: "d2", type: "Decision" },
      parent: G,
      relation: { id: "a1", label: "Related" },
    },
  ],
  edges: [
    {
      child: { id: "w1", type: "Work" },
      parent: G,
      relation: { id: "e1", label: "Contributes to Goal" },
    },
    {
      child: { id: "w2", type: "Work" },
      parent: G,
      relation: { id: "e2", label: "Contributes to Goal" },
    },
  ],
  goal: { id: "g1", title: "Reach founders", unavailable: null },
  nodes: [
    {
      id: "w1",
      status: "In Progress",
      title: "Interview",
      type: "Work",
      unavailable: null,
    },
    {
      id: "w2",
      status: null,
      title: null,
      type: "Work",
      unavailable: "In Trash",
    },
    {
      id: "d2",
      status: "Valid",
      title: "Loose Karar",
      type: "Decision",
      unavailable: null,
    },
  ],
};

let root: Root | null = null;
let host: HTMLElement | null = null;
function render(chain: ValueChain) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<ValueChainView chain={chain} projectId="p1" />);
  });
  return host;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

test("shows branches with why, source links, gaps and the unlinked section", () => {
  const view = render(deriveValueChain(facts));
  const text = view.textContent ?? "";
  expect(text).toContain("Value Chain");
  expect(text).toContain("Not linked to goal (1)");
  expect(text).toContain("Reached from Project Goal Reach founders.");
  expect(text).toContain("Bound by Contributes to Goal");
  expect(text).toContain(
    "A Related link does not count as a contribution to this goal.",
  );
  expect(text).toContain("Unavailable record");
  expect(text).toContain("No Decision is bound to this Work.");
  const hrefs = [...view.querySelectorAll("a")].map((a) =>
    a.getAttribute("href"),
  );
  expect(hrefs).toContain("/projects/p1#work-w1");
  expect(hrefs).toContain("/projects/p1#source-decision-d2");
});

test("renders no score, verdict or write control", () => {
  const view = render(deriveValueChain(facts));
  expect(view.textContent).not.toMatch(SCORE_OR_VERDICT);
  expect(view.querySelectorAll("input, textarea, select, form").length).toBe(0);
  expect(
    [...view.querySelectorAll("button")].map((b) => b.textContent),
  ).toEqual(["Fill this gap", "Fill this gap", "Fill this gap"]);
  expect(
    [...view.querySelectorAll("a")].some((a) =>
      WRITE_CONTROL.test(a.textContent ?? ""),
    ),
  ).toBe(false);
});

test("a deleted goal still shows what stays bound to it", () => {
  const view = render(
    deriveValueChain({
      ...facts,
      goal: { id: "g1", title: null, unavailable: "Permanently deleted" },
    }),
  );
  expect(view.textContent).toContain("Permanently deleted");
  expect(view.textContent).toContain("Interview");
});

test("Fill this gap only offers navigation and says nothing is written", () => {
  const view = render(deriveValueChain(facts));
  const [first] = [...view.querySelectorAll("button")];
  act(() => first?.click());
  const text = view.textContent ?? "";
  expect(text).toContain("Choose an existing record");
  expect(text).toContain("Start a new record");
  expect(text).toContain(
    "Nothing is written until you save the relation in the owning feature. No other record changes status.",
  );
  const hrefs = [...view.querySelectorAll("a")].map((a) =>
    a.getAttribute("href"),
  );
  expect(hrefs).toContain("/projects/p1#work-relations-w1");
  expect(hrefs).toContain("/projects/p1#project-area-decisions");
});
