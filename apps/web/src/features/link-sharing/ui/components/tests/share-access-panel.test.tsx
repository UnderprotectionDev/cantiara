// @vitest-environment happy-dom
import { ORPCError } from "@orpc/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ShareAccessPanel } from "../share-access-panel";

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
  vi.restoreAllMocks();
});

type Props = ComponentProps<typeof ShareAccessPanel>;

function mount(overrides: Partial<Props> = {}) {
  const props: Props = {
    issuedToken: null,
    onRemovePassword: vi.fn(async () => undefined),
    onRotate: vi.fn(async () => undefined),
    onSavePassword: vi.fn(async () => undefined),
    passwordProtected: false,
    rotation: null,
    serverUrl: "https://api.cantiara.example/",
    ...overrides,
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const client = new QueryClient();
  act(() => {
    root?.render(
      <QueryClientProvider client={client}>
        <PanelWithMutation {...props} />
      </QueryClientProvider>,
    );
  });
  return props;
}

function PanelWithMutation(props: Props) {
  const rotation = useMutation({ mutationFn: props.onRotate });
  return (
    <ShareAccessPanel
      {...props}
      onRotate={rotation.mutateAsync}
      rotation={rotation}
    />
  );
}

const buttons = () =>
  [...(host?.querySelectorAll("button") ?? [])].map(
    (button) => button.textContent,
  );

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Share access panel", () => {
  test("shows the visitor link once, with a token-only path, and copies it", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mount({ issuedToken: "tok-123" });
    const input = host?.querySelector(
      "#share-visitor-link",
    ) as HTMLInputElement;
    expect(input.value).toBe("https://api.cantiara.example/s/tok-123");
    expect(input.readOnly).toBe(true);
    expect(buttons()).toContain("Copy link");
    act(() => {
      (
        [...(host?.querySelectorAll("button") ?? [])].find(
          (button) => button.textContent === "Copy link",
        ) as HTMLElement
      ).click();
    });
    await flush();
    expect(writeText).toHaveBeenCalledWith(
      "https://api.cantiara.example/s/tok-123",
    );
    expect(host?.textContent).toContain("Link copied.");
  });

  test("does not show a link it no longer knows and offers to rotate", () => {
    mount();
    expect(host?.querySelector("#share-visitor-link")).toBeNull();
    expect(buttons()).not.toContain("Copy link");
    expect(buttons()).toContain("Rotate link");
  });

  test.each(["Rotate link", "Remove password"])(
    "%s shows a typed Link Sharing refusal",
    async (action) => {
      const reject = vi.fn().mockRejectedValue(
        new ORPCError("LINK_SHARING_STATE_INVALID", {
          defined: true,
          status: 409,
        }),
      );
      mount({
        onRotate: reject,
        onRemovePassword: reject,
        passwordProtected: true,
      });
      act(() => {
        const button = [...(host?.querySelectorAll("button") ?? [])].find(
          (item) => item.textContent === action,
        );
        expect(button).toBeDefined();
        button?.click();
      });
      await flush();
      expect(host?.querySelector('[role="alert"]')?.textContent).toBe(
        "This action is unavailable for the current link state.",
      );
    },
  );

  test("adds a password through a labelled password field and reports it saved", async () => {
    const props = mount();
    const field = host?.querySelector(
      "#share-link-password",
    ) as HTMLInputElement;
    expect(field.type).toBe("password");
    expect(
      host?.querySelector('label[for="share-link-password"]')?.textContent,
    ).toContain("Link password");
    expect(buttons()).toContain("Add password");
    expect(buttons()).not.toContain("Remove password");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(field, "a long enough pass");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      host
        ?.querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(props.onSavePassword).toHaveBeenCalledWith("a long enough pass");
    expect(host?.querySelector('[role="status"]')?.textContent).toContain(
      "Password saved",
    );
  });

  test("refuses a short password with an announced error and sends nothing", async () => {
    const props = mount();
    await act(async () => {
      host
        ?.querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(props.onSavePassword).not.toHaveBeenCalled();
    expect(host?.querySelector('[role="alert"]')?.textContent).toContain(
      "at least 8",
    );
    expect(
      host?.querySelector("#share-link-password")?.getAttribute("aria-invalid"),
    ).toBe("true");
  });

  test("offers Change password and Remove password on a protected surface", async () => {
    const props = mount({ passwordProtected: true });
    expect(buttons()).toEqual(
      expect.arrayContaining(["Change password", "Remove password"]),
    );
    act(() => {
      (
        [...(host?.querySelectorAll("button") ?? [])].find(
          (button) => button.textContent === "Remove password",
        ) as HTMLElement
      ).click();
    });
    await flush();
    expect(props.onRemovePassword).toHaveBeenCalled();
  });
});
