import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cantiara/ui/components/popover";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

import {
	CUSTOM_FIELD_COPY,
	type CustomFieldStoredValue,
	type CustomFieldValueView,
	UNSET_CUSTOM_FIELD_VALUE,
} from "./custom-fields-copy";

export function CustomFieldValueControl({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	if (field.type === "Text") {
		return (
			<TextValueField
				field={field}
				onValueChange={onValueChange}
				value={value}
			/>
		);
	}
	if (field.type === "Number") {
		return (
			<NumberValueField
				field={field}
				onValueChange={onValueChange}
				value={value}
			/>
		);
	}
	if (field.type === "Boolean") {
		return (
			<BooleanValueField
				field={field}
				onValueChange={onValueChange}
				value={value}
			/>
		);
	}
	if (field.type === "Date") {
		return (
			<DateValueField
				field={field}
				onValueChange={onValueChange}
				value={value}
			/>
		);
	}
	if (field.type === "Single select") {
		return (
			<SingleSelectValueField
				field={field}
				onValueChange={onValueChange}
				value={value}
			/>
		);
	}
	return (
		<MultiSelectValueField
			field={field}
			onValueChange={onValueChange}
			value={value}
		/>
	);
}

function fieldIdFor(definitionId: string) {
	return `custom-field-value-${definitionId}`;
}

function NotEvaluatedHint({ value }: { value: CustomFieldStoredValue }) {
	if (value.kind !== "unset") {
		return null;
	}
	return (
		<p className="text-muted-foreground text-xs">
			{CUSTOM_FIELD_COPY.notEvaluated}
		</p>
	);
}

function TextValueField({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	const fieldId = fieldIdFor(field.definitionId);
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const next = event.target.value;
			onValueChange(
				next.trim().length === 0
					? UNSET_CUSTOM_FIELD_VALUE
					: { kind: "text", text: next }
			);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={fieldId}>{field.name}</FieldLabel>
			<Input
				id={fieldId}
				onChange={onChange}
				value={value.kind === "text" ? value.text : ""}
			/>
			<NotEvaluatedHint value={value} />
		</Field>
	);
}

function NumberValueField({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	const fieldId = fieldIdFor(field.definitionId);
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const next = event.target.value;
			if (next.trim().length === 0) {
				onValueChange(UNSET_CUSTOM_FIELD_VALUE);
				return;
			}
			onValueChange({ kind: "number", number: Number(next) });
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={fieldId}>{field.name}</FieldLabel>
			<Input
				id={fieldId}
				onChange={onChange}
				type="number"
				value={value.kind === "number" ? String(value.number) : ""}
			/>
			<NotEvaluatedHint value={value} />
		</Field>
	);
}

function booleanSelectValue(value: CustomFieldStoredValue): string {
	if (value.kind !== "boolean") {
		return "unset";
	}
	if (value.boolean) {
		return "true";
	}
	return "false";
}

function BooleanValueField({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	const fieldId = fieldIdFor(field.definitionId);
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = event.target.value;
			if (next === "unset") {
				onValueChange(UNSET_CUSTOM_FIELD_VALUE);
				return;
			}
			onValueChange({
				boolean: next === "true",
				kind: "boolean",
			});
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={fieldId}>{field.name}</FieldLabel>
			<NativeSelect
				className="w-full"
				id={fieldId}
				onChange={onChange}
				value={booleanSelectValue(value)}
			>
				<NativeSelectOption value="unset">
					{CUSTOM_FIELD_COPY.notEvaluated}
				</NativeSelectOption>
				<NativeSelectOption value="true">
					{CUSTOM_FIELD_COPY.booleanTrue}
				</NativeSelectOption>
				<NativeSelectOption value="false">
					{CUSTOM_FIELD_COPY.booleanFalse}
				</NativeSelectOption>
			</NativeSelect>
		</Field>
	);
}

function DateValueField({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	const fieldId = fieldIdFor(field.definitionId);
	const selected =
		value.kind === "date" ? parseCalendarDate(value.date) : undefined;
	const onSelect = useCallback(
		(date: Date | undefined) => {
			if (!date) {
				onValueChange(UNSET_CUSTOM_FIELD_VALUE);
				return;
			}
			onValueChange({
				date: formatCalendarDate(date),
				kind: "date",
			});
		},
		[onValueChange]
	);
	const onClear = useCallback(() => {
		onValueChange(UNSET_CUSTOM_FIELD_VALUE);
	}, [onValueChange]);
	return (
		<Field>
			<FieldLabel htmlFor={fieldId}>{field.name}</FieldLabel>
			<Popover>
				<PopoverTrigger
					className="inline-flex h-8 items-center border px-3 text-sm"
					id={fieldId}
				>
					{value.kind === "date"
						? parseCalendarDate(value.date).toLocaleDateString()
						: CUSTOM_FIELD_COPY.notEvaluated}
				</PopoverTrigger>
				<PopoverContent>
					<Calendar mode="single" onSelect={onSelect} selected={selected} />
					<Button onClick={onClear} size="sm" type="button" variant="ghost">
						{CUSTOM_FIELD_COPY.notEvaluated}
					</Button>
				</PopoverContent>
			</Popover>
		</Field>
	);
}

function SingleSelectValueField({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	const fieldId = fieldIdFor(field.definitionId);
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = event.target.value;
			onValueChange(
				next.length === 0
					? UNSET_CUSTOM_FIELD_VALUE
					: { kind: "single-select", option: next }
			);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={fieldId}>{field.name}</FieldLabel>
			<NativeSelect
				className="w-full"
				id={fieldId}
				onChange={onChange}
				value={value.kind === "single-select" ? value.option : ""}
			>
				<NativeSelectOption value="">
					{CUSTOM_FIELD_COPY.notEvaluated}
				</NativeSelectOption>
				{field.options.map((option) => (
					<NativeSelectOption key={option} value={option}>
						{option}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function MultiSelectValueField({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	const selected = value.kind === "multi-select" ? value.options : [];
	return (
		<Field>
			<FieldLabel>{field.name}</FieldLabel>
			<ul className="flex flex-col gap-2">
				{field.options.map((option) => (
					<MultiSelectOption
						checked={selected.includes(option)}
						definitionId={field.definitionId}
						key={option}
						onValueChange={onValueChange}
						option={option}
						selected={selected}
					/>
				))}
			</ul>
			<NotEvaluatedHint value={value} />
		</Field>
	);
}

function MultiSelectOption({
	checked,
	definitionId,
	onValueChange,
	option,
	selected,
}: {
	checked: boolean;
	definitionId: string;
	onValueChange: (value: CustomFieldStoredValue) => void;
	option: string;
	selected: readonly string[];
}) {
	const id = `custom-field-multi-${definitionId}-${option}`;
	const onCheckedChange = useCallback(
		(next: boolean | "indeterminate") => {
			const options =
				next === true
					? [...selected, option]
					: selected.filter((item) => item !== option);
			onValueChange(
				options.length === 0
					? UNSET_CUSTOM_FIELD_VALUE
					: { kind: "multi-select", options }
			);
		},
		[onValueChange, option, selected]
	);
	return (
		<li>
			<Field orientation="horizontal">
				<Checkbox checked={checked} id={id} onCheckedChange={onCheckedChange} />
				<FieldLabel htmlFor={id}>{option}</FieldLabel>
			</Field>
		</li>
	);
}

function formatCalendarDate(date: Date): string {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseCalendarDate(value: string): Date {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function CustomFieldValueFields({
	fields,
	onValueChange,
	values,
}: {
	fields: readonly CustomFieldValueView[];
	onValueChange: (definitionId: string, value: CustomFieldStoredValue) => void;
	values: Readonly<Record<string, CustomFieldStoredValue>>;
}) {
	if (fields.length === 0) {
		return null;
	}
	return (
		<div className="flex flex-col gap-3">
			{fields.map((field) => (
				<BoundValueControl
					field={field}
					key={field.definitionId}
					onValueChange={onValueChange}
					value={values[field.definitionId] ?? UNSET_CUSTOM_FIELD_VALUE}
				/>
			))}
		</div>
	);
}

function BoundValueControl({
	field,
	onValueChange,
	value,
}: {
	field: CustomFieldValueView;
	onValueChange: (definitionId: string, value: CustomFieldStoredValue) => void;
	value: CustomFieldStoredValue;
}) {
	const onChange = useCallback(
		(next: CustomFieldStoredValue) => {
			onValueChange(field.definitionId, next);
		},
		[field.definitionId, onValueChange]
	);
	return (
		<CustomFieldValueControl
			field={field}
			onValueChange={onChange}
			value={value}
		/>
	);
}
