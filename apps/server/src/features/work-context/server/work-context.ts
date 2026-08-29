import {
	INITIALLY_VISIBLE_FIELDS,
	PREPARED_LAYOUTS,
	type PreparedSection,
	type PresentWorkContextCardInput,
	WORK_CONTEXT_COPY,
	type WorkContextCardView,
} from "./work-context-model";

export function presentWorkContextCard(
	input: PresentWorkContextCardInput
): WorkContextCardView {
	const preparedSections = [
		...PREPARED_LAYOUTS[input.workType],
	] as PreparedSection[];
	const revealed = new Set(input.revealedSections ?? []);
	const visiblePreparedSections = preparedSections.filter((section) =>
		revealed.has(section)
	);
	return {
		addContext: {
			label: WORK_CONTEXT_COPY.addContext,
			remainingSections: preparedSections.filter(
				(section) => !revealed.has(section)
			),
		},
		gates: {
			create: false,
			statusTransition: false,
		},
		initiallyVisibleFields: INITIALLY_VISIBLE_FIELDS,
		preparedSections,
		starterConfiguration: input.starterConfiguration,
		visiblePreparedSections,
		workType: input.workType,
	};
}

export function revealPreparedSection(
	card: WorkContextCardView,
	section: string
): WorkContextCardView {
	if (!card.addContext.remainingSections.some((item) => item === section)) {
		return card;
	}
	return presentWorkContextCard({
		revealedSections: [...card.visiblePreparedSections, section],
		starterConfiguration: card.starterConfiguration,
		workType: card.workType,
	});
}
