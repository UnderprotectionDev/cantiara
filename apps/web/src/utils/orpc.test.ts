import { afterEach, describe, expect, it, vi } from "vitest";

const showMainFlowFailure = vi.fn();
const showQueryMainFlowFailure = vi.fn();

vi.mock("@/features/web-macos-client/show-main-flow-failure", () => ({
	showMainFlowFailure,
	showQueryMainFlowFailure,
}));

describe("createQueryClient", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("refetches a failed query when its retry action is invoked", async () => {
		const { createQueryClient } = await import("./orpc");
		const queryClient = createQueryClient();
		const queryFn = vi
			.fn()
			.mockRejectedValueOnce(new Error("temporary failure"))
			.mockResolvedValue("fresh value");

		try {
			await expect(
				queryClient.fetchQuery({
					queryFn,
					queryKey: ["query-retry-test"],
				})
			).rejects.toThrow("temporary failure");

			expect(showQueryMainFlowFailure).toHaveBeenCalledOnce();
			const retry = showQueryMainFlowFailure.mock.calls[0]?.[1];
			expect(retry).toBeTypeOf("function");

			retry?.();

			await vi.waitFor(() => {
				expect(queryFn).toHaveBeenCalledTimes(2);
				expect(queryClient.getQueryData(["query-retry-test"])).toBe(
					"fresh value"
				);
			});
		} finally {
			queryClient.clear();
		}
	});
});
