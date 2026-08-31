import { z } from "zod";

import {
	type WorkView,
	workViewSchema,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const BACKLOG_COPY = {
	backlog: "Backlog",
} as const;

export const PREPARED_MEMBERSHIP = "derived" as const;

export const PLANNING_SURFACE = {
	dailyFocus: "Daily Focus",
	focusPeriod: "Focus Period",
} as const;

export const preparedBacklogSchema = z.object({
	copy: z.object({
		backlog: z.literal(BACKLOG_COPY.backlog),
	}),
	items: z.array(workViewSchema),
	membership: z.literal(PREPARED_MEMBERSHIP),
});

export type PreparedBacklogView = z.infer<typeof preparedBacklogSchema>;

export type BacklogItemView = WorkView;

export const takeUpFromBacklogCommandSchema = z.object({
	onto: z.string().min(1).optional(),
	workId: z.string().min(1),
});

export type TakeUpFromBacklogCommand = z.infer<
	typeof takeUpFromBacklogCommandSchema
>;

export const placeOnPlanningSurfaceCommandSchema = z.object({
	surface: z.string().min(1),
	workId: z.string().min(1),
});

export type PlaceOnPlanningSurfaceCommand = z.infer<
	typeof placeOnPlanningSurfaceCommandSchema
>;

export type BacklogPlanningOutcome =
	| {
			membership: { surface: string };
			status: "committed";
			work: WorkView;
	  }
	| { reason: "not-in-prepared-set"; status: "rejected" }
	| { reason: "close-step-required" | "target-not-found"; status: "rejected" };

export function backlogCatalog() {
	return {
		copy: BACKLOG_COPY,
		membership: PREPARED_MEMBERSHIP,
	};
}
