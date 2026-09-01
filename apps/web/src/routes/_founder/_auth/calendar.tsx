import { createFileRoute } from "@tanstack/react-router";

import UnifiedCalendarArea from "@/features/unified-calendar/views/unified-calendar-area";

export const Route = createFileRoute("/_founder/_auth/calendar")({
	component: UnifiedCalendarArea,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				context.orpc.unifiedCalendar.catalog.queryOptions()
			),
			context.queryClient.ensureQueryData(
				context.orpc.unifiedCalendar.view.queryOptions({ input: {} })
			),
		]),
});
