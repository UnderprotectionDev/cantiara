import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { formatDateTime } from "@cantiara/auth/account-preferences-format";
import { Button } from "@cantiara/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@cantiara/ui/components/field";
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
import {
	type CaptureTemplateId,
	captureFormAfterSave,
	captureFormHasUnsavedCapture,
	captureInboxGroups,
	captureInboxItemPreview,
	createBugIsAvailable,
	EMPTY_CAPTURE_FORM,
} from "./capture-form-state";

export default function CaptureForm() {
	const { attemptOnlineWork, markUnsaved, recordSave, shell } =
		useClientShell();
	const catalog = useQuery(orpc.captureInbox.catalog.queryOptions());
	const preferences = useQuery(orpc.accountPreferences.get.queryOptions());
	const copy = catalog.data?.copy;
	const form = useForm({
		defaultValues: EMPTY_CAPTURE_FORM,
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
	const list = useQuery(orpc.captureInbox.listAll.queryOptions());
	const save = useMutation(
		orpc.captureInbox.save.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.captureInbox.listAll.queryKey(),
				});
				recordSave();
				form.reset(captureFormAfterSave(values));
			},
		})
	);
	const createBug = useMutation(
		orpc.captureInbox.createBug.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.captureInbox.listAll.queryKey(),
				});
				recordSave();
				form.reset(captureFormAfterSave(values));
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
	const isDirty = captureFormHasUnsavedCapture(values);
	const canCreateBug = createBugIsAvailable(values);
	const groups = captureInboxGroups(
		list.data ?? [],
		copy ?? {
			projectCaptureInbox: "Project Capture Inbox",
			workspaceCaptureInbox: "Workspace Capture Inbox",
		}
	);

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
		if (!createBugIsAvailable(values)) {
			return;
		}
		const projectId = values.projectId.trim();
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
			form.setFieldValue("template", event.target.value as CaptureTemplateId);
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
						<FieldDescription>
							{copy.leaveEmptyForWorkspaceCaptureInbox}
						</FieldDescription>
					</Field>
					<Field>
						<NativeSelect
							className="w-full"
							id="capture-template"
							onChange={onTemplateChange}
							value={values.template}
						>
							<NativeSelectOption value="" />
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
						disabled={!canCreateBug}
						onClick={onCreateBug}
						type="button"
						variant="outline"
					>
						{copy.createBug}
					</Button>
				</div>
				<p>
					{canCreateBug
						? copy.createBugDoesNotStayInInbox
						: copy.createBugNeedsProjectAndBugCapture}
				</p>
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
			<section aria-label={copy.captureInbox} className="flex flex-col gap-8">
				<CaptureInboxList
					emptyCopy={copy.noCapturesInThisInbox}
					groups={groups}
					list={list}
					templates={catalog.data?.templates}
				/>
			</section>
		</div>
	);
}

function CaptureInboxList({
	emptyCopy,
	groups,
	list,
	templates,
}: {
	emptyCopy: string;
	groups: Array<{
		heading: string;
		items: Array<{
			body: string;
			id: string;
			template: string | null;
		}>;
		projectId: string | null;
	}>;
	list: {
		data?: unknown[];
		isError: boolean;
		isPending: boolean;
	};
	templates?: Array<{ id: string; label: string }>;
}) {
	if (list.isError) {
		return <p>{MAIN_FLOW_COPY.failed}</p>;
	}
	if (list.isPending && !list.data) {
		return null;
	}
	if (groups.length === 0) {
		return <p>{emptyCopy}</p>;
	}
	return (
		<>
			{groups.map((group) => (
				<section
					aria-label={
						group.projectId
							? `${group.heading} ${group.projectId}`
							: group.heading
					}
					className="flex flex-col gap-3"
					key={group.projectId ?? "workspace"}
				>
					<h2 className="font-semibold text-lg">{group.heading}</h2>
					{group.projectId ? (
						<p className="text-sm">{group.projectId}</p>
					) : null}
					<ul className="flex flex-col gap-3">
						{group.items.map((item) => {
							const templateLabel =
								templates?.find((template) => template.id === item.template)
									?.label ?? item.template;
							return (
								<li
									className="rounded-none border border-border p-3"
									key={item.id}
								>
									<p className="whitespace-pre-wrap text-sm">
										{captureInboxItemPreview(item, templateLabel)}
									</p>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</>
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
