// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test handlers are inline doubles.

import {
  ERASE_PERSONAL_DATA_LABEL,
  EXPORT_PERSONAL_DATA_LABEL,
  type PersonalDataErasePreview,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { usePersonalDataEraseFlow } from "../../../hooks/use-personal-data-erase-flow";
import { personalDataRefusalMessage } from "../../../lib/personal-data-refusal";
import { PersonalDataEraseForm } from "../../forms/personal-data-erase-form";
import { PersonalDataPreviewPanel } from "../../forms/personal-data-preview-form";
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
      <QueryClientProvider client={new QueryClient()}>
        <PersonalDataView
          contacts={[{ id: "c1", label: "Ada Lovelace" }]}
          onConfirmIdentity={never}
          onErase={never}
          onPreview={never}
          onPreviewErase={never}
          onProduce={never}
        />
      </QueryClientProvider>,
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
        new ORPCError("PERSONAL_DATA_PREVIEW_REQUIRED", {
          status: 400,
          defined: true,
        }),
        EXPORT_PERSONAL_DATA_LABEL,
      ),
    ).toContain("Review the preview");
    expect(
      personalDataRefusalMessage(new Error("x"), ERASE_PERSONAL_DATA_LABEL),
    ).toContain("Erase Personal Data could not be completed");
    expect(
      personalDataRefusalMessage(
        new ORPCError("PERSONAL_DATA_TOMBSTONE_INCOMPLETE", { defined: true }),
        ERASE_PERSONAL_DATA_LABEL,
      ),
    ).toContain("not fully cleared");
  });

  test("erase review lists impact and copies, and gates on grant plus typed Account name", () => {
    const html = renderToStaticMarkup(
      <PersonalDataEraseForm
        busy={false}
        grant={false}
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

describe("Export Personal Data package form", () => {
  test("Create package submits the chosen format", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const onConfirm = (await import("vitest")).vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        <PersonalDataPreviewPanel
          disabled={false}
          onCancel={() => undefined}
          onConfirm={onConfirm}
          preview={preview}
          produced={null}
        />,
      );
    });
    await act(async () => {
      (
        host.querySelector("#personal-data-format-Markdown") as HTMLElement
      ).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      host
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onConfirm).toHaveBeenCalledWith("Markdown");
    act(() => root.unmount());
    host.remove();
  });
});

test("a failed erase requires a new identity grant and keeps grants outside Query", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const queryClient = new QueryClient();
  const root = createRoot(document.createElement("div"));
  const onConfirmIdentity = vi
    .fn()
    .mockResolvedValueOnce("first-test-grant")
    .mockResolvedValueOnce("second-test-grant");
  const onErase = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({});
  let flow: ReturnType<typeof usePersonalDataEraseFlow> | undefined;
  function Probe() {
    flow = usePersonalDataEraseFlow({
      onConfirmIdentity,
      onErase,
      onPreview: () => Promise.resolve(erasePreview),
    });
    return null;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
    function current() {
      if (!flow) {
        throw new Error("Erase flow is unavailable.");
      }
      return flow;
    }
    await act(async () => current().review("c1"));
    await vi.waitFor(() => expect(current().preview).toEqual(erasePreview));
    await act(async () => current().confirmIdentity());
    await vi.waitFor(() => expect(current().grant).toBe(true));
    await act(async () => current().erase("Mert"));
    await act(async () => current().erase("Mert"));
    expect(onErase).toHaveBeenCalledTimes(1);
    await act(async () => current().confirmIdentity());
    await vi.waitFor(() => expect(current().grant).toBe(true));
    await act(async () => current().erase("Mert"));
    expect(onErase.mock.calls.map(([, input]) => input.grant)).toEqual([
      "first-test-grant",
      "second-test-grant",
    ]);
    expect(
      JSON.stringify(
        queryClient
          .getMutationCache()
          .getAll()
          .map(({ state }) => state),
      ),
    ).not.toContain("-test-grant");
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
  }
});
