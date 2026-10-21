// @vitest-environment happy-dom

import type { ScreenRecord } from "@cantiara/api/screens";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ScreensView } from "../screens-view";

const base: ScreenRecord = {
  createdAt: "2026-10-01T09:00:00.000Z",
  id: "s1",
  lifecycle: "Active",
  projectId: "p1",
  revision: 1,
  title: "Checkout",
  updatedAt: "2026-10-01T09:00:00.000Z",
  wireframeVersions: [],
};
const noop = async () => undefined;

function render(screens: ScreenRecord[], readOnly = false) {
  return renderToStaticMarkup(
    <ScreensView
      onCreate={noop}
      onSetLifecycle={noop}
      readOnly={readOnly}
      screens={screens}
    />,
  );
}

test("offers a title-only Create Screen form and the empty states", () => {
  const html = render([]);

  expect(html).toContain("Create Screen");
  expect(html).toContain("No Screens yet.");
  expect(html).toContain("No Screens in Trash.");
  expect(html).not.toContain("Wireframe");
  expect(html).not.toContain("User Flow");
});

test("shows lifecycle actions per visibility and keeps versions on the Screen", () => {
  const html = render([
    {
      ...base,
      wireframeVersions: [{ createdAt: base.createdAt, id: "v1", version: 1 }],
    },
    { ...base, id: "s2", lifecycle: "Archived", title: "Profile" },
    { ...base, id: "s3", lifecycle: "In Trash", title: "Old" },
  ]);

  expect(html).toContain("Wireframe:");
  expect(html).toContain("v1");
  expect(html).toContain(">Archive<");
  expect(html).toContain(">Unarchive<");
  expect(html).toContain(">Move to Trash<");
  expect(html).toContain(">Restore<");
  // No separate archive or trash action belongs to the Wireframe.
  expect(html.match(/Wireframe/g)).toHaveLength(1);
});

test("hides write controls in a read-only Project", () => {
  const html = render([base], true);

  expect(html).not.toContain("Create Screen");
  expect(html).not.toContain("Move to Trash");
});
