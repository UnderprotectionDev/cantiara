import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { createCustomFieldError } from "./create-custom-field-error";
import {
	BINDABLE_RECORD_TYPES,
	CUSTOM_FIELD_COPY,
	CUSTOM_FIELD_TYPES,
	type CustomFieldType,
	isSelectFieldType,
} from "./custom-fields-copy";

interface OptionDraft {
	id: string;
	label: string;
}

interface CreateCustomFieldValues {
	boundRecordTypes: string[];
	name: string;
	options: OptionDraft[];
	type: CustomFieldType;
}

function selectFieldType(state: { values: { type: CustomFieldType } }) {
	return state.values.type;
}

export default function CustomFieldEditor({
	projectId,
}: {
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const fields = useQuery(
		orpc.customFields.list.queryOptions({ input: { projectId } })
	);
	const create = useMutation(
		orpc.customFields.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.customFields.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				const message = createCustomFieldError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {
			boundRecordTypes: ["Work"],
			name: "",
			options: [{ id: "option-1", label: "" }],
			type: "Text" as CustomFieldType,
		} satisfies CreateCustomFieldValues,
		onSubmit: async ({ formApi, value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						boundRecordTypes: value.boundRecordTypes,
						name: value.name,
						options: isSelectFieldType(value.type)
							? value.options.map((option) => option.label)
							: [],
						projectId,
						type: value.type,
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			const outcome = await result.value;
			if (outcome.status === "committed" || outcome.status === "replayed") {
				formApi.reset();
			}
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
	);
	const definitions = fields.data ?? [];

	return (
		<section aria-label={CUSTOM_FIELD_COPY.customField}>
			<h2 className="font-medium text-sm">{CUSTOM_FIELD_COPY.customField}</h2>
			{definitions.length > 0 ? (
				<ul className="mt-3 flex flex-col gap-2 text-sm">
					{definitions.map((definition) => (
						<li key={definition.id}>
							{definition.name} · {definition.type} ·{" "}
							{definition.boundRecordTypes.join(", ")}
						</li>
					))}
				</ul>
			) : null}
			<form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup>
					<form.Field name="name">
						{(field) => (
							<NameField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="type">
						{(field) => (
							<TypeField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="boundRecordTypes">
						{(field) => (
							<BoundTypesField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Subscribe selector={selectFieldType}>
						{(type) =>
							isSelectFieldType(type) ? (
								<form.Field name="options">
									{(field) => (
										<OptionsField
											onValueChange={field.handleChange}
											value={field.state.value}
										/>
									)}
								</form.Field>
							) : null
						}
					</form.Subscribe>
				</FieldGroup>
				<Button disabled={create.isPending} type="submit">
					{CUSTOM_FIELD_COPY.addCustomField}
				</Button>
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function NameField({
	onValueChange,
	value,
}: {
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="custom-field-name">
				{CUSTOM_FIELD_COPY.name}
			</FieldLabel>
			<Input
				id="custom-field-name"
				onChange={onChange}
				required={true}
				value={value}
			/>
		</Field>
	);
}

function TypeField({
	onValueChange,
	value,
}: {
	onValueChange: (value: CustomFieldType) => void;
	value: CustomFieldType;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as CustomFieldType);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="custom-field-type">
				{CUSTOM_FIELD_COPY.type}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="custom-field-type"
				onChange={onChange}
				value={value}
			>
				{CUSTOM_FIELD_TYPES.map((type) => (
					<NativeSelectOption key={type} value={type}>
						{type}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function BoundTypesField({
	onValueChange,
	value,
}: {
	onValueChange: (value: string[]) => void;
	value: string[];
}) {
	return (
		<Field>
			<FieldLabel>{CUSTOM_FIELD_COPY.boundRecordTypes}</FieldLabel>
			<ul className="flex flex-col gap-2">
				{BINDABLE_RECORD_TYPES.map((recordType) => (
					<BoundTypeToggle
						checked={value.includes(recordType)}
						key={recordType}
						onToggle={onValueChange}
						recordType={recordType}
						selected={value}
					/>
				))}
			</ul>
		</Field>
	);
}

function BoundTypeToggle({
	checked,
	onToggle,
	recordType,
	selected,
}: {
	checked: boolean;
	onToggle: (value: string[]) => void;
	recordType: string;
	selected: string[];
}) {
	const id = `custom-field-bind-${recordType.replaceAll(" ", "-").toLowerCase()}`;
	const onCheckedChange = useCallback(
		(next: boolean | "indeterminate") => {
			if (next === true) {
				onToggle([...selected, recordType]);
				return;
			}
			onToggle(selected.filter((item) => item !== recordType));
		},
		[onToggle, recordType, selected]
	);
	return (
		<li>
			<Field orientation="horizontal">
				<Checkbox checked={checked} id={id} onCheckedChange={onCheckedChange} />
				<FieldLabel htmlFor={id}>{recordType}</FieldLabel>
			</Field>
		</li>
	);
}

function OptionsField({
	onValueChange,
	value,
}: {
	onValueChange: (value: OptionDraft[]) => void;
	value: OptionDraft[];
}) {
	const onAdd = useCallback(() => {
		onValueChange([...value, { id: crypto.randomUUID(), label: "" }]);
	}, [onValueChange, value]);
	return (
		<Field>
			<FieldLabel>{CUSTOM_FIELD_COPY.options}</FieldLabel>
			<ul className="flex flex-col gap-2">
				{value.map((option) => (
					<OptionRow
						key={option.id}
						onValueChange={onValueChange}
						option={option}
						options={value}
					/>
				))}
			</ul>
			<Button onClick={onAdd} size="sm" type="button" variant="outline">
				{CUSTOM_FIELD_COPY.addOption}
			</Button>
		</Field>
	);
}

function OptionRow({
	onValueChange,
	option,
	options,
}: {
	onValueChange: (value: OptionDraft[]) => void;
	option: OptionDraft;
	options: OptionDraft[];
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(
				options.map((item) =>
					item.id === option.id
						? { id: item.id, label: event.target.value }
						: item
				)
			);
		},
		[onValueChange, option.id, options]
	);
	return (
		<li>
			<Input
				aria-label={CUSTOM_FIELD_COPY.options}
				onChange={onChange}
				value={option.label}
			/>
		</li>
	);
}
