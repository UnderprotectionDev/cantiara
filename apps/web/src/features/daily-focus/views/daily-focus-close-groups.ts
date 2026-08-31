import type { DAILY_FOCUS_COPY } from "./daily-focus-copy";

export const DAILY_FOCUS_CLOSE_GROUP_KEYS = [
	"completed",
	"abandoned",
	"reappearDeferred",
	"stillOpen",
] as const;

export type DailyFocusCloseGroupKey =
	(typeof DAILY_FOCUS_CLOSE_GROUP_KEYS)[number];

export function dailyFocusCloseGroups(copy: typeof DAILY_FOCUS_COPY) {
	return [
		{ heading: copy.completed, key: "completed" },
		{ heading: copy.abandoned, key: "abandoned" },
		{ heading: copy.deferred, key: "reappearDeferred" },
		{ heading: copy.stillOpen, key: "stillOpen" },
	] as const;
}
