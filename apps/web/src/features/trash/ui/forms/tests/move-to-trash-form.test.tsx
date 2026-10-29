import type { MoveToTrashPreview } from "@cantiara/api/trash";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { MoveToTrashForm } from "../move-to-trash-form";

const candidate = { id: "d1", kind: "Document", label: "Notes", revision: 0 };
const REVOKE_CHECKED = /<input[^>]*checked=""[^>]*value="revoke"/;
const noop = () => undefined;

function preview(overrides: Partial<MoveToTrashPreview>): MoveToTrashPreview {
  return {
    defaultDisposition: "revoke",
    keepApprovedSurface: { available: true },
    recordId: "d1",
    recordKind: "Document",
    surfaces: [
      { kind: "Link-limited share", state: "Active", surfaceId: "s1" },
    ],
    ...overrides,
  } as MoveToTrashPreview;
}

function render(value: MoveToTrashPreview) {
  return renderToStaticMarkup(
    <MoveToTrashForm
      candidate={candidate as never}
      disabled={false}
      onCancel={noop}
      onConfirm={noop}
      preview={value}
    />,
  );
}

describe("MoveToTrashForm", () => {
  test("lists the attached surfaces with revoke preselected", () => {
    const html = render(preview({}));

    expect(html).toContain("Link-limited share: Active");
    expect(html).toMatch(REVOKE_CHECKED);
    expect(html).toContain("Keep approved surface");
  });

  test("hides Keep approved surface when the preview says it is unavailable", () => {
    const html = render(
      preview({
        keepApprovedSurface: { available: false, reason: "not offered" },
      }),
    );

    expect(html).toContain("Link-limited share: Active");
    expect(html).not.toContain("Keep approved surface");
    expect(html).not.toContain("surface-disposition-keep");
  });

  test("says so when no surface is attached", () => {
    const html = render(
      preview({
        keepApprovedSurface: { available: false, reason: "none" },
        surfaces: [],
      }),
    );

    expect(html).toContain("No External Surface is attached");
    expect(html).not.toContain('role="radio"');
  });

  test("uses a native radio group with a legend for keyboard and screen readers", () => {
    const html = render(preview({}));

    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain('aria-labelledby="move-to-trash-review-title"');
  });
});
