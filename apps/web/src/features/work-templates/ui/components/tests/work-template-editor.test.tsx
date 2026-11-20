// @vitest-environment happy-dom
import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import type { WorkTemplate } from "@cantiara/api/work-templates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { createClientShellQueryClient } from "@/features/web-macos-client/lib/client-shell";
import { orpc } from "@/utils/orpc";
import WorkTemplateEditor from "../work-template-editor";

const rpc = vi.hoisted(() => ({ instantiateWorkTemplate: vi.fn() }));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: rpc };
});

const template: WorkTemplate = {
  checklist: [{ id: "check-1", text: "Draft release notes" }],
  createdAt: "2026-09-22T09:00:00.000Z",
  customFieldDefaults: [
    {
      definitionId: "field-1",
      value: { kind: "option", option: "Ready" },
    },
  ],
  descriptionSkeleton: "## Outcome",
  id: "template-1",
  name: "Release preparation",
  projectId: "project-1",
  relativeDates: {
    plannedStart: { offsetDays: 2 },
    target: { offsetDays: 10 },
  },
  revision: 1,
  trashedAt: null,
  type: "Task",
  updatedAt: "2026-09-22T09:00:00.000Z",
};

const field: CustomFieldDefinition = {
  createdAt: "2026-09-20T09:00:00.000Z",
  id: "field-1",
  name: "Release readiness",
  options: ["Ready", "Later"],
  projectId: "project-1",
  recordTypes: ["Work"],
  revision: 1,
  trashedAt: null,
  type: "Single select",
  updatedAt: "2026-09-20T09:00:00.000Z",
};

describe("Work Template editor", () => {
  test("shows reusable start context and resolved date previews without forbidden payload controls", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.workTemplates.queryOptions({ input: { projectId: "project-1" } })
        .queryKey,
      [template],
    );
    queryClient.setQueryData(
      orpc.customFields.queryOptions({ input: { projectId: "project-1" } })
        .queryKey,
      [field],
    );

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(WorkTemplateEditor, {
          previewDate: "2026-09-22",
          projectId: "project-1",
        }),
      ),
    );

    expect(html).toContain("Work Template");
    expect(html).toContain("Release preparation");
    expect(html).toContain("Release readiness");
    expect(html).toContain("2026-09-24");
    expect(html).toContain("2026-10-02");
    expect(html).toContain("Move to Trash");
    expect(html).toContain("Create from template");
    for (const forbidden of [
      "Current status",
      "Closure result",
      "Relations",
      "History",
      "Absolute date",
      "Document Template",
      "Capture mini-template",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });
});

test("retries Create from template with the same command and refreshes the relevant lists", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const presentFailure = vi.fn();
  const queryClient = createClientShellQueryClient(presentFailure);
  queryClient.setDefaultOptions({
    queries: { staleTime: Number.POSITIVE_INFINITY },
  });
  const projectId = "project-1";
  queryClient.setQueryData(
    orpc.workTemplates.queryKey({ input: { projectId } }),
    [template],
  );
  queryClient.setQueryData(
    orpc.customFields.queryKey({ input: { projectId } }),
    [field],
  );
  const projectWorkKey = orpc.projectWorks.queryKey({ input: { projectId } });
  const otherProjectKey = orpc.projectWorks.queryKey({
    input: { projectId: "project-2" },
  });
  queryClient.setQueryData(projectWorkKey, []);
  queryClient.setQueryData(otherProjectKey, []);
  const writeError = new Error("Work could not be saved. Try again.");
  rpc.instantiateWorkTemplate
    .mockRejectedValueOnce(writeError)
    .mockResolvedValue({ key: "PAY-42", projectId });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      await Promise.resolve();
      root.render(
        <QueryClientProvider client={queryClient}>
          <WorkTemplateEditor previewDate="2026-09-22" projectId={projectId} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Create from template")
        ?.click();
    });
    const form = host.querySelector(
      'form[aria-label="Create Work from Release preparation"]',
    );
    const title = form?.querySelector("input");
    if (!(form && title)) {
      throw new Error("Create from template form did not render");
    }
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(title, "Ship release");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(title.value).toBe("Ship release");
    expect(host.textContent).toContain(writeError.message);
    expect(queryClient.getQueryState(projectWorkKey)?.isInvalidated).toBe(
      false,
    );

    await act(async () => {
      await presentFailure.mock.calls[0]?.[1].retry?.();
    });
    expect(rpc.instantiateWorkTemplate).toHaveBeenCalledTimes(2);
    expect(rpc.instantiateWorkTemplate.mock.calls[1][0]).toEqual(
      rpc.instantiateWorkTemplate.mock.calls[0][0],
    );
    expect(queryClient.getQueryState(projectWorkKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherProjectKey)?.isInvalidated).toBe(
      false,
    );
    expect(host.textContent).toContain("Created Work PAY-42.");
    expect(host.textContent).not.toContain(writeError.message);
  } finally {
    act(() => root.unmount());
    host.remove();
    queryClient.clear();
  }
});
