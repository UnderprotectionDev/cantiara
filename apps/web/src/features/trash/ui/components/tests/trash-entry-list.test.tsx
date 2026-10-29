import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { TrashEntry } from "@cantiara/api/trash";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { TrashEntryList } from "../trash-entry-list";

const DELETE_OR_ARCHIVE_COPY = /Permanently Delete|Archive|restore point/i;

const noop = () => undefined;

const entry: TrashEntry = {
  expiresAt: "2026-03-31T00:00:00.000Z",
  groupId: null,
  id: "e1",
  projectId: "p1",
  recordId: "r1",
  recordKind: "Risk",
  recordLabel: "Slip",
  revision: 3,
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

  test("marks each row In Trash and offers a labelled Restore button", () => {
    const html = renderToStaticMarkup(
      <TrashEntryList
        entries={[entry]}
        formatting={DEFAULT_ACCOUNT_PREFERENCES}
        onRestore={noop}
      />,
    );

    expect(html).toContain("In Trash");
    expect(html).toContain('aria-label="Restore: Slip"');
    expect(html).toContain("<button");
    expect(html).not.toMatch(DELETE_OR_ARCHIVE_COPY);
  });

  test("a group row says it restores with its Project delete group", () => {
    const html = renderToStaticMarkup(
      <TrashEntryList
        entries={[{ ...entry, groupId: "g1" }]}
        formatting={DEFAULT_ACCOUNT_PREFERENCES}
        onRestore={noop}
      />,
    );

    expect(html).toContain("Project delete group");
  });

  test("offers no Restore without a handler", () => {
    const html = renderToStaticMarkup(
      <TrashEntryList
        entries={[entry]}
        formatting={DEFAULT_ACCOUNT_PREFERENCES}
      />,
    );

    expect(html).not.toContain("<button");
  });

  test("says Trash is empty", () => {
    const html = renderToStaticMarkup(
      <TrashEntryList entries={[]} formatting={DEFAULT_ACCOUNT_PREFERENCES} />,
    );

    expect(html).toContain("Nothing in Trash.");
  });
});
