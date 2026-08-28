import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import type { WorkType } from "../../work-lifecycle/forms/work-lifecycle-copy";

import {
	presentWorkContextCard,
	revealPreparedSection,
	WORK_CONTEXT_COPY,
	type WorkContextCardView,
} from "./work-context-copy";

function visibleFieldValue(
	field: WorkContextCardView["initiallyVisibleFields"][number],
	values: { planning: string; status: string; title: string; type: string }
) {
	if (field === WORK_CONTEXT_COPY.title) {
		return values.title;
	}
	if (field === WORK_CONTEXT_COPY.type) {
		return values.type;
	}
	if (field === WORK_CONTEXT_COPY.status) {
		return values.status;
	}
	return values.planning;
}

export default function WorkContextCard({
	planning,
	status,
	title,
	type,
}: {
	planning?: string;
	status: string;
	title: string;
	type: WorkType;
}) {
	const [revealedSections, setRevealedSections] = useState<string[]>([]);
	const card = presentWorkContextCard({
		revealedSections,
		starterConfiguration: "Blank Project",
		workType: type,
	});
	const values = {
		planning: planning ?? "",
		status,
		title,
		type,
	};
	const onAdd = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const section = new FormData(event.currentTarget).get("section");
			if (typeof section !== "string" || section.length === 0) {
				return;
			}
			setRevealedSections(
				revealPreparedSection(card, section).visiblePreparedSections
			);
		},
		[card]
	);
	return (
		<section className="flex flex-col gap-3">
			<dl className="grid gap-1 text-sm">
				{card.initiallyVisibleFields.map((field) => (
					<div className="flex gap-2" key={field}>
						<dt className="text-muted-foreground">{field}</dt>
						<dd>{visibleFieldValue(field, values)}</dd>
					</div>
				))}
			</dl>
			{card.visiblePreparedSections.map((section) => (
				<section className="flex flex-col gap-1" key={section}>
					<h3 className="font-medium text-sm">{section}</h3>
				</section>
			))}
			{card.addContext.remainingSections.length > 0 ? (
				<form className="flex flex-wrap items-end gap-2" onSubmit={onAdd}>
					<Field className="w-64">
						<FieldLabel htmlFor="add-context-section">
							{WORK_CONTEXT_COPY.addContext}
						</FieldLabel>
						<NativeSelect
							className="w-full"
							defaultValue={card.addContext.remainingSections[0]}
							id="add-context-section"
							key={card.addContext.remainingSections.join("|")}
							name="section"
						>
							{card.addContext.remainingSections.map((section) => (
								<NativeSelectOption key={section} value={section}>
									{section}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Button size="sm" type="submit">
						{WORK_CONTEXT_COPY.addContext}
					</Button>
				</form>
			) : null}
		</section>
	);
}
