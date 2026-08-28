export type DraftsListPresentation<T> =
	| { kind: "empty" }
	| { kind: "failed" }
	| { drafts: readonly T[]; kind: "list" }
	| { kind: "loading" };

export function draftsListPresentation<T>(input: {
	data: readonly T[] | undefined;
	isError: boolean;
	isPending: boolean;
}): DraftsListPresentation<T> {
	if (input.isError) {
		return { kind: "failed" };
	}
	if (input.isPending && input.data === undefined) {
		return { kind: "loading" };
	}
	if (!input.data?.length) {
		return { kind: "empty" };
	}
	return { drafts: input.data, kind: "list" };
}
