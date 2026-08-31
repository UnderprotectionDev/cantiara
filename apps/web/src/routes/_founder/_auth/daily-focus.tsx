import { createFileRoute } from "@tanstack/react-router";

import DailyFocusArea from "@/features/daily-focus/views/daily-focus-area";

export const Route = createFileRoute("/_founder/_auth/daily-focus")({
	component: DailyFocusArea,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				context.orpc.dailyFocus.catalog.queryOptions()
			),
			context.queryClient.ensureQueryData(
				context.orpc.dailyFocus.view.queryOptions({ input: {} })
			),
		]),
});
