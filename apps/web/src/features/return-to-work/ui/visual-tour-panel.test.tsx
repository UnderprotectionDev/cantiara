import type { ReturnVisualTourState } from "@cantiara/api/return-visual-tour";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import VisualTourPanel from "./visual-tour-panel";

const noop = () => undefined;
const DISABLED_NEXT = /<button[^>]*disabled[^>]*>Next change<\/button>/;
const CLOSE_BUTTON = /<button[^>]*>Close tour<\/button>/;

function tourState(): ReturnVisualTourState {
  return {
    status: "showing",
    position: 1,
    total: 20,
    limit: 20,
    remainder: { count: 3, firstEventId: "remaining" },
    restoration: "not-needed",
    current: {
      event: {
        id: "changed",
        kind: "Work updated",
        occurredAt: "2026-10-07T10:00:00.000Z",
        source: {
          id: "work",
          projectId: "project",
          title: "PAY-1 · Payment retry",
          sourcePath: "/projects/project#work-work",
        },
      },
      outcome: { status: "shown" },
    },
  };
}

test("Return to Work explains the current visual change, limit and remainder with keyboard controls", () => {
  const markup = renderToStaticMarkup(
    <VisualTourPanel
      onClose={noop}
      onNext={noop}
      onRemainder={noop}
      state={tourState()}
    />,
  );
  expect(markup).toContain("PAY-1 · Payment retry");
  expect(markup).toContain("Work updated since your last visit.");
  expect(markup).toContain('dateTime="2026-10-07T10:00:00.000Z"');
  expect(markup).toContain("Up to 20 visual changes");
  expect(markup).toContain("3 more visual changes");
  expect(markup).toContain("Next change");
  expect(markup).toContain("Close tour");
  expect(markup).toContain("Open remaining changes in list");
});

test.each([
  ["deleted", "Skipped: this target was deleted."],
  ["inaccessible", "Skipped: this target is inaccessible."],
  ["unplaceable", "Skipped: this target cannot be placed in the current view."],
] as const)(
  "explains a %s target without hiding the original event",
  (reason, explanation) => {
    const state = tourState();
    if (state.current) {
      state.current.outcome = { status: "skipped", reason };
    }
    const markup = renderToStaticMarkup(
      <VisualTourPanel
        onClose={noop}
        onNext={noop}
        onRemainder={noop}
        state={state}
      />,
    );
    expect(markup).toContain(explanation);
    expect(markup).toContain("PAY-1 · Payment retry");
  },
);

test("loading disables advancement while close remains available", () => {
  const markup = renderToStaticMarkup(
    <VisualTourPanel
      onClose={noop}
      onNext={noop}
      onRemainder={noop}
      state={{ ...tourState(), status: "loading", current: null }}
    />,
  );
  expect(markup).toContain("Loading visual change…");
  expect(markup).toMatch(DISABLED_NEXT);
  expect(markup.match(CLOSE_BUTTON)?.[0]).not.toContain(' disabled="');
});
