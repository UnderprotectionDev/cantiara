import { MutationObserver } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createClientShellQueryClient } from "./client-shell";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const supportError = {
  data: {
    reasonCode: "unexpected",
    retryPolicy: "once",
    supportReference: "SUP-123E4567-E89B-12D3-A456-426614174000",
    writeOutcome: "not-written",
  },
};

interface SupportToastOptions {
  action?: {
    label?: string;
    onClick?: (event: unknown) => unknown;
  };
  description?: unknown;
  duration?: number;
}

describe("Client Shell query error boundary", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  test("uses the Support reference notice for query failures", async () => {
    const queryClient = createClientShellQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryFn: () => {
          throw supportError;
        },
        queryKey: ["failed-list"],
        retry: false,
      }),
    ).rejects.toBe(supportError);

    expect(toast.error).toHaveBeenCalledWith(
      "This action could not be completed.",
      expect.objectContaining({
        duration: expect.any(Number),
      }),
    );
    const [, options] = vi.mocked(toast.error).mock.calls[0] ?? [];
    const supportOptions = options as SupportToastOptions | undefined;
    expect(supportOptions?.action).toBeUndefined();
    expect(supportOptions?.description).toBeDefined();
  });

  test("keeps one Retry action for an unwritten mutation", async () => {
    const queryClient = createClientShellQueryClient();
    let attempts = 0;
    const mutation = new MutationObserver(queryClient, {
      meta: { writeOutcome: "not-written" },
      mutationFn: () => {
        attempts += 1;
        throw supportError;
      },
    });

    await expect(mutation.mutate(undefined)).rejects.toBe(supportError);

    const [firstCall] = vi.mocked(toast.error).mock.calls;
    const [, firstOptions] = firstCall ?? [];
    const supportFirstOptions = firstOptions as SupportToastOptions | undefined;
    expect(supportFirstOptions?.duration).toBe(Number.POSITIVE_INFINITY);
    expect(supportFirstOptions?.action?.label).toBe("Retry");

    await supportFirstOptions?.action?.onClick?.({});
    expect(attempts).toBe(2);
    await vi.waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(2);
    });

    const [, secondCall] = vi.mocked(toast.error).mock.calls;
    const [, secondOptions] = secondCall ?? [];
    const supportSecondOptions = secondOptions as
      | SupportToastOptions
      | undefined;
    expect(supportSecondOptions?.action).toBeUndefined();
    expect(supportSecondOptions?.duration).toBeGreaterThan(0);
  });

  test("does not offer Retry after a written mutation failure", async () => {
    const queryClient = createClientShellQueryClient();
    const writtenError = {
      ...supportError,
      data: { ...supportError.data, writeOutcome: "written" },
    };
    const mutation = new MutationObserver(queryClient, {
      meta: { writeOutcome: "written" },
      mutationFn: () => {
        throw writtenError;
      },
    });

    await expect(mutation.mutate(undefined)).rejects.toBe(writtenError);

    const [, options] = vi.mocked(toast.error).mock.calls[0] ?? [];
    const supportOptions = options as SupportToastOptions | undefined;
    expect(supportOptions?.action).toBeUndefined();
    expect(supportOptions?.duration).toBeGreaterThan(0);
  });
});
