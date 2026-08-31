export type DailyFocusListPresentation<T> =
	| { kind: "empty" }
	| { kind: "failed" }
	| { kind: "list"; members: readonly T[] }
	| { kind: "loading" };

export function dailyFocusListPresentation<T>(input: {
	data: readonly T[] | undefined;
	isError: boolean;
	isPending: boolean;
}): DailyFocusListPresentation<T> {
	if (input.isError) {
		return { kind: "failed" };
	}
	if (input.isPending && input.data === undefined) {
		return { kind: "loading" };
	}
	if (!input.data?.length) {
		return { kind: "empty" };
	}
	return { kind: "list", members: input.data };
}
