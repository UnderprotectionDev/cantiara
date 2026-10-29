// @vitest-environment happy-dom

import type { BuildInPublicPublication } from "@cantiara/api/build-in-public-publication";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { BuildInPublicPublicationPanel } from "../build-in-public-publication-panel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const publication: BuildInPublicPublication = {
  aliases: [],
  changelogPath: "/b/s1/launch/changelog",
  indexingEnabled: false,
  indexingWarning: "Third-party copies cannot be fully recalled.",
  path: "/b/s1/launch",
  projectId: "p",
  published: true,
  revision: 2,
  roadmapPath: "/b/s1/launch/roadmap",
  slug: "launch",
  surfaceId: "s1",
  unpublishedChanges: true,
};

let root: Root | undefined;
let host: HTMLElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function render(element: React.ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(element));
  return host;
}

function click(target: Element | null | undefined) {
  act(() => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  );
}

test("shows Unpublished changes and no counter or last access", () => {
  const view = render(
    <BuildInPublicPublicationPanel
      onPreviewSlug={vi.fn()}
      onSetIndexing={vi.fn()}
      onSetSlug={vi.fn()}
      onUnpublish={vi.fn()}
      publication={publication}
    />,
  );

  expect(view.textContent).toContain("Unpublished changes");
  const text = view.textContent?.toLowerCase() ?? "";
  for (const counter of ["views", "visitors", "last access", "analytics"]) {
    expect(text).not.toContain(counter);
  }
});

test("enabling indexing needs the third-party copy acknowledgement", () => {
  const onSetIndexing = vi.fn();
  const view = render(
    <BuildInPublicPublicationPanel
      onPreviewSlug={vi.fn()}
      onSetIndexing={onSetIndexing}
      onSetSlug={vi.fn()}
      onUnpublish={vi.fn()}
      publication={publication}
    />,
  );

  expect(view.textContent).toContain(publication.indexingWarning);
  expect(button(view, "Enable indexing")?.disabled).toBe(true);
  click(view.querySelector("#bip-ack-indexing"));
  expect(button(view, "Enable indexing")?.disabled).toBe(false);
  click(button(view, "Enable indexing"));
  expect(onSetIndexing).toHaveBeenCalledWith({
    acknowledgeThirdPartyCopies: true,
    enabled: true,
  });
});

test("a slug change is previewed and its redirect confirmed before it applies; unpublish asks twice", () => {
  const onSetSlug = vi.fn();
  const onUnpublish = vi.fn();
  const view = render(
    <BuildInPublicPublicationPanel
      onPreviewSlug={vi.fn()}
      onSetIndexing={vi.fn()}
      onSetSlug={onSetSlug}
      onUnpublish={onUnpublish}
      publication={publication}
      slugPreview={{
        available: true,
        redirect: { from: "/b/s1/launch", to: "/b/s1/launch" },
        slug: "launch",
      }}
    />,
  );

  expect(view.textContent).toContain("will redirect to");
  expect(button(view, "Change slug")?.disabled).toBe(true);
  click(view.querySelector("#bip-confirm-redirect"));
  click(button(view, "Change slug"));
  expect(onSetSlug).toHaveBeenCalledWith({
    confirmRedirect: true,
    slug: "launch",
  });

  click(button(view, "Unpublish"));
  expect(onUnpublish).not.toHaveBeenCalled();
  click(button(view, "Confirm Unpublish"));
  expect(onUnpublish).toHaveBeenCalledTimes(1);
});

test("an unpublished Project offers nothing to manage", () => {
  const view = render(
    <BuildInPublicPublicationPanel
      onPreviewSlug={vi.fn()}
      onSetIndexing={vi.fn()}
      onSetSlug={vi.fn()}
      onUnpublish={vi.fn()}
      publication={{ ...publication, path: null, published: false }}
    />,
  );
  expect(view.querySelectorAll("button")).toHaveLength(0);
});
