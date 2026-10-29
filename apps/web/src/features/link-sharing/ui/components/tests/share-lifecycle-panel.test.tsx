// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ShareLifecyclePanel } from "../share-lifecycle-panel";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

type Props = ComponentProps<typeof ShareLifecyclePanel>;

function mount(overrides: Partial<Props> = {}) {
  const props: Props = {
    onReopen: vi.fn(async () => undefined),
    onReshare: vi.fn(async () => undefined),
    onRevoke: vi.fn(async () => undefined),
    onSetExpiry: vi.fn(async () => undefined),
    surface: { expiresAt: null, state: "Active" },
    timeZone: "Europe/Istanbul",
    ...overrides,
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<ShareLifecyclePanel {...props} />);
  });
  return props;
}

const button = (name: string) =>
  [...(host?.querySelectorAll("button") ?? [])].find(
    (entry) => entry.textContent === name,
  );
const buttonNames = () =>
  [...(host?.querySelectorAll("button") ?? [])].map(
    (entry) => entry.textContent,
  );

async function click(name: string) {
  const target = button(name);
  if (!target) {
    throw new Error(`No button ${name}: ${buttonNames().join(", ")}`);
  }
  await act(async () => {
    target.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const EXPIRED = {
  expiresAt: "2026-10-01T09:00:00.000Z",
  state: "Expired" as const,
};

describe("Share lifecycle panel", () => {
  test("an active link with no default expiry offers Set expiry and Revoke", () => {
    mount();
    expect(host?.textContent).toContain("No expiry");
    expect(buttonNames()).toContain("Set expiry");
    expect(buttonNames()).toContain("Revoke");
    expect(buttonNames()).not.toContain("Remove expiry");
    expect(buttonNames()).not.toContain("Reopen the same link");
  });

  test("an active link with an expiry shows it in the profile time zone and can remove it", async () => {
    const props = mount({
      surface: { expiresAt: "2099-10-01T09:00:00.000Z", state: "Active" },
    });
    expect(host?.textContent).toContain("2099-10-01 12:00 (Europe/Istanbul)");
    await click("Remove expiry");
    expect(props.onSetExpiry).toHaveBeenCalledWith(null);
    expect(host?.querySelector('[role="status"]')?.textContent).toContain(
      "Expiry removed",
    );
  });

  test("Revoke is terminal: it warns first and runs only after the confirmation", async () => {
    const props = mount();
    await click("Revoke");
    expect(props.onRevoke).not.toHaveBeenCalled();
    const group = host?.querySelector("fieldset");
    expect(group?.textContent).toContain("Revoke is permanent");
    expect(group?.textContent).toContain("never work again");
    expect(document.activeElement?.textContent).toBe("Revoke this link?");
    await click("Cancel");
    expect(host?.querySelector("fieldset")).toBeNull();
    await click("Revoke");
    await click("Revoke");
    expect(props.onRevoke).toHaveBeenCalledTimes(1);
  });

  test("after expiry Reshare with a new link and Reopen the same link are two separate actions", async () => {
    const props = mount({ surface: EXPIRED });
    expect(host?.querySelector('[role="status"]')?.textContent).toContain(
      "Expired",
    );
    expect(buttonNames()).toContain("Reshare with a new link");
    expect(buttonNames()).toContain("Reopen the same link");
    expect(buttonNames()).not.toContain("Set expiry");
    await click("Reshare with a new link");
    expect(props.onReshare).toHaveBeenCalledTimes(1);
    expect(props.onReopen).not.toHaveBeenCalled();
  });

  test("Reopen the same link warns that old holders return and needs an extra confirmation", async () => {
    const props = mount({ surface: EXPIRED });
    await click("Reopen the same link");
    expect(props.onReopen).not.toHaveBeenCalled();
    const group = host?.querySelector("fieldset");
    expect(group?.textContent).toContain("every old holder");
    const confirm = button("Reopen the same link");
    expect(confirm?.disabled).toBe(true);
    await click("Reopen the same link");
    expect(props.onReopen).not.toHaveBeenCalled();
    const acknowledge = host?.querySelector<HTMLElement>(
      "label[for='share-confirm-acknowledge']",
    );
    await act(async () => {
      acknowledge?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(button("Reopen the same link")?.disabled).toBe(false);
    await click("Reopen the same link");
    expect(props.onReopen).toHaveBeenCalledTimes(1);
    expect(props.onReshare).not.toHaveBeenCalled();
  });

  test("a failed action says so and keeps the confirmation open", async () => {
    mount({
      onRevoke: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    await click("Revoke");
    await click("Revoke");
    expect(host?.querySelector('[role="alert"]')?.textContent).toContain(
      "did not work",
    );
    expect(host?.querySelector("fieldset")).not.toBeNull();
  });
});
