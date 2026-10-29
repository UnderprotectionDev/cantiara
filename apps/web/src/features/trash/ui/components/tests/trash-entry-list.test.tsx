import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { TrashEntry } from "@cantiara/api/trash";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { TrashEntryList } from "../trash-entry-list";

const CONTROL_OR_LIFECYCLE_COPY = /<button|Restore|Permanently Delete|Archive/;

const entry: TrashEntry = {
  expiresAt: "2026-03-31T00:00:00.000Z",
  groupId: null,
  id: "e1",
  projectId: "p1",
  recordId: "r1",
  recordKind: "Risk",
  recordLabel: "Slip",
  trashedAt: "2026-03-01T00:00:00.000Z",
  workspaceId: "w1",
};

describe("TrashEntryList", () => {
  test("names each Trash entry with its kind, label and expiry", () => {
    const html = renderToStaticMarkup(
      <TrashEntryList
        entries={[entry]}
        formatting={DEFAULT_ACCOUNT_PREFERENCES}
      />,
    );

    expect(html).toContain("Trash entries");
    expect(html).toContain("Risk");
    expect(html).toContain("Slip");
    expect(html).toContain('dateTime="2026-03-31T00:00:00.000Z"');
  });

  test("offers no restore, delete or archive control yet", () => {
    const html = renderToStaticMarkup(
      <TrashEntryList
        entries={[entry]}
        formatting={DEFAULT_ACCOUNT_PREFERENCES}
      />,
    );

    expect(html).not.toMatch(CONTROL_OR_LIFECYCLE_COPY);
  });

  test("says Trash is empty", () => {
    const html = renderToStaticMarkup(
      <TrashEntryList entries={[]} formatting={DEFAULT_ACCOUNT_PREFERENCES} />,
    );

    expect(html).toContain("Nothing in Trash.");
  });
});
