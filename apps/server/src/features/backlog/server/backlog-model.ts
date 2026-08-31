import { z } from "zod";

import {
	type WorkView,
	workViewSchema,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const BACKLOG_COPY = {
	backlog: "Backlog",
	date: "Date",
	field: "Field",
	manualOrder: "Manual order",
	moveDown: "Move down",
	moveUp: "Move up",
	priority: "Priority",
	save: "Save",
} as const;

export const PREPARED_MEMBERSHIP = "derived" as const;

export const PLANNING_SURFACE = {
	dailyFocus: "Daily Focus",
	focusPeriod: "Focus Period",
} as const;

export const BACKLOG_SORT = {
	date: BACKLOG_COPY.date,
	field: BACKLOG_COPY.field,
	manualOrder: BACKLOG_COPY.manualOrder,
	priority: BACKLOG_COPY.priority,
} as const;

export const BACKLOG_SORTS = [
	BACKLOG_SORT.manualOrder,
	BACKLOG_SORT.priority,
	BACKLOG_SORT.date,
	BACKLOG_SORT.field,
] as const;

export type BacklogSort = (typeof BACKLOG_SORTS)[number];

export const BACKLOG_WRITES = {
	closure: false,
	kanbanPosition: false,
	ordinaryCollectionRank: false,
	prioritizationSessionRank: false,
	priorityScore: false,
} as const;

export const backlogSortSchema = z.enum(BACKLOG_SORTS);

export const preparedBacklogSchema = z.object({
	copy: z.object({
		backlog: z.literal(BACKLOG_COPY.backlog),
		manualOrder: z.literal(BACKLOG_COPY.manualOrder),
	}),
	items: z.array(workViewSchema),
	manualOrder: z.array(z.string().min(1)),
	membership: z.literal(PREPARED_MEMBERSHIP),
	presentation: z.object({
		kind: z.enum(["saved", "temporary"]),
		sort: backlogSortSchema,
	}),
	writes: z.object({
		closure: z.literal(false),
		kanbanPosition: z.literal(false),
		ordinaryCollectionRank: z.literal(false),
		prioritizationSessionRank: z.literal(false),
		priorityScore: z.literal(false),
	}),
});

export type PreparedBacklogView = z.infer<typeof preparedBacklogSchema>;

export type BacklogItemView = WorkView;

export const listPreparedBacklogQuerySchema = z.object({
	projectId: z.string().min(1),
	sort: backlogSortSchema.optional(),
});

export type ListPreparedBacklogQuery = z.infer<
	typeof listPreparedBacklogQuerySchema
>;

export const reorderManualOrderCommandSchema = z.object({
	projectId: z.string().min(1),
	workIds: z.array(z.string().min(1)),
});

export type ReorderManualOrderCommand = z.infer<
	typeof reorderManualOrderCommandSchema
>;

export const saveBacklogPresentationCommandSchema = z.object({
	projectId: z.string().min(1),
	sort: backlogSortSchema,
});

export type SaveBacklogPresentationCommand = z.infer<
	typeof saveBacklogPresentationCommandSchema
>;

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

export type BacklogOrderOutcome =
	| {
			backlog: PreparedBacklogView;
			status: "committed";
			writes: typeof BACKLOG_WRITES;
	  }
	| { reason: "target-not-found"; status: "rejected" };

export function backlogCatalog() {
	return {
		copy: BACKLOG_COPY,
		membership: PREPARED_MEMBERSHIP,
		sorts: BACKLOG_SORTS,
		writes: BACKLOG_WRITES,
	};
}
