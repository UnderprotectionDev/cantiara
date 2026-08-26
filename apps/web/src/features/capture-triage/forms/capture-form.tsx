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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLIENT_SHELL_COPY } from "@/features/web-macos-client/views/client-shell";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";
import { CaptureBulkSenseMaking } from "./capture-bulk-sense-making";
import {
	type CaptureTemplateId,
	captureFormAfterSave,
	captureFormHasUnsavedCapture,
	captureInboxGroups,
	captureInboxItemPreview,
	createBugIsAvailable,
	EMPTY_CAPTURE_FORM,
	fileToCaptureAttachment,
} from "./capture-form-state";
import { CaptureMergeUndo, CaptureTriageActions } from "./capture-triage-panel";
import {
	goBackSequentialFocus,
	nextSequentialFocus,
	sequentialTriageView,
	startSequentialFocus,
} from "./sequential-triage-state";

export default function CaptureForm() {
	const { attemptOnlineWork, clearUnsaved, markUnsaved, recordSave, shell } =
		useClientShell();
	const catalog = useQuery(orpc.captureInbox.catalog.queryOptions());
	const preferences = useQuery(orpc.accountPreferences.get.queryOptions());
	const copy = catalog.data?.copy;
	const attachmentFileRef = useRef<File | null>(null);
	const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
	const [mergeId, setMergeId] = useState<string | null>(null);
	const form = useForm({
		defaultValues: EMPTY_CAPTURE_FORM,
		onSubmit: async ({ value }) => {
			const projectId = value.projectId.trim() || undefined;
			const attachment = attachmentFileRef.current
				? await fileToCaptureAttachment(attachmentFileRef.current)
				: undefined;
			const result = attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					attachment,
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
				await queryClient.invalidateQueries({
					queryKey: orpc.captureInbox.bulkSenseMaking.queryKey(),
				});
				recordSave();
				attachmentFileRef.current = null;
				setAttachmentFile(null);
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
	const isDirty =
		captureFormHasUnsavedCapture(values) || attachmentFile !== null;
	const canCreateBug = createBugIsAvailable(values);
	const groups = captureInboxGroups(
		list.data ?? [],
		copy ?? {
			projectCaptureInbox: "Project Capture Inbox",
			workspaceCaptureInbox: "Workspace Capture Inbox",
		}
	);
	const [bulkOpen, setBulkOpen] = useState(false);
	const [sequentialFocusedId, setSequentialFocusedId] = useState<string | null>(
		null
	);
	const remainingItems = list.data ?? [];
	const sequential = sequentialTriageView(remainingItems, sequentialFocusedId);
	const onMergeCleared = useCallback(() => {
		setMergeId(null);
	}, []);
	const onToggleBulk = useCallback(() => {
		setBulkOpen((open) => !open);
	}, []);
	const onItemConsumed = useCallback(
		(itemId: string) => {
			setSequentialFocusedId((current) => {
				if (current !== itemId) {
					return current;
				}
				return nextSequentialFocus(
					remainingItems.map((item) => item.id),
					itemId
				);
			});
		},
		[remainingItems]
	);
	const onToggleSequential = useCallback(() => {
		if (sequential.mode === "sequential") {
			setSequentialFocusedId(null);
			return;
		}
		setSequentialFocusedId(
			startSequentialFocus(remainingItems.map((item) => item.id))
		);
	}, [remainingItems, sequential.mode]);
	const onGoBackSequential = useCallback(() => {
		setSequentialFocusedId((current) =>
			goBackSequentialFocus(
				remainingItems.map((item) => item.id),
				current
			)
		);
	}, [remainingItems]);

	useEffect(() => {
		if (isDirty) {
			markUnsaved();
		} else {
			clearUnsaved();
		}
	}, [clearUnsaved, isDirty, markUnsaved]);

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
				template: values.template || undefined,
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
	const onAttachmentChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0] ?? null;
			attachmentFileRef.current = file;
			setAttachmentFile(file);
		},
		[]
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
					<Field>
						<FieldLabel htmlFor="capture-attachment">
							{copy.captureAttachment}
						</FieldLabel>
						<Input
							id="capture-attachment"
							onChange={onAttachmentChange}
							type="file"
						/>
					</Field>
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
				<Button
					aria-pressed={bulkOpen}
					onClick={onToggleBulk}
					type="button"
					variant={bulkOpen ? "default" : "outline"}
				>
					{copy.bulkSenseMaking}
				</Button>
				{bulkOpen ? (
					<CaptureBulkSenseMaking
						copy={copy}
						onItemConsumed={onItemConsumed}
						onMergeConsumed={setMergeId}
						templates={catalog.data?.templates}
					/>
				) : (
					<CaptureInboxList
						copy={copy}
						emptyCopy={copy.noCapturesInThisInbox}
						groups={groups}
						list={list}
						mergeId={mergeId}
						onGoBackSequential={onGoBackSequential}
						onItemConsumed={onItemConsumed}
						onMergeCleared={onMergeCleared}
						onMergeConsumed={setMergeId}
						onToggleSequential={onToggleSequential}
						sequential={sequential}
						templates={catalog.data?.templates}
					/>
				)}
				{bulkOpen && mergeId ? (
					<CaptureMergeUndo
						copy={copy}
						mergeId={mergeId}
						onCleared={onMergeCleared}
					/>
				) : null}
			</section>
		</div>
	);
}

function CaptureInboxList({
	copy,
	emptyCopy,
	groups,
	list,
	mergeId,
	onGoBackSequential,
	onItemConsumed,
	onMergeCleared,
	onMergeConsumed,
	onToggleSequential,
	sequential,
	templates,
}: {
	copy: {
		attachToExisting: string;
		back: string;
		convert: string;
		delete: string;
		document: string;
		evidence: string;
		fileAttachment: string;
		origin: string;
		otherProjects: string;
		sequentialTriage: string;
		work: string;
	};
	emptyCopy: string;
	groups: Array<{
		heading: string;
		items: Array<{
			attachment?: { filename: string };
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
	mergeId: string | null;
	onGoBackSequential: () => void;
	onItemConsumed: (itemId: string) => void;
	onMergeCleared: () => void;
	onMergeConsumed: (mergeId: string) => void;
	onToggleSequential: () => void;
	sequential: {
		focused: {
			attachment?: { filename: string };
			body: string;
			id: string;
			template: string | null;
		} | null;
		mode: "list" | "sequential";
		previousAvailable: boolean;
	};
	templates?: ReadonlyArray<{ id: string; label: string }>;
}) {
	if (list.isError) {
		return <p>{MAIN_FLOW_COPY.failed}</p>;
	}
	if (list.isPending && !list.data) {
		return null;
	}
	const undo = mergeId ? (
		<CaptureMergeUndo
			copy={copy}
			mergeId={mergeId}
			onCleared={onMergeCleared}
		/>
	) : null;
	if (groups.length === 0) {
		return (
			<div className="flex flex-col gap-4">
				{undo}
				<p>{emptyCopy}</p>
			</div>
		);
	}
	const sequentialControls = (
		<div className="flex flex-wrap gap-2">
			<Button
				aria-pressed={sequential.mode === "sequential"}
				onClick={onToggleSequential}
				type="button"
				variant={sequential.mode === "sequential" ? "default" : "outline"}
			>
				{copy.sequentialTriage}
			</Button>
			{sequential.mode === "sequential" ? (
				<Button
					disabled={!sequential.previousAvailable}
					onClick={onGoBackSequential}
					type="button"
					variant="outline"
				>
					{copy.back}
				</Button>
			) : null}
		</div>
	);
	if (sequential.mode === "sequential" && sequential.focused) {
		return (
			<div className="flex flex-col gap-4">
				{undo}
				{sequentialControls}
				<section
					aria-label={copy.sequentialTriage}
					className="flex flex-col gap-3"
				>
					<h2 className="font-semibold text-lg">{copy.sequentialTriage}</h2>
					<ul className="flex flex-col gap-3">
						<CaptureInboxItemCard
							copy={copy}
							item={sequential.focused}
							onItemConsumed={onItemConsumed}
							onMergeConsumed={onMergeConsumed}
							templates={templates}
						/>
					</ul>
				</section>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-8">
			{undo}
			{sequentialControls}
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
						{group.items.map((item) => (
							<CaptureInboxItemCard
								copy={copy}
								item={item}
								key={item.id}
								onItemConsumed={onItemConsumed}
								onMergeConsumed={onMergeConsumed}
								templates={templates}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function CaptureInboxItemCard({
	copy,
	item,
	onItemConsumed,
	onMergeConsumed,
	templates,
}: {
	copy: {
		attachToExisting: string;
		convert: string;
		delete: string;
		document: string;
		evidence: string;
		fileAttachment: string;
		origin: string;
		otherProjects: string;
		work: string;
	};
	item: {
		attachment?: { filename: string };
		body: string;
		id: string;
		template: string | null;
	};
	onItemConsumed: (itemId: string) => void;
	onMergeConsumed: (mergeId: string) => void;
	templates?: ReadonlyArray<{ id: string; label: string }>;
}) {
	const templateLabel =
		templates?.find((template) => template.id === item.template)?.label ??
		item.template;
	const preview = captureInboxItemPreview(item, templateLabel);

	return (
		<li className="rounded-none border border-border p-3">
			<p className="whitespace-pre-wrap text-sm">{preview}</p>
			{item.attachment ? (
				<p className="text-sm">{item.attachment.filename}</p>
			) : null}
			<CaptureTriageActions
				copy={copy}
				itemId={item.id}
				onItemConsumed={onItemConsumed}
				onMergeConsumed={onMergeConsumed}
			/>
		</li>
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
