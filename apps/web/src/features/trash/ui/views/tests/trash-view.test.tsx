import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { TrashView } from "../trash-view";

const moved = () => Promise.resolve();

describe("TrashView", () => {
  test("offers Move to Trash per live record and states the 30-day window", () => {
    const html = renderToStaticMarkup(
      <TrashView
        candidates={[{ id: "r1", kind: "Risk", label: "Slip", revision: 2 }]}
        entries={[]}
        formatting={DEFAULT_ACCOUNT_PREFERENCES}
        onMove={moved}
      />,
    );

    expect(html).toContain("Move to Trash: Slip");
    expect(html).toContain("30");
    expect(html).toContain(">Trash<");
  });
});
