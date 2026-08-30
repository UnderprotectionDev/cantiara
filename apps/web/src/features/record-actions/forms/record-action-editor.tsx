import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@cantiara/ui/components/field";
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

import { recordActionMutationError } from "./record-action-mutation-error";
import {
	inputLabel,
	RECORD_ACTION_COPY,
	type RecordActionInput,
	type RecordActionStep,
	stepLabel,
} from "./record-actions-copy";

interface RecordActionFormValues {
	dailyFocusAdd: boolean;
	dateFieldId: string;
	includeDate: boolean;
	includeNumber: boolean;
	includeRelation: boolean;
	includeSelect: boolean;
	name: string;
	numberFieldId: string;
	selectFieldId: string;
	setInProgress: boolean;
}

interface ListedRecordAction {
	id: string;
	inputs: readonly RecordActionInput[];
	name: string;
	steps: readonly RecordActionStep[];
}

interface ListedCustomField {
	boundRecordTypes: readonly string[];
	id: string;
	name: string;
	type: string;
}

function selectIncludeDate(state: { values: { includeDate: boolean } }) {
	return state.values.includeDate;
}

function selectIncludeNumber(state: { values: { includeNumber: boolean } }) {
	return state.values.includeNumber;
}

function selectIncludeSelect(state: { values: { includeSelect: boolean } }) {
	return state.values.includeSelect;
}

function stepsFromForm(value: RecordActionFormValues): RecordActionStep[] {
	const steps: RecordActionStep[] = [];
	if (value.setInProgress) {
		steps.push({ kind: "setWorkStatus", status: "In Progress" });
	}
	if (value.dailyFocusAdd) {
		steps.push({ kind: "dailyFocusMembership", operation: "add" });
	}
	return steps;
}

function inputsFromForm(
	value: RecordActionFormValues
): { inputs: RecordActionInput[]; status: "ok" } | { status: "missing-field" } {
	if (value.includeDate && value.dateFieldId.length === 0) {
		return { status: "missing-field" };
	}
	if (value.includeNumber && value.numberFieldId.length === 0) {
		return { status: "missing-field" };
	}
	if (value.includeSelect && value.selectFieldId.length === 0) {
		return { status: "missing-field" };
	}
	const inputs: RecordActionInput[] = [];
	if (value.includeDate && value.dateFieldId.length > 0) {
		inputs.push({
			fieldId: value.dateFieldId,
			key: "date",
			kind: "Date",
			label: RECORD_ACTION_COPY.date,
		});
	}
	if (value.includeNumber && value.numberFieldId.length > 0) {
		inputs.push({
			fieldId: value.numberFieldId,
			key: "number",
			kind: "Number",
			label: RECORD_ACTION_COPY.number,
		});
	}
	if (value.includeSelect && value.selectFieldId.length > 0) {
		inputs.push({
			fieldId: value.selectFieldId,
			key: "select",
			kind: "Select",
			label: RECORD_ACTION_COPY.select,
		});
	}
	if (value.includeRelation) {
		inputs.push({
			key: "related",
			kind: "Relation",
			label: RECORD_ACTION_COPY.relation,
			relatedKind: "Work",
		});
	}
	return { inputs, status: "ok" };
}

export default function RecordActionEditor({
	projectId,
}: {
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const actions = useQuery(
		orpc.recordActions.list.queryOptions({ input: { projectId } })
	);
	const customFields = useQuery(
		orpc.customFields.list.queryOptions({ input: { projectId } })
	);
	const listedFields = (customFields.data ?? []) as ListedCustomField[];
	const dateFields = listedFields.filter(
		(field) => field.type === "Date" && field.boundRecordTypes.includes("Work")
	);
	const numberFields = listedFields.filter(
		(field) =>
			field.type === "Number" && field.boundRecordTypes.includes("Work")
	);
	const selectFields = listedFields.filter(
		(field) =>
			field.type === "Single select" && field.boundRecordTypes.includes("Work")
	);
	const create = useMutation(
		orpc.recordActions.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.recordActions.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				const message = recordActionMutationError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const trash = useMutation(
		orpc.recordActions.trash.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.recordActions.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {
			dailyFocusAdd: true,
			dateFieldId: "",
			includeDate: false,
			includeNumber: false,
			includeRelation: false,
			includeSelect: false,
			name: RECORD_ACTION_COPY.startWork,
			numberFieldId: "",
			selectFieldId: "",
			setInProgress: true,
		} as RecordActionFormValues,
		onSubmit: async ({ formApi, value }) => {
			setError(null);
			const declared = inputsFromForm(value);
			if (declared.status !== "ok") {
				setError(RECORD_ACTION_COPY.unknownInput);
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						inputs: declared.inputs,
						name: value.name,
						projectId,
						steps: stepsFromForm(value),
						targetKind: "Work",
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
	const applyStartWork = useCallback(() => {
		form.setFieldValue("name", RECORD_ACTION_COPY.startWork);
		form.setFieldValue("setInProgress", true);
		form.setFieldValue("dailyFocusAdd", true);
	}, [form]);
	const onTrash = useCallback(
		(recordActionId: string) => {
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				trash.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: { recordActionId },
				})
			);
		},
		[attemptOnlineWork, markUnsaved, trash]
	);
	const listed = (actions.data ?? []) as ListedRecordAction[];

	return (
		<section aria-label={RECORD_ACTION_COPY.recordAction}>
			<h2 className="font-medium text-sm">{RECORD_ACTION_COPY.recordAction}</h2>
			{listed.length > 0 ? (
				<ul className="mt-3 flex flex-col divide-y divide-border border-border border-b text-sm">
					{listed.map((action) => (
						<ActionRow action={action} key={action.id} onTrash={onTrash} />
					))}
				</ul>
			) : null}
			<form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
				<FieldGroup>
					<form.Field name="name">
						{(field) => (
							<NameField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<FieldSet>
						<FieldLegend variant="label">
							{RECORD_ACTION_COPY.steps}
						</FieldLegend>
						<ul className="flex flex-col gap-2">
							<li>
								<form.Field name="setInProgress">
									{(field) => (
										<StepToggle
											checked={field.state.value}
											id="record-action-status"
											label={`${RECORD_ACTION_COPY.setWorkStatus}: In Progress`}
											onValueChange={field.handleChange}
										/>
									)}
								</form.Field>
							</li>
							<li>
								<form.Field name="dailyFocusAdd">
									{(field) => (
										<StepToggle
											checked={field.state.value}
											id="record-action-focus"
											label={RECORD_ACTION_COPY.dailyFocusAdd}
											onValueChange={field.handleChange}
										/>
									)}
								</form.Field>
							</li>
						</ul>
					</FieldSet>
					<FieldSet>
						<FieldLegend variant="label">
							{RECORD_ACTION_COPY.runtimeInputs}
						</FieldLegend>
						<ul className="flex flex-col gap-2">
							<li>
								<form.Field name="includeDate">
									{(field) => (
										<StepToggle
											checked={field.state.value}
											id="record-action-input-date"
											label={RECORD_ACTION_COPY.date}
											onValueChange={field.handleChange}
										/>
									)}
								</form.Field>
								<form.Subscribe selector={selectIncludeDate}>
									{(includeDate) =>
										includeDate ? (
											<form.Field name="dateFieldId">
												{(field) => (
													<FieldBindSelect
														fields={dateFields}
														id="record-action-date-field"
														onValueChange={field.handleChange}
														value={field.state.value}
													/>
												)}
											</form.Field>
										) : null
									}
								</form.Subscribe>
							</li>
							<li>
								<form.Field name="includeNumber">
									{(field) => (
										<StepToggle
											checked={field.state.value}
											id="record-action-input-number"
											label={RECORD_ACTION_COPY.number}
											onValueChange={field.handleChange}
										/>
									)}
								</form.Field>
								<form.Subscribe selector={selectIncludeNumber}>
									{(includeNumber) =>
										includeNumber ? (
											<form.Field name="numberFieldId">
												{(field) => (
													<FieldBindSelect
														fields={numberFields}
														id="record-action-number-field"
														onValueChange={field.handleChange}
														value={field.state.value}
													/>
												)}
											</form.Field>
										) : null
									}
								</form.Subscribe>
							</li>
							<li>
								<form.Field name="includeSelect">
									{(field) => (
										<StepToggle
											checked={field.state.value}
											id="record-action-input-select"
											label={RECORD_ACTION_COPY.select}
											onValueChange={field.handleChange}
										/>
									)}
								</form.Field>
								<form.Subscribe selector={selectIncludeSelect}>
									{(includeSelect) =>
										includeSelect ? (
											<form.Field name="selectFieldId">
												{(field) => (
													<FieldBindSelect
														fields={selectFields}
														id="record-action-select-field"
														onValueChange={field.handleChange}
														value={field.state.value}
													/>
												)}
											</form.Field>
										) : null
									}
								</form.Subscribe>
							</li>
							<li>
								<form.Field name="includeRelation">
									{(field) => (
										<StepToggle
											checked={field.state.value}
											id="record-action-input-relation"
											label={RECORD_ACTION_COPY.relation}
											onValueChange={field.handleChange}
										/>
									)}
								</form.Field>
							</li>
						</ul>
					</FieldSet>
				</FieldGroup>
				{error ? (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-2">
					<Button
						onClick={applyStartWork}
						size="sm"
						type="button"
						variant="outline"
					>
						{RECORD_ACTION_COPY.useStartWork}
					</Button>
					<Button disabled={create.isPending} size="sm" type="submit">
						{RECORD_ACTION_COPY.save}
					</Button>
				</div>
			</form>
		</section>
	);
}

function ActionRow({
	action,
	onTrash,
}: {
	action: ListedRecordAction;
	onTrash: (recordActionId: string) => void;
}) {
	const onClick = useCallback(() => {
		onTrash(action.id);
	}, [action.id, onTrash]);
	const inputSummary =
		action.inputs.length > 0
			? ` · ${action.inputs.map(inputLabel).join(" · ")}`
			: "";
	return (
		<li className="flex items-start justify-between gap-3 py-2.5">
			<div className="min-w-0">
				<p className="font-medium">{action.name}</p>
				<p className="text-muted-foreground text-xs leading-snug">
					{action.steps.map(stepLabel).join(" · ")}
					{inputSummary}
				</p>
			</div>
			<Button onClick={onClick} size="sm" type="button" variant="ghost">
				{RECORD_ACTION_COPY.moveToTrash}
			</Button>
		</li>
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
			<FieldLabel htmlFor="record-action-name">
				{RECORD_ACTION_COPY.name}
			</FieldLabel>
			<Input id="record-action-name" onChange={onChange} value={value} />
		</Field>
	);
}

function StepToggle({
	checked,
	id,
	label,
	onValueChange,
}: {
	checked: boolean;
	id: string;
	label: string;
	onValueChange: (value: boolean) => void;
}) {
	const onCheckedChange = useCallback(
		(next: boolean | "indeterminate") => {
			onValueChange(next === true);
		},
		[onValueChange]
	);
	return (
		<Field orientation="horizontal">
			<Checkbox checked={checked} id={id} onCheckedChange={onCheckedChange} />
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
		</Field>
	);
}

function FieldBindSelect({
	fields,
	id,
	onValueChange,
	value,
}: {
	fields: readonly ListedCustomField[];
	id: string;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<NativeSelect id={id} onChange={onChange} value={value}>
				<NativeSelectOption value="">
					{RECORD_ACTION_COPY.setExistingField}
				</NativeSelectOption>
				{fields.map((field) => (
					<NativeSelectOption key={field.id} value={field.id}>
						{field.name}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
