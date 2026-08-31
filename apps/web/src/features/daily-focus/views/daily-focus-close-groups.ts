import type { DAILY_FOCUS_COPY } from "./daily-focus-copy";

export function dailyFocusCloseGroups(copy: typeof DAILY_FOCUS_COPY) {
	return [
		{ heading: copy.completed, key: "completed" as const },
		{ heading: copy.abandoned, key: "abandoned" as const },
		{ heading: copy.deferred, key: "reappearDeferred" as const },
		{ heading: copy.stillOpen, key: "stillOpen" as const },
	];
}
