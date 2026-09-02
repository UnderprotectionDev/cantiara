export function presentCalendarDateMovePreview(input: {
	fromDate: string;
	kind: string;
	toDate: string;
}): { fromDate: string; kind: string; label: string; toDate: string } {
	return {
		fromDate: input.fromDate,
		kind: input.kind,
		label: `${input.kind} ${input.fromDate} → ${input.toDate}`,
		toDate: input.toDate,
	};
}
