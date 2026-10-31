// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test handlers are inline doubles.
import {
  ERASE_PERSONAL_DATA_LABEL,
  EXPORT_PERSONAL_DATA_LABEL,
  type PersonalDataErasePreview,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { personalDataRefusalMessage } from "../../../lib/personal-data-refusal";
import { PersonalDataPreviewPanel } from "../../components/personal-data-preview-panel";
import { PersonalDataEraseForm } from "../../forms/personal-data-erase-form";
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

const SUBMIT_DISABLED = /<button type="submit"[^>]*disabled=""/;
const NAMES_PASSWORD_OR_MFA = /password|mfa|two-factor|one-time code/i;

const erasePreview: PersonalDataErasePreview = {
  contactId: "c1",
  contactLabel: "Ada Lovelace",
  copies: [
    {
      kind: "external-surface-snapshot",
      location: "snapshot",
      recordId: "surface-1",
      recordKind: "External Surface",
    },
  ],
  fingerprint: "f",
  notices: [
    "Erasing is irreversible.",
    "Special-category data is not a first-product data type.",
  ],
  notSearched: ["export-staging"],
  sources: [{ items: [{ id: "c1", label: "Ada Lovelace" }], kind: "Contact" }],
  typedNameTarget: { kind: "Account", name: "Mert" },
};

const never = () => Promise.reject(new Error("unused"));

describe("Export Personal Data view", () => {
  test("uses the English label and names no Exit Package or closure", () => {
    const html = renderToStaticMarkup(
      <PersonalDataView
        contacts={[{ id: "c1", label: "Ada Lovelace" }]}
        onConfirmIdentity={never}
        onErase={never}
        onPreview={never}
        onPreviewErase={never}
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
      personalDataRefusalMessage(
        { data: { code: "preview_required" } },
        EXPORT_PERSONAL_DATA_LABEL,
      ),
    ).toContain("Review the preview");
    expect(
      personalDataRefusalMessage(new Error("x"), ERASE_PERSONAL_DATA_LABEL),
    ).toContain("Erase Personal Data could not be completed");
    expect(
      personalDataRefusalMessage(
        { data: { code: "tombstone_incomplete" } },
        ERASE_PERSONAL_DATA_LABEL,
      ),
    ).toContain("not fully cleared");
  });

  test("erase review lists impact and copies, and gates on grant plus typed Account name", () => {
    const html = renderToStaticMarkup(
      <PersonalDataEraseForm
        busy={false}
        grant={null}
        identityPending={false}
        onCancel={() => undefined}
        onConfirmIdentity={() => undefined}
        onErase={() => undefined}
        preview={erasePreview}
      />,
    );
    expect(html).toContain("Erase Personal Data");
    expect(html).toContain("External Surface snapshot");
    expect(html).toContain("Export staging");
    expect(html).toContain("Special-category data");
    expect(html).toContain("Confirm GitHub Identity");
    expect(html).toContain("Type the Account name");
    // Submit stays disabled without the grant.
    expect(html).toMatch(SUBMIT_DISABLED);
    expect(html).not.toMatch(NAMES_PASSWORD_OR_MFA);
    expect(html).not.toMatch(NAMES_OTHER_FLOWS);
  });
});
