// @vitest-environment happy-dom

import type { WikiPublication } from "@cantiara/api/wiki-publishing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { WikiPublicationPanel } from "../wiki-publication-panel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const published: WikiPublication = {
  documentId: "wiki-1",
  indexingEnabled: false,
  path: "/w/surface-1/release-habits",
  revision: 2,
  surfaceId: "surface-1",
};

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(publication: WikiPublication = published) {
  const onSetIndexing = vi.fn();
  const onUnpublish = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <WikiPublicationPanel
        onSetIndexing={onSetIndexing}
        onUnpublish={onUnpublish}
        publication={publication}
        publicUrl={
          publication.path ? `https://cantiara.test${publication.path}` : null
        }
      />,
    ),
  );
  return { onSetIndexing, onUnpublish };
}

const dialog = () => document.body.querySelector('[role="dialog"]');
const buttons = (scope: ParentNode, name: string) =>
  [...scope.querySelectorAll("button")].filter(
    (candidate) => candidate.textContent?.trim() === name,
  ) as HTMLButtonElement[];
const buttonIn = (scope: ParentNode, name: string) =>
  buttons(scope, name)[0] as HTMLButtonElement;

test("names the public page and says it is not indexed by default", () => {
  render();

  const section = document.body.querySelector("section");
  const titleId = section?.getAttribute("aria-labelledby");
  expect(titleId && document.getElementById(titleId)?.textContent).toBe(
    "Public page",
  );
  expect(section?.textContent).toContain("Not indexed");
  expect(section?.textContent).toContain("not in any sitemap");
  expect(section?.querySelector("a")?.getAttribute("rel")).toContain(
    "noreferrer",
  );
  expect(section?.querySelector('[role="status"]')).not.toBeNull();
});

test("Unpublish asks first, is a named dialog, and Cancel unpublishes nothing", () => {
  const { onUnpublish } = render();

  act(() => buttonIn(document.body, "Unpublish").click());
  const surface = dialog();
  const titleId = surface?.getAttribute("aria-labelledby");
  expect(titleId && document.getElementById(titleId)?.textContent).toBe(
    "Unpublish",
  );
  expect(surface?.textContent).toContain("never reused");
  expect(surface?.textContent).toContain("cannot be recalled");

  act(() => buttonIn(surface as Element, "Cancel").click());
  expect(onUnpublish).not.toHaveBeenCalled();
});

test("confirming Unpublish calls it once", () => {
  const { onUnpublish } = render();

  act(() => buttonIn(document.body, "Unpublish").click());
  const surface = dialog() as Element;
  act(() => buttonIn(surface, "Unpublish").click());

  expect(onUnpublish).toHaveBeenCalledTimes(1);
});

test("Enable indexing shows the third-party warning and needs the acknowledgement", () => {
  const { onSetIndexing } = render();

  act(() => buttonIn(document.body, "Enable indexing").click());
  const surface = dialog() as Element;
  expect(surface.textContent).toContain("cannot be fully recalled");
  const confirm = buttonIn(surface, "Enable indexing");
  expect(confirm.disabled).toBe(true);

  const box = surface.querySelector<HTMLElement>('[role="checkbox"]');
  expect(box?.getAttribute("aria-labelledby")).toBeTruthy();
  act(() => box?.click());
  expect(confirm.disabled).toBe(false);
  act(() => confirm.click());

  expect(onSetIndexing).toHaveBeenCalledWith({
    acknowledgeThirdPartyCopies: true,
    enabled: true,
  });
});

test("an indexed page offers Disable indexing without a warning dialog", () => {
  const { onSetIndexing } = render({ ...published, indexingEnabled: true });

  expect(document.body.textContent).toContain("may index this page");
  act(() => buttonIn(document.body, "Disable indexing").click());

  expect(dialog()).toBeNull();
  expect(onSetIndexing).toHaveBeenCalledWith({
    acknowledgeThirdPartyCopies: false,
    enabled: false,
  });
});

test("an unpublished Document shows status only and no Unpublish control", () => {
  render({ ...published, path: null, surfaceId: null });

  expect(document.body.textContent).toContain("not published");
  expect(buttons(document.body, "Unpublish")).toHaveLength(0);
});
