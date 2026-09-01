export type CalendarListPresentation<T> =
	| { kind: "empty" }
	| { kind: "failed" }
	| { kind: "list"; items: readonly T[] }
	| { kind: "loading" };

export function calendarListPresentation<T>(input: {
	data: readonly T[] | undefined;
	isError: boolean;
	isPending: boolean;
}): CalendarListPresentation<T> {
	if (input.isError) {
		return { kind: "failed" };
	}
	if (input.isPending && input.data === undefined) {
		return { kind: "loading" };
	}
	if (!input.data?.length) {
		return { kind: "empty" };
	}
	return { items: input.data, kind: "list" };
}
