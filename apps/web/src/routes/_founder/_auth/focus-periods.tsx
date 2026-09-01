import { createFileRoute } from "@tanstack/react-router";

import FocusPeriodArea from "@/features/focus-period/views/focus-period-area";

export const Route = createFileRoute("/_founder/_auth/focus-periods")({
	component: FocusPeriodArea,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				context.orpc.focusPeriod.catalog.queryOptions()
			),
			context.queryClient.ensureQueryData(
				context.orpc.focusPeriod.list.queryOptions()
			),
		]),
});
