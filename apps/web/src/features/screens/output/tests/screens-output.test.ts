// @vitest-environment happy-dom

import {
  createEmptyWireframeDocument,
  createWireframeBlock,
  type WireframeDocument,
  WireframeDocumentError,
} from "@cantiara/api/wireframe-document";
import { expect, test } from "vitest";
import { renderInteractiveHtml } from "../html";
import { buildExportManifest } from "../manifest";
import { activateBlock, startPresentation } from "../presentation";
import { renderPrintDocument } from "../print";
import { createWireframeSnapshot } from "../snapshot";
import { renderSvg } from "../svg";

const SCRIPT_BODY = /<script>([\s\S]*)<\/script>/;
const LINKS_JSON = /<script id="cantiara-links"[^>]*>([\s\S]*?)<\/script>/;
const BODY_HTML = /<body>([\s\S]*?)<script id=/;
const NETWORK_URL = /https?:\/\/|\/\/[a-z0-9.-]+\.[a-z]{2,}/i;
const NETWORK_API = /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|analytics/i;

function documentWith(
  blocks: ReturnType<typeof createWireframeBlock>[],
  animations: WireframeDocument["animations"] = [],
): WireframeDocument {
  return { ...createEmptyWireframeDocument(), animations, blocks };
}

function transition(blockId: string, targetScreenId: string) {
  return {
    durationMs: 300 as const,
    id: `go-${blockId}`,
    kind: "screen-transition" as const,
    targetScreenId,
    transition: "fade" as const,
    triggerBlockId: blockId,
  };
}

const home = createWireframeSnapshot({
  document: documentWith(
    [
      createWireframeBlock("Button", "to-pricing", { x: 10, y: 10 }),
      createWireframeBlock("Button", "to-gone", { x: 10, y: 80 }),
    ],
    [transition("to-pricing", "pricing"), transition("to-gone", "deleted")],
  ),
  latestVersion: 3,
  screenId: "home",
  title: "Home",
  version: 2,
});
const pricing = createWireframeSnapshot({
  document: documentWith([
    createWireframeBlock("Card", "plans", { x: 0, y: 0 }),
  ]),
  latestVersion: 1,
  screenId: "pricing",
  title: "Pricing",
  version: 1,
});
const other = createWireframeSnapshot({
  document: documentWith([
    createWireframeBlock("Input", "email", { x: 0, y: 0 }),
  ]),
  latestVersion: 1,
  screenId: "other",
  title: "Other",
  version: 1,
});

test("a snapshot pins an explicit version and says whether it is sealed", () => {
  expect(home.version).toBe(2);
  expect(home.sealed).toBe(true);
  expect(pricing.sealed).toBe(false);
  expect(buildExportManifest([home, pricing])).toContain(
    `Wireframe version 2 (sealed) | digest ${home.digest}`,
  );
  expect(buildExportManifest([home, pricing])).toContain("(working)");
});

test("Konva JSON is not an export contract", () => {
  const konva = JSON.stringify({
    attrs: { height: 10, width: 10 },
    children: [],
    className: "Stage",
  });
  expect(() =>
    createWireframeSnapshot({
      document: konva,
      latestVersion: 1,
      screenId: "x",
      title: "X",
      version: 1,
    }),
  ).toThrow(WireframeDocumentError);
  expect(renderSvg(home).markup).not.toContain("className");
});

test("SVG of a selection covers only the selected blocks and is deterministic", () => {
  const whole = renderSvg(home, { standalone: true });
  const selection = renderSvg(home, { blockIds: ["to-pricing"] });
  expect(whole.markup).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(whole.markup).toContain('data-block-id="to-gone"');
  expect(selection.markup).toContain('data-block-id="to-pricing"');
  expect(selection.markup).not.toContain('data-block-id="to-gone"');
  expect(renderSvg(home).markup).toBe(renderSvg(home).markup);
});

test("manifest and HTML are deterministic regardless of choice order", () => {
  const first = renderInteractiveHtml([home, pricing]);
  const second = renderInteractiveHtml([pricing, home]);
  expect(first).toBe(second);
  expect(buildExportManifest([pricing, home])).toBe(
    buildExportManifest([home, pricing]),
  );
});

test("HTML is self-contained: no URL, no network or analytics, no write path", () => {
  const html = renderInteractiveHtml([home, pricing], {
    fontDataUri: "data:font/woff2;base64,AAAA",
  });
  expect(html).not.toMatch(NETWORK_URL);
  expect(html).not.toMatch(NETWORK_API);
  expect(html).not.toContain("<link");
  expect(html).not.toContain("<form");
  expect(html).toContain("default-src 'none'");
  expect(html).toContain("data:font/woff2;base64,AAAA");
  expect(html).toContain("Wireframe version 2 (sealed)");
});

test("an unresolved target stays unresolved in the manifest and never retargets", () => {
  const manifest = buildExportManifest([home, pricing, other]);
  expect(manifest).toContain("Unresolved (Screen deleted)");
  expect(manifest).toContain("-> Pricing v1 (Screen pricing)");
  expect(manifest).not.toContain("-> Other");
});

test("the exported HTML shows an unresolved target and follows a resolved one", () => {
  document.body.innerHTML = "";
  const html = renderInteractiveHtml([home, pricing, other], {
    startScreenId: "home",
  });
  const script = SCRIPT_BODY.exec(html)?.[1] ?? "";
  const json = LINKS_JSON.exec(html)?.[1];
  const body = BODY_HTML.exec(html)?.[1] ?? "";
  document.body.innerHTML = `${body}<script id="cantiara-links" type="application/json">${json}</script>`;
  new Function(script)();

  const visible = () =>
    [...document.querySelectorAll("[data-screen-section]")]
      .filter((node) => !(node as HTMLElement).hidden)
      .map((node) => node.getAttribute("data-screen-section"));
  expect(visible()).toEqual(["home"]);

  document
    .querySelector('[data-block-id="to-gone"]')
    ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  expect(visible()).toEqual(["home"]);
  expect(document.getElementById("cantiara-status")?.textContent).toBe(
    "Unresolved: deleted",
  );

  document
    .querySelector('[data-block-id="to-pricing"]')
    ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  expect(visible()).toEqual(["pricing"]);
});

test("PDF print document has one page per Screen version plus the manifest", () => {
  const html = renderPrintDocument([home, pricing]);
  expect(html.match(/class="page"/g)).toHaveLength(3);
  expect(html).toContain("Home - Wireframe version 2");
  expect(html).not.toMatch(NETWORK_URL);
});

test("export leaves the live document and the snapshot unchanged", () => {
  const before = JSON.stringify(home.document);
  renderSvg(home, { blockIds: ["to-pricing"] });
  renderInteractiveHtml([home, pricing]);
  renderPrintDocument([home]);
  buildExportManifest([home]);
  startPresentation([home, pricing], "home");
  expect(JSON.stringify(home.document)).toBe(before);
  expect(Object.isFrozen(home.document)).toBe(false);
});

test("Presentation Mode follows a resolved link and keeps a broken one in place", () => {
  const snapshots = [home, pricing, other];
  const start = startPresentation(snapshots, "home");
  expect(start?.screenId).toBe("home");

  if (!start) {
    throw new Error("start expected");
  }
  const broken = activateBlock(snapshots, start, "to-gone");
  expect(broken.screenId).toBe("home");
  expect(broken.unresolvedTarget).toEqual({
    blockId: "to-gone",
    targetScreenId: "deleted",
  });

  const followed = activateBlock(snapshots, broken, "to-pricing");
  expect(followed.screenId).toBe("pricing");
  expect(followed.unresolvedTarget).toBeNull();
});

test("Presentation Mode does not start from a Screen that is not among the versions", () => {
  expect(startPresentation([home], "pricing")).toBeNull();
});

test("show and hide animations toggle visibility without writing", () => {
  const toggled = createWireframeSnapshot({
    document: documentWith(
      [
        createWireframeBlock("Button", "open", { x: 0, y: 0 }),
        createWireframeBlock("Card", "panel", { x: 0, y: 60 }),
      ],
      [
        {
          action: "show",
          id: "a1",
          kind: "show-hide",
          targetBlockId: "panel",
          triggerBlockId: "open",
        },
      ],
    ),
    latestVersion: 1,
    screenId: "toggle",
    title: "Toggle",
    version: 1,
  });
  const start = startPresentation([toggled], "toggle");
  expect(start?.hiddenBlockIds).toEqual(["panel"]);
  if (!start) {
    throw new Error("start expected");
  }
  expect(activateBlock([toggled], start, "open").hiddenBlockIds).toEqual([]);
});
