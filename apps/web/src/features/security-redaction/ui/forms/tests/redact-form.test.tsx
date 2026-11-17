// @vitest-environment happy-dom
import type { SecurityRedactionPreview } from "@cantiara/api/security-redaction";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { RedactForm } from "../redact-form";

const NOT_PASSWORD_COPY = /password|MFA|refresh your session/i;
const noop = () => undefined;

/** Only the visible copy: the value input's `type="password"` attribute is fine. */
function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

const preview: SecurityRedactionPreview = {
  detectionLimit: "Cantiara does not detect secrets in free Markdown.",
  locators: [
    {
      kind: "history-revision",
      location: "revision 2",
      recordId: "w1",
      recordKind: "Work",
    },
  ],
  notSearched: ["cache"],
  typedNameTarget: { kind: "Project", name: "Atlas" },
};

function render(withPreview: boolean) {
  return renderToStaticMarkup(
    <RedactForm
      busy={false}
      error={null}
      grant={null}
      identityPending={false}
      onCancel={noop}
      onConfirmIdentity={noop}
      onPreview={noop}
      onSubmit={noop}
      preview={withPreview ? preview : null}
    />,
  );
}

describe("RedactForm", () => {
  test("starts with the labelled value field and Preview, no grant step yet", () => {
    const html = render(false);
    expect(html).toContain("Redact");
    expect(html).toContain("Value to remove");
    expect(html).toContain("Preview");
    expect(html).not.toContain("Confirm GitHub Identity");
  });

  test("the review shows locators, the free Markdown limit, the grant label and the typed-name prompt", () => {
    const html = render(true);
    expect(html).toContain("History revision");
    expect(html).toContain("does not detect secrets in free Markdown");
    expect(html).toContain("Not searched yet: Cache");
    expect(html).toContain("Confirm GitHub Identity");
    expect(html).toContain("Type the Project name Atlas to confirm");
    expect(html).toContain("Reason");
    expect(visibleText(html)).not.toMatch(NOT_PASSWORD_COPY);
  });

  test("submitting without a reason shows no message and sends nothing", async () => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        <RedactForm
          busy={false}
          error={null}
          grant="grant"
          identityPending={false}
          onCancel={noop}
          onConfirmIdentity={noop}
          onPreview={noop}
          onSubmit={onSubmit}
          preview={preview}
        />,
      );
    });
    await act(async () => {
      host
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});
