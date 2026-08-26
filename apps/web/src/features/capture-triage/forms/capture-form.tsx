import { formatDateTime } from "@cantiara/auth/account-preferences-format";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo } from "react";
import { CLIENT_SHELL_COPY } from "@/features/web-macos-client/views/client-shell";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

type TemplateId = "" | "bug-capture" | "feedback-capture" | "research-fragment";

interface CaptureFormValues {
	fields: Record<string, string>;
	projectId: string;
	template: TemplateId;
	text: string;
}

const EMPTY_VALUES: CaptureFormValues = {
	fields: {},
	projectId: "",
	template: "",
	text: "",
};

export default function CaptureForm() {
	const { attemptOnlineWork, markUnsaved, recordSave, shell } =
		useClientShell();
	const catalog = useQuery(orpc.captureInbox.catalog.queryOptions());
	const preferences = useQuery(orpc.accountPreferences.get.queryOptions());
	const copy = catalog.data?.copy;
	const form = useForm({
		defaultValues: EMPTY_VALUES,
		onSubmit: async ({ value }) => {
			const projectId = value.projectId.trim() || undefined;
			const result = attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					fields: value.template ? value.fields : undefined,
					idempotencyKey: newIdempotencyKey(),
					projectId,
					template: value.template || undefined,
					text: value.template ? undefined : value.text,
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const list = useQuery(
		orpc.captureInbox.list.queryOptions({
			input: {
				projectId: values.projectId.trim() || undefined,
			},
		})
	);
	const save = useMutation(
		orpc.captureInbox.save.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.captureInbox.list.queryKey({
						input: {
							projectId: values.projectId.trim() || undefined,
						},
					}),
				});
				recordSave();
				form.reset();
			},
		})
	);
	const createBug = useMutation(
		orpc.captureInbox.createBug.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.captureInbox.list.queryKey({
						input: {
							projectId: values.projectId.trim() || undefined,
						},
					}),
				});
				recordSave();
				form.reset();
			},
		})
	);
	const selectedTemplate = useMemo(
		() =>
			catalog.data?.templates.find(
				(template) => template.id === values.template
			),
		[catalog.data?.templates, values.template]
	);
	const isDirty =
		values.text.trim() !== "" ||
		values.projectId.trim() !== "" ||
		values.template !== "" ||
		Object.values(values.fields).some((value) => value.trim() !== "");

	useEffect(() => {
		if (isDirty) {
			markUnsaved();
		}
	}, [isDirty, markUnsaved]);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			form.handleSubmit().catch(() => undefined);
		},
		[form]
	);
	const onCreateBug = useCallback(() => {
		const projectId = values.projectId.trim();
		if (!projectId) {
			return;
		}
		const result = attemptOnlineWork("record-create", () =>
			createBug.mutateAsync({
				fields: values.fields,
				idempotencyKey: newIdempotencyKey(),
				projectId,
				text: values.text,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, createBug, values]);
	const onProjectChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			form.setFieldValue("projectId", event.target.value);
		},
		[form]
	);
	const onTemplateChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			form.setFieldValue("template", event.target.value as TemplateId);
			form.setFieldValue("fields", {});
		},
		[form]
	);
	const onTextChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			form.setFieldValue("text", event.target.value);
		},
		[form]
	);
	const onGuidingFieldChange = useCallback(
		(fieldId: string, value: string) => {
			form.setFieldValue("fields", {
				...form.state.values.fields,
				[fieldId]: value,
			});
		},
		[form]
	);

	if (!copy) {
		return null;
	}

	return (
		<div className="flex flex-col gap-8">
			<form className="flex flex-col gap-6" onSubmit={onSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="capture-project">{copy.project}</FieldLabel>
						<Input
							id="capture-project"
							onChange={onProjectChange}
							value={values.projectId}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="capture-template">
							{copy.captureInbox}
						</FieldLabel>
						<NativeSelect
							className="w-full"
							id="capture-template"
							onChange={onTemplateChange}
							value={values.template}
						>
							<NativeSelectOption value="">
								{copy.captureInbox}
							</NativeSelectOption>
							{catalog.data?.templates.map((template) => (
								<NativeSelectOption key={template.id} value={template.id}>
									{template.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					{selectedTemplate ? (
						selectedTemplate.fields.map((field) => (
							<GuidingField
								fieldId={field.id}
								key={field.id}
								label={field.label}
								onValueChange={onGuidingFieldChange}
								value={values.fields[field.id] ?? ""}
							/>
						))
					) : (
						<Field>
							<FieldLabel htmlFor="capture-text">
								{copy.captureInbox}
							</FieldLabel>
							<Textarea
								id="capture-text"
								onChange={onTextChange}
								value={values.text}
							/>
						</Field>
					)}
				</FieldGroup>
				<div className="flex flex-wrap gap-2">
					<Button type="submit">{copy.save}</Button>
					<Button
						disabled={!values.projectId.trim()}
						onClick={onCreateBug}
						type="button"
						variant="outline"
					>
						{copy.createBug}
					</Button>
				</div>
				{shell.lastSuccessfulSaveAt && preferences.data ? (
					<p>
						{CLIENT_SHELL_COPY.lastSaved}{" "}
						{formatDateTime(shell.lastSuccessfulSaveAt, preferences.data)}
					</p>
				) : null}
				{shell.hasUnsavedChanges ? (
					<p>{CLIENT_SHELL_COPY.unsavedChangesMayBeLost}</p>
				) : null}
			</form>
			<section aria-label={copy.captureInbox} className="flex flex-col gap-3">
				<h2 className="font-semibold text-lg">{copy.captureInbox}</h2>
				{list.data?.length ? (
					<ul className="flex flex-col gap-3">
						{list.data.map((item) => (
							<li
								className="rounded-none border border-border p-3"
								key={item.id}
							>
								<p className="text-sm">
									{item.body || item.template || item.kind}
								</p>
							</li>
						))}
					</ul>
				) : null}
			</section>
		</div>
	);
}

function GuidingField({
	fieldId,
	label,
	onValueChange,
	value,
}: {
	fieldId: string;
	label: string;
	onValueChange: (fieldId: string, value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(fieldId, event.target.value);
		},
		[fieldId, onValueChange]
	);

	return (
		<Field>
			<FieldLabel htmlFor={`capture-field-${fieldId}`}>{label}</FieldLabel>
			<Textarea
				id={`capture-field-${fieldId}`}
				onChange={onChange}
				value={value}
			/>
		</Field>
	);
}
