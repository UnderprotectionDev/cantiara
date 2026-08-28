import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { orpc } from "@/utils/orpc";

import { CustomFieldValueControl } from "./custom-field-value-control";
import {
	CUSTOM_FIELD_COPY,
	type CustomFieldStoredValue,
	type CustomFieldValueView,
	UNSET_CUSTOM_FIELD_VALUE,
} from "./custom-fields-copy";

export default function CustomFieldFilter({
	onRecordIds,
	projectId,
	recordType,
}: {
	onRecordIds: (recordIds: string[] | null) => void;
	projectId: string;
	recordType: string;
}) {
	const fields = useQuery(
		orpc.customFields.searchFields.queryOptions({
			input: { projectId, recordType },
		})
	);
	const [definitionId, setDefinitionId] = useState("");
	const [value, setValue] = useState<CustomFieldStoredValue>(
		UNSET_CUSTOM_FIELD_VALUE
	);
	const selected = useMemo(
		() => fields.data?.find((field) => field.id === definitionId) ?? null,
		[definitionId, fields.data]
	);
	const filter = useQuery({
		...orpc.customFields.filter.queryOptions({
			input: {
				definitionId,
				projectId,
				recordType,
				value,
			},
		}),
		enabled: false,
	});

	const onDefinitionChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setDefinitionId(event.target.value);
			setValue(UNSET_CUSTOM_FIELD_VALUE);
			onRecordIds(null);
		},
		[onRecordIds]
	);

	const onApply = useCallback(() => {
		if (!definitionId) {
			onRecordIds(null);
			return;
		}
		filter
			.refetch()
			.then((result) => {
				onRecordIds(result.data ?? []);
			})
			.catch(() => undefined);
	}, [definitionId, filter, onRecordIds]);

	if (!fields.data || fields.data.length === 0) {
		return null;
	}

	const controlField: CustomFieldValueView | null = selected
		? {
				definitionId: selected.id,
				name: selected.name,
				notEvaluated: value.kind === "unset",
				options: selected.options,
				recordId: "",
				recordType,
				revision: 0,
				type: selected.type,
				value,
			}
		: null;

	return (
		<section aria-label={CUSTOM_FIELD_COPY.filter}>
			<h2 className="font-medium text-sm">{CUSTOM_FIELD_COPY.filter}</h2>
			<p className="sr-only">{CUSTOM_FIELD_COPY.search}</p>
			<Field className="mt-2">
				<FieldLabel htmlFor="custom-field-filter">
					{CUSTOM_FIELD_COPY.customField}
				</FieldLabel>
				<NativeSelect
					className="w-full"
					id="custom-field-filter"
					onChange={onDefinitionChange}
					value={definitionId}
				>
					<NativeSelectOption value="">
						{CUSTOM_FIELD_COPY.customField}
					</NativeSelectOption>
					{fields.data.map((field) => (
						<NativeSelectOption key={field.id} value={field.id}>
							{field.name}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			{controlField ? (
				<div className="mt-3">
					<CustomFieldValueControl
						field={controlField}
						onValueChange={setValue}
						value={value}
					/>
				</div>
			) : null}
			<Button className="mt-3" onClick={onApply} size="sm" type="button">
				{CUSTOM_FIELD_COPY.filter}
			</Button>
		</section>
	);
}
