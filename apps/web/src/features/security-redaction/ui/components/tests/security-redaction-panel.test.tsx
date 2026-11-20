// @vitest-environment happy-dom
import { ORPCError } from "@orpc/client";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SecurityRedactionPanel } from "../security-redaction-panel";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function click(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === label,
  );
  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }
  button.click();
}

function fill(host: HTMLElement, id: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(id);
  if (!field) {
    throw new Error(`Missing field: ${id}`);
  }
  const prototype =
    field instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

test.each([
  [
    "SECURITY_REDACTION_TYPED_NAME_MISMATCH",
    400,
    "Could not redact. Check the name and confirm again.",
  ],
  [
    "SECURITY_REDACTION_GRANT_REJECTED",
    403,
    "Confirm GitHub Identity was not accepted. Confirm again to redact.",
  ],
  [
    "SECURITY_REDACTION_SPREAD_INCOMPLETE",
    500,
    "Some copies could not be removed yet. Confirm again to retry; the removal is already recorded.",
  ],
] as const)(
  "Redact handles the typed refusal %s and asks for confirmation again",
  async (code, status, message) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const apply = vi
      .fn()
      .mockRejectedValue(new ORPCError(code, { defined: true, status }));
    try {
      act(() => {
        root.render(
          <SecurityRedactionPanel
            calls={{
              apply,
              confirmIdentity: vi.fn().mockResolvedValue("test-grant"),
              preview: vi.fn().mockResolvedValue({
                detectionLimit: "Synthetic preview",
                locators: [],
                notSearched: [],
                typedNameTarget: { kind: "Account", name: "Founder" },
              }),
            }}
            scope={{ kind: "Account" }}
          />,
        );
      });
      act(() => click(host, "Redact"));
      act(() => fill(host, "#redact-value", "synthetic value"));
      await act(() => {
        click(host, "Preview");
        return Promise.resolve();
      });
      await act(() => {
        click(host, "Confirm GitHub Identity");
        return Promise.resolve();
      });
      act(() => fill(host, "#redact-typed-name", "Founder"));
      act(() => fill(host, "#redact-reason", "Remove synthetic value"));
      await act(() => {
        click(host, "Redact");
        return Promise.resolve();
      });

      expect(apply).toHaveBeenCalledOnce();
      expect(host.querySelector('[role="alert"]')?.textContent).toBe(message);
      expect(host.querySelector("button[type=submit]")).toHaveProperty(
        "disabled",
        true,
      );
      expect(
        [...host.querySelectorAll("button")].find(
          (button) => button.textContent === "Confirm GitHub Identity",
        ),
      ).toHaveProperty("disabled", false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  },
);
