import type { TrashEarlyDeletePreview } from "@cantiara/api/trash-early-delete";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PermanentlyDeleteForm } from "../permanently-delete-form";

const SECOND_FACTOR = /password|MFA|refresh/i;
const noop = () => undefined;

const preview = (
  overrides: Partial<TrashEarlyDeletePreview> = {},
): TrashEarlyDeletePreview => ({
  blockers: [],
  entryId: "e1",
  groupId: null,
  keepApprovedSurface: { available: false, reason: "never" },
  members: [
    {
      entryId: "e1",
      recordId: "w1",
      recordKind: "Work",
      recordLabel: "Ship it",
      revision: 4,
    },
  ],
  typedNameTarget: { kind: "Project", name: "Atlas" },
  ...overrides,
});

function render(
  grant: string | null,
  overrides: Partial<TrashEarlyDeletePreview> = {},
) {
  return renderToStaticMarkup(
    <PermanentlyDeleteForm
      busy={false}
      error={null}
      grant={grant}
      identityPending={false}
      onCancel={noop}
      onConfirmIdentity={noop}
      onSubmit={noop}
      preview={preview(overrides)}
    />,
  );
}

describe("PermanentlyDeleteForm", () => {
  test("shows the effect, the consumed Confirm GitHub Identity step and a labelled name field", () => {
    const html = render(null);

    expect(html).toContain("Permanently Delete");
    expect(html).toContain("Work: Ship it");
    expect(html).toContain("Confirm GitHub Identity");
    expect(html).toContain("Type the Project name Atlas to confirm");
    expect(html).not.toContain("Keep approved surface");
    expect(html).not.toMatch(SECOND_FACTOR);
  });

  test("names a Project delete group as one unit and lists blockers as an alert", () => {
    const html = render("g", {
      blockers: ["active-surface"],
      groupId: "grp",
    });

    expect(html).toContain("removed as one unit");
    expect(html).toContain(
      "An active External Surface still uses this record.",
    );
    expect(html).toContain('role="alert"');
  });
});
