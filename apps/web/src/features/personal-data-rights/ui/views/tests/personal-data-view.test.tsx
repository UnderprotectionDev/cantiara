// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test handlers are inline doubles.
import type { PersonalDataPreview } from "@cantiara/api/personal-data-rights";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { personalDataRefusalMessage } from "../../../lib/personal-data-refusal";
import { PersonalDataPreviewPanel } from "../../components/personal-data-preview-panel";
import { PersonalDataView } from "../personal-data-view";

const NAMES_OTHER_FLOWS = /exit package|close account|restore/i;

const preview: PersonalDataPreview = {
  contactId: "c1",
  contactLabel: "Ada Lovelace",
  excluded: ["Other Contacts"],
  fingerprint: "f",
  notice: "Not a Workspace archive and cannot be used to restore records.",
  sources: [
    { items: [{ id: "c1", label: "Ada Lovelace" }], kind: "Contact" },
    { items: [{ id: "f1", label: "Export request" }], kind: "Feedback" },
  ],
};

const never = () => Promise.reject(new Error("unused"));

describe("Export Personal Data view", () => {
  test("uses the English label and names no Exit Package or closure", () => {
    const html = renderToStaticMarkup(
      <PersonalDataView
        contacts={[{ id: "c1", label: "Ada Lovelace" }]}
        onPreview={never}
        onProduce={never}
      />,
    );
    expect(html).toContain("Export Personal Data");
    expect(html).not.toMatch(NAMES_OTHER_FLOWS);
  });

  test("preview lists sources and exclusions before the package is created", () => {
    const html = renderToStaticMarkup(
      <PersonalDataPreviewPanel
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        preview={preview}
        produced={null}
      />,
    );
    expect(html).toContain("Export request");
    expect(html).toContain("Never included");
    expect(html).toContain("Other Contacts");
    expect(html).toContain("Create package");
    expect(html).not.toContain("Download");
  });

  test("a refusal code shows its stable message", () => {
    expect(
      personalDataRefusalMessage({ data: { code: "preview_required" } }),
    ).toContain("Review the preview");
    expect(personalDataRefusalMessage(new Error("x"))).toContain("Try again");
  });
});
