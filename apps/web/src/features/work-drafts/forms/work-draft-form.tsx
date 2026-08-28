import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useRef } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import {
	WORK_LIFECYCLE_COPY,
	WORK_TYPES,
	type WorkType,
} from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	customFieldWidgetsFromDefinitions,
	EMPTY_WORK_DRAFT_FORM,
	shouldAutosaveWorkDraft,
	type WorkCustomFieldWidget,
	type WorkDraftFormValues,
	workDraftFormForAutosave,
} from "./work-draft-form-state";

const AUTOSAVE_WAIT_MS = 400;

export default function WorkDraftForm({
	createDisabled,
	draftId,
	initialForm,
	lockProjectId,
	onCreate,
	onDraftId,
}: {
	createDisabled?: boolean;
	draftId: string | null;
	initialForm?: WorkDraftFormValues;
	lockProjectId?: string;
	onCreate?: (values: WorkDraftFormValues) => void | Promise<void>;
	onDraftId: (draftId: string) => void;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const draftIdRef = useRef(draftId);
	draftIdRef.current = draftId;
	const projects = useQuery(orpc.projectShell.list.queryOptions());
	const catalog = useQuery(orpc.workDrafts.catalog.queryOptions());
	const form = useForm({
		defaultValues: {
			...EMPTY_WORK_DRAFT_FORM,
			...initialForm,
			projectId: lockProjectId ?? initialForm?.projectId ?? "",
		} satisfies WorkDraftFormValues,
	});
	const values = useStore(form.store, (state) => state.values);
	const projectId = lockProjectId ?? (values.projectId.trim() || null);
	const fields = useQuery({
		...orpc.workDrafts.workCustomFields.queryOptions({
			input: { projectId },
		}),
		enabled: catalog.isSuccess,
	});
	const widgets = customFieldWidgetsFromDefinitions(fields.data ?? []);
	const autosave = useMutation(
		orpc.workDrafts.autosave.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "saved") {
					onDraftId(outcome.draft.id);
					draftIdRef.current = outcome.draft.id;
					await queryClient.invalidateQueries({
						queryKey: orpc.workDrafts.list.queryKey(),
					});
					recordSave();
				}
			},
		})
	);
	const runAutosave = useCallback(
		(next: WorkDraftFormValues) => {
			if (!shouldAutosaveWorkDraft(next)) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				autosave.mutateAsync({
					draftId: draftIdRef.current ?? undefined,
					form: workDraftFormForAutosave(next),
					idempotencyKey: newIdempotencyKey(),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, autosave, markUnsaved]
	);
	const debouncer = useDebouncer(runAutosave, { wait: AUTOSAVE_WAIT_MS });

	const onTitleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			form.setFieldValue("title", event.target.value);
			debouncer.maybeExecute({
				...form.store.state.values,
				title: event.target.value,
			});
		},
		[debouncer, form]
	);
	const onTypeChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const type = event.target.value as WorkType;
			form.setFieldValue("type", type);
			debouncer.maybeExecute({
				...form.store.state.values,
				type,
			});
		},
		[debouncer, form]
	);
	const onProjectChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			form.setFieldValue("projectId", event.target.value);
			debouncer.maybeExecute({
				...form.store.state.values,
				projectId: event.target.value,
			});
		},
		[debouncer, form]
	);
	const onCustomFieldChange = useCallback(
		(fieldId: string, value: string) => {
			const customFieldValues = {
				...form.store.state.values.customFieldValues,
				[fieldId]: value,
			};
			form.setFieldValue("customFieldValues", customFieldValues);
			debouncer.maybeExecute({
				...form.store.state.values,
				customFieldValues,
			});
		},
		[debouncer, form]
	);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const created = onCreate?.(form.store.state.values);
			if (created) {
				created.catch(() => undefined);
			}
		},
		[form, onCreate]
	);

	return (
		<form
			aria-label={catalog.data?.copy.draft ?? "Draft"}
			className="flex flex-col gap-3"
			onSubmit={onSubmit}
		>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<Field className="min-w-48 flex-1">
					<FieldLabel htmlFor="work-draft-title">
						{WORK_LIFECYCLE_COPY.title}
					</FieldLabel>
					<Input
						id="work-draft-title"
						onChange={onTitleChange}
						required={Boolean(onCreate)}
						value={values.title}
					/>
				</Field>
				<Field className="w-40">
					<FieldLabel htmlFor="work-draft-type">
						{WORK_LIFECYCLE_COPY.type}
					</FieldLabel>
					<NativeSelect
						className="w-full"
						id="work-draft-type"
						onChange={onTypeChange}
						value={values.type}
					>
						{WORK_TYPES.map((type) => (
							<NativeSelectOption key={type} value={type}>
								{type}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				{lockProjectId ? null : (
					<Field className="w-48">
						<FieldLabel htmlFor="work-draft-project">
							{PROJECT_SHELL_COPY.selectProject}
						</FieldLabel>
						<NativeSelect
							className="w-full"
							id="work-draft-project"
							onChange={onProjectChange}
							value={values.projectId}
						>
							<NativeSelectOption value="">
								{PROJECT_SHELL_COPY.selectProject}
							</NativeSelectOption>
							{(projects.data ?? []).map((project) => (
								<NativeSelectOption key={project.id} value={project.id}>
									{project.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				)}
				{onCreate ? (
					<Button disabled={createDisabled} type="submit">
						{WORK_LIFECYCLE_COPY.createWork}
					</Button>
				) : null}
			</FieldGroup>
			{widgets.map((widget) => (
				<WorkDraftCustomField
					key={widget.id}
					onValueChange={onCustomFieldChange}
					value={values.customFieldValues[widget.id] ?? ""}
					widget={widget}
				/>
			))}
		</form>
	);
}

function WorkDraftCustomField({
	onValueChange,
	value,
	widget,
}: {
	onValueChange: (fieldId: string, value: string) => void;
	value: string;
	widget: WorkCustomFieldWidget;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(widget.id, event.target.value);
		},
		[onValueChange, widget.id]
	);
	return (
		<Field>
			<FieldLabel htmlFor={`work-draft-field-${widget.id}`}>
				{widget.label}
			</FieldLabel>
			<Input
				id={`work-draft-field-${widget.id}`}
				onChange={onChange}
				value={value}
			/>
		</Field>
	);
}
