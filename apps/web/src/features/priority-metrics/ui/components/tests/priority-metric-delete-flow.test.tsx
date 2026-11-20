// @vitest-environment happy-dom

import type { PriorityMetric } from "@cantiara/api/priority-metrics";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import PriorityMetricEditor from "../priority-metric-editor";

const rpc = vi.hoisted(() => ({
  deletePriorityMetric: vi.fn(),
  requestGrant: vi.fn(),
}));
vi.mock("@/utils/orpc", async (importActual) => ({
  ...(await importActual<typeof import("@/utils/orpc")>()),
  client: rpc,
}));
vi.mock("@/features/account-access/lib/github-identity-confirmation", () => ({
  requestGitHubIdentityGrant: rpc.requestGrant,
}));

const metric = {
  createdAt: "2026-09-20T09:00:00.000Z",
  enabled: false,
  id: "metric-1",
  name: "Evidence strength",
  projectId: "project-1",
  rankDescriptions: {
    High: "",
    Low: "",
    Medium: "",
    "Very high": "",
    "Very low": "",
  },
  revision: 2,
  shortDescription: "How strongly evidence supports this Work.",
  trashedAt: "2026-11-18T10:00:00.000Z",
  updatedAt: "2026-11-18T10:00:00.000Z",
} satisfies PriorityMetric;

test("permanent delete reuses its command after fresh identity and keeps confirmation out of Query", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const projectName = crypto.randomUUID();
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  const cancelled = crypto.randomUUID();
  const oldConfirmation = Promise.withResolvers<string>();
  rpc.requestGrant
    .mockReturnValueOnce(oldConfirmation.promise)
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  rpc.deletePriorityMetric
    .mockRejectedValueOnce(new Error([first, projectName].join(" ")))
    .mockResolvedValueOnce({ id: metric.id });
  const exposed: boolean[] = [];
  function observe(value: unknown) {
    const serialized = JSON.stringify({ value }, (_, entry) =>
      entry instanceof Error
        ? { ...entry, message: entry.message, cause: entry.cause }
        : entry,
    );
    exposed.push(
      [cancelled, first, second, projectName].some((secret) =>
        serialized.includes(secret),
      ),
    );
  }
  const mutationCache = new MutationCache({
    onError: (error, variables) => {
      observe(error);
      observe(variables);
    },
    onSuccess: (result, variables) => {
      observe(result);
      observe(variables);
    },
  });
  const queries = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
    mutationCache,
  });
  const definitions = orpc.priorityMetrics.queryKey({
    input: { projectId: metric.projectId },
  });
  const otherDefinitions = orpc.priorityMetrics.queryKey({
    input: { projectId: "other-project" },
  });
  queries.setQueryData(definitions, [metric]);
  queries.setQueryData(
    orpc.priorityMetricTrashImpactPreview.queryKey({
      input: { metricId: metric.id },
    }),
    {
      attachedExternalSurfaceCount: 0,
      dependentRuleCount: 0,
      dependentViewCount: 0,
      storedWorkValueCount: 0,
    },
  );
  const invalidate = vi.spyOn(queries, "invalidateQueries").mockResolvedValue();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const form = () =>
    host.querySelector('[aria-label="Permanently Delete priority metric"]');
  async function click(label: string) {
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === label)
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  async function submit() {
    await act(async () => {
      form()?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  try {
    act(() =>
      root.render(
        <QueryClientProvider client={queries}>
          <PriorityMetricEditor
            projectId={metric.projectId}
            projectName={projectName}
          />
        </QueryClientProvider>,
      ),
    );
    await click("Permanently Delete");
    await click("Confirm GitHub Identity");
    await click("Cancel");
    await click("Permanently Delete");
    await act(async () => {
      oldConfirmation.resolve(cancelled);
      await oldConfirmation.promise;
    });
    expect(form()?.textContent).not.toContain("GitHub identity confirmed.");
    await click("Confirm GitHub Identity");
    await vi.waitFor(() =>
      expect(form()?.textContent).toContain("GitHub identity confirmed."),
    );
    const input = host.querySelector<HTMLInputElement>(
      "#priority-metric-delete-project-name",
    );
    act(() => {
      if (input) {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(input, projectName);
        input.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    });
    await submit();
    await vi.waitFor(() =>
      expect(rpc.deletePriorityMetric).toHaveBeenCalledTimes(1),
    );
    expect(exposed.includes(true)).toBe(false);
    await vi.waitFor(() => {
      expect(form()?.textContent).not.toContain("GitHub identity confirmed.");
      const confirm = [...host.querySelectorAll("button")].find(
        (button) => button.textContent === "Confirm GitHub Identity",
      );
      expect(confirm?.disabled).toBe(false);
    });
    await click("Confirm GitHub Identity");
    await vi.waitFor(() =>
      expect(form()?.textContent).toContain("GitHub identity confirmed."),
    );
    await submit();
    await vi.waitFor(() =>
      expect(rpc.deletePriorityMetric).toHaveBeenCalledTimes(2),
    );
    const [[before], [after]] = rpc.deletePriorityMetric.mock.calls;
    expect(before.clientIdempotencyKey).toBe(after.clientIdempotencyKey);
    expect(before.grant === first && after.grant === second).toBe(true);
    expect(exposed.length).toBeGreaterThan(1);
    expect(exposed.includes(true)).toBe(false);
    for (const entry of mutationCache.getAll()) {
      observe(entry.state.data);
      observe(entry.state.variables);
      observe(entry.state.error);
    }
    expect(exposed.includes(true)).toBe(false);
    await vi.waitFor(() => expect(form()).toBeNull());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: definitions });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: otherDefinitions });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: orpc.priorityMetrics.key(),
    });
  } finally {
    act(() => root.unmount());
    host.remove();
    queries.clear();
  }
});
