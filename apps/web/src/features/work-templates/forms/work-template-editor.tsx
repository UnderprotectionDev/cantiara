import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { CustomFieldValueControl } from "@/features/custom-fields/forms/custom-field-value-control";
import {
	type CustomFieldStoredValue,
	UNSET_CUSTOM_FIELD_VALUE,
} from "@/features/custom-fields/forms/custom-fields-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { workTemplateMutationError } from "./work-template-mutation-error";
import {
	WORK_TEMPLATE_COPY,
	WORK_TEMPLATE_TYPES,
	type WorkTemplateType,
} from "./work-templates-copy";

interface ChecklistDraft {
	id: string;
	title: string;
}

interface WorkTemplateFormValues {
	createDay: string;
	descriptionSkeleton: string;
	lightChecklist: ChecklistDraft[];
	name: string;
	plannedStartOffset: string;
	targetDateOffset: string;
	workType: WorkTemplateType;
}

function todayStamp(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseOffset(value: string): { offsetDays: number } | null {
	if (value.trim() === "") {
		return null;
	}
	const offsetDays = Number(value);
	if (!Number.isInteger(offsetDays)) {
		return null;
	}
	return { offsetDays };
}

function selectDatePreviewValues(state: { values: WorkTemplateFormValues }) {
	return {
		createDay: state.values.createDay,
		plannedStartOffset: state.values.plannedStartOffset,
		targetDateOffset: state.values.targetDateOffset,
	};
}

interface ListedWorkTemplate {
	descriptionSkeleton: string | null;
	id: string;
	lightChecklist: ChecklistDraft[];
	name: string;
	plannedStartRule: { offsetDays: number } | null;
	revision: number;
	selectedFieldDefaults: readonly {
		definitionId: string;
		value: CustomFieldStoredValue;
	}[];
	targetDateRule: { offsetDays: number } | null;
	workType: string;
}

export default function WorkTemplateEditor({
	projectId,
}: {
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingRevision, setEditingRevision] = useState(0);
	const [fieldDefaults, setFieldDefaults] = useState<
		Record<string, CustomFieldStoredValue>
	>({});
	const templates = useQuery(
		orpc.workLifecycle.workTemplates.list.queryOptions({ input: { projectId } })
	);
	const fields = useQuery(
		orpc.customFields.surface.queryOptions({
			input: { projectId, recordType: "Work" },
		})
	);
	const selectableFields = useMemo(
		() => (fields.data ?? []).filter((field) => field.type !== "Date"),
		[fields.data]
	);
	const form = useForm({
		defaultValues: {
			createDay: todayStamp(),
			descriptionSkeleton: "",
			lightChecklist: [{ id: "item-1", title: "" }],
			name: "",
			plannedStartOffset: "",
			targetDateOffset: "",
			workType: "Task" as WorkTemplateType,
		} satisfies WorkTemplateFormValues,
		onSubmit: async ({ formApi, value }) => {
			setError(null);
			const selectedFieldDefaults = selectableFields.flatMap((field) => {
				const stored = fieldDefaults[field.definitionId];
				if (!stored || stored.kind === "unset") {
					return [];
				}
				return [{ definitionId: field.definitionId, value: stored }];
			});
			const payload = {
				descriptionSkeleton: value.descriptionSkeleton,
				lightChecklist: value.lightChecklist.filter(
					(item) => item.title.trim().length > 0
				),
				name: value.name,
				plannedStartRule: parseOffset(value.plannedStartOffset),
				projectId,
				selectedFieldDefaults,
				targetDateRule: parseOffset(value.targetDateOffset),
				workType: value.workType,
			};
			const result = attemptOnlineWork("record-create", () => {
				if (editingId) {
					return update.mutateAsync({
						baseRevision: editingRevision,
						idempotencyKey: newIdempotencyKey(),
						payload: { ...payload, templateId: editingId },
					});
				}
				return create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload,
				});
			});
			if (result.status === "refused") {
				return;
			}
			const outcome = await result.value;
			if (outcome.status === "committed" || outcome.status === "replayed") {
				formApi.reset();
				setFieldDefaults({});
				setEditingId(null);
				setEditingRevision(0);
			}
		},
	});
	const invalidateList = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.workLifecycle.workTemplates.list.queryKey({
				input: { projectId },
			}),
		});
	}, [projectId]);
	const create = useMutation(
		orpc.workLifecycle.workTemplates.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateList();
					recordSave();
					setError(null);
					return;
				}
				const message = workTemplateMutationError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const update = useMutation(
		orpc.workLifecycle.workTemplates.update.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateList();
					recordSave();
					setError(null);
					return;
				}
				const message = workTemplateMutationError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const trash = useMutation(
		orpc.workLifecycle.workTemplates.trash.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateList();
					recordSave();
					setError(null);
					form.reset();
					setFieldDefaults({});
					setEditingId(null);
					setEditingRevision(0);
					return;
				}
				const message = workTemplateMutationError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
	);
	const onPickTemplate = useCallback(
		(definition: ListedWorkTemplate) => {
			setEditingId(definition.id);
			setEditingRevision(definition.revision);
			setFieldDefaults(
				Object.fromEntries(
					definition.selectedFieldDefaults.map((field) => [
						field.definitionId,
						field.value,
					])
				)
			);
			form.reset({
				createDay: todayStamp(),
				descriptionSkeleton: definition.descriptionSkeleton ?? "",
				lightChecklist:
					definition.lightChecklist.length > 0
						? [...definition.lightChecklist]
						: [{ id: "item-1", title: "" }],
				name: definition.name,
				plannedStartOffset:
					definition.plannedStartRule === null
						? ""
						: definition.plannedStartRule.offsetDays.toString(),
				targetDateOffset:
					definition.targetDateRule === null
						? ""
						: definition.targetDateRule.offsetDays.toString(),
				workType: definition.workType as WorkTemplateType,
			});
		},
		[form]
	);
	const onTrash = useCallback(() => {
		if (!editingId) {
			return;
		}
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			trash.mutateAsync({
				baseRevision: editingRevision,
				idempotencyKey: newIdempotencyKey(),
				payload: { templateId: editingId },
			})
		);
	}, [attemptOnlineWork, editingId, editingRevision, markUnsaved, trash]);
	const definitions = templates.data ?? [];
	const pending = create.isPending || update.isPending || trash.isPending;

	return (
		<section aria-label={WORK_TEMPLATE_COPY.workTemplate}>
			<h2 className="font-medium text-sm">{WORK_TEMPLATE_COPY.workTemplate}</h2>
			{definitions.length > 0 ? (
				<ul className="mt-3 flex flex-col gap-2 text-sm">
					{definitions.map((definition) => (
						<TemplatePickRow
							key={definition.id}
							onPick={onPickTemplate}
							template={definition}
						/>
					))}
				</ul>
			) : null}
			<form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup>
					<form.Field name="name">
						{(field) => (
							<TextField
								id="work-template-name"
								label={WORK_TEMPLATE_COPY.name}
								onValueChange={field.handleChange}
								required={true}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="workType">
						{(field) => (
							<TypeField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="descriptionSkeleton">
						{(field) => (
							<DescriptionField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="lightChecklist">
						{(field) => (
							<ChecklistField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="plannedStartOffset">
						{(field) => (
							<OffsetField
								id="work-template-planned-start"
								label={WORK_TEMPLATE_COPY.plannedStart}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="targetDateOffset">
						{(field) => (
							<OffsetField
								id="work-template-target-date"
								label={WORK_TEMPLATE_COPY.targetDate}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="createDay">
						{(field) => (
							<TextField
								id="work-template-create-day"
								label={WORK_TEMPLATE_COPY.createDay}
								onValueChange={field.handleChange}
								required={true}
								value={field.state.value}
							/>
						)}
					</form.Field>
				</FieldGroup>
				{selectableFields.length > 0 ? (
					<CustomFieldDefaults
						defaults={fieldDefaults}
						fields={selectableFields}
						onChange={setFieldDefaults}
					/>
				) : null}
				<form.Subscribe selector={selectDatePreviewValues}>
					{DatePreviewGate}
				</form.Subscribe>
				<Button disabled={pending} type="submit">
					{editingId
						? WORK_TEMPLATE_COPY.save
						: WORK_TEMPLATE_COPY.addWorkTemplate}
				</Button>
				{editingId ? (
					<Button
						disabled={pending}
						onClick={onTrash}
						type="button"
						variant="outline"
					>
						{WORK_TEMPLATE_COPY.moveToTrash}
					</Button>
				) : null}
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function DatePreviewGate(values: {
	createDay: string;
	plannedStartOffset: string;
	targetDateOffset: string;
}) {
	return (
		<DatePreview
			createDay={values.createDay}
			plannedStartOffset={values.plannedStartOffset}
			targetDateOffset={values.targetDateOffset}
		/>
	);
}

function TemplatePickRow({
	onPick,
	template,
}: {
	onPick: (template: ListedWorkTemplate) => void;
	template: ListedWorkTemplate;
}) {
	const onClick = useCallback(() => {
		onPick(template);
	}, [onPick, template]);
	return (
		<li>
			<Button onClick={onClick} size="sm" type="button" variant="ghost">
				{template.name} · {template.workType}
			</Button>
		</li>
	);
}

function DatePreview({
	createDay,
	plannedStartOffset,
	targetDateOffset,
}: {
	createDay: string;
	plannedStartOffset: string;
	targetDateOffset: string;
}) {
	const preview = useQuery(
		orpc.workLifecycle.workTemplates.previewDates.queryOptions({
			input: {
				createDay,
				plannedStartRule: parseOffset(plannedStartOffset),
				targetDateRule: parseOffset(targetDateOffset),
			},
		})
	);
	const body = preview.data;
	return (
		<section aria-label={WORK_TEMPLATE_COPY.previewDates}>
			<h3 className="font-medium text-sm">{WORK_TEMPLATE_COPY.previewDates}</h3>
			{body?.status === "ok" ? (
				<p className="text-sm">
					{WORK_TEMPLATE_COPY.plannedStart}: {body.preview.plannedStart ?? "—"}
					{" · "}
					{WORK_TEMPLATE_COPY.targetDate}: {body.preview.targetDate ?? "—"}
				</p>
			) : null}
			{body?.status === "rejected" ? (
				<p role="alert">{WORK_TEMPLATE_COPY.relativeDateUnresolved}</p>
			) : null}
		</section>
	);
}

function CustomFieldDefaults({
	defaults,
	fields,
	onChange,
}: {
	defaults: Record<string, CustomFieldStoredValue>;
	fields: readonly {
		definitionId: string;
		name: string;
		notEvaluated: boolean;
		options: readonly string[];
		recordId: string;
		recordType: string;
		revision: number;
		type: string;
		value: CustomFieldStoredValue;
	}[];
	onChange: (value: Record<string, CustomFieldStoredValue>) => void;
}) {
	return (
		<ul className="flex flex-col gap-3">
			{fields.map((field) => (
				<CustomFieldDefaultRow
					defaults={defaults}
					field={field}
					key={field.definitionId}
					onChange={onChange}
				/>
			))}
		</ul>
	);
}

function CustomFieldDefaultRow({
	defaults,
	field,
	onChange,
}: {
	defaults: Record<string, CustomFieldStoredValue>;
	field: {
		definitionId: string;
		name: string;
		notEvaluated: boolean;
		options: readonly string[];
		recordId: string;
		recordType: string;
		revision: number;
		type: string;
		value: CustomFieldStoredValue;
	};
	onChange: (value: Record<string, CustomFieldStoredValue>) => void;
}) {
	const onValueChange = useCallback(
		(value: CustomFieldStoredValue) => {
			onChange({ ...defaults, [field.definitionId]: value });
		},
		[defaults, field.definitionId, onChange]
	);
	return (
		<li>
			<CustomFieldValueControl
				field={field}
				onValueChange={onValueChange}
				value={defaults[field.definitionId] ?? UNSET_CUSTOM_FIELD_VALUE}
			/>
		</li>
	);
}

function TextField({
	id,
	label,
	onValueChange,
	required,
	value,
}: {
	id: string;
	label: string;
	onValueChange: (value: string) => void;
	required: boolean;
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
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input id={id} onChange={onChange} required={required} value={value} />
		</Field>
	);
}

function TypeField({
	onValueChange,
	value,
}: {
	onValueChange: (value: WorkTemplateType) => void;
	value: WorkTemplateType;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as WorkTemplateType);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="work-template-type">
				{WORK_TEMPLATE_COPY.type}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="work-template-type"
				onChange={onChange}
				value={value}
			>
				{WORK_TEMPLATE_TYPES.map((type) => (
					<NativeSelectOption key={type} value={type}>
						{type}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function DescriptionField({
	onValueChange,
	value,
}: {
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="work-template-description">
				{WORK_TEMPLATE_COPY.description}
			</FieldLabel>
			<Textarea
				id="work-template-description"
				onChange={onChange}
				value={value}
			/>
		</Field>
	);
}

function OffsetField({
	id,
	label,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
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
			<FieldLabel htmlFor={id}>
				{label} · {WORK_TEMPLATE_COPY.daysFromCreate}
			</FieldLabel>
			<Input id={id} inputMode="numeric" onChange={onChange} value={value} />
		</Field>
	);
}

function ChecklistField({
	onValueChange,
	value,
}: {
	onValueChange: (value: ChecklistDraft[]) => void;
	value: ChecklistDraft[];
}) {
	const onAdd = useCallback(() => {
		onValueChange([...value, { id: crypto.randomUUID(), title: "" }]);
	}, [onValueChange, value]);
	return (
		<Field>
			<FieldLabel>{WORK_TEMPLATE_COPY.checklist}</FieldLabel>
			<ul className="flex flex-col gap-2">
				{value.map((item) => (
					<ChecklistItemRow
						item={item}
						key={item.id}
						onValueChange={onValueChange}
						value={value}
					/>
				))}
			</ul>
			<Button onClick={onAdd} size="sm" type="button" variant="outline">
				{WORK_TEMPLATE_COPY.addChecklistItem}
			</Button>
		</Field>
	);
}

function ChecklistItemRow({
	item,
	onValueChange,
	value,
}: {
	item: ChecklistDraft;
	onValueChange: (value: ChecklistDraft[]) => void;
	value: ChecklistDraft[];
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(
				value.map((entry) =>
					entry.id === item.id
						? { id: entry.id, title: event.target.value }
						: entry
				)
			);
		},
		[item.id, onValueChange, value]
	);
	return (
		<li>
			<Input
				aria-label={WORK_TEMPLATE_COPY.checklist}
				onChange={onChange}
				value={item.title}
			/>
		</li>
	);
}
