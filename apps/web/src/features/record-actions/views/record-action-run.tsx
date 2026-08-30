import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { recordActionMutationError } from "../forms/record-action-mutation-error";
import {
	RECORD_ACTION_COPY,
	type RecordActionInput,
} from "../forms/record-actions-copy";

interface PreviewField {
	from: string | null;
	id: string;
	label: string;
	to: string;
}

interface ChosenInput {
	key: string;
	kind: string;
	label: string;
	value: string;
}

interface PreviewOk {
	preview: {
		baseRevision: number;
		fields: PreviewField[];
		fingerprint: string;
		inputs: ChosenInput[];
	};
	status: "ok";
}

export default function RecordActionRun({
	projectId,
	revision,
	workId,
}: {
	projectId: string;
	revision: number;
	workId: string;
}) {
	const actions = useQuery(
		orpc.recordActions.list.queryOptions({ input: { projectId } })
	);
	const listed = actions.data ?? [];
	if (listed.length === 0) {
		return null;
	}
	return (
		<section aria-label={RECORD_ACTION_COPY.recordAction}>
			<h2 className="font-medium text-sm">{RECORD_ACTION_COPY.recordAction}</h2>
			<ul className="mt-2 flex flex-col gap-3">
				{listed.map((action) => (
					<ActionRun
						action={action}
						key={action.id}
						projectId={projectId}
						revision={revision}
						workId={workId}
					/>
				))}
			</ul>
		</section>
	);
}

function ActionRun({
	action,
	projectId,
	revision,
	workId,
}: {
	action: {
		id: string;
		inputs?: readonly RecordActionInput[];
		name: string;
	};
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const declared = action.inputs ?? [];
	const [error, setError] = useState<string | null>(null);
	const [started, setStarted] = useState(false);
	const [values, setValues] = useState<Record<string, string>>({});
	const [preview, setPreview] = useState<PreviewOk["preview"] | null>(null);
	const [runId, setRunId] = useState<string | null>(null);
	const [undoAvailable, setUndoAvailable] = useState(false);
	const [applyKey] = useState(() => newIdempotencyKey());
	const [undoKey] = useState(() => newIdempotencyKey());
	const works = useQuery(
		orpc.workLifecycle.list.queryOptions({ input: { projectId } })
	);
	const customFields = useQuery(
		orpc.customFields.list.queryOptions({ input: { projectId } })
	);
	const relatedWorks = (works.data ?? []).filter((row) => row.id !== workId);
	const previewMutation = useMutation(
		orpc.recordActions.preview.mutationOptions()
	);
	const applyMutation = useMutation(orpc.recordActions.apply.mutationOptions());
	const undoMutation = useMutation(orpc.recordActions.undo.mutationOptions());
	const inputValues = useMemo(
		() =>
			declared.map((input) => ({
				key: input.key,
				value: values[input.key] ?? "",
			})),
		[declared, values]
	);
	const requestPreview = useCallback(() => {
		setError(null);
		previewMutation.mutate(
			{
				inputValues,
				recordActionId: action.id,
				targetRecordId: workId,
			},
			{
				onSuccess: (outcome) => {
					if (outcome.status !== "ok") {
						setError(recordActionMutationError(outcome));
						return;
					}
					setPreview(outcome.preview);
					setRunId(null);
					setUndoAvailable(false);
				},
			}
		);
	}, [action.id, inputValues, previewMutation, workId]);
	const onStart = useCallback(() => {
		setStarted(true);
		setPreview(null);
		if (declared.length === 0) {
			requestPreview();
		}
	}, [declared.length, requestPreview]);
	const onApply = useCallback(async () => {
		if (!preview) {
			return;
		}
		setError(null);
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			applyMutation.mutateAsync({
				baseRevision: preview.baseRevision,
				idempotencyKey: applyKey,
				payload: {
					inputValues,
					previewAcknowledged: true,
					previewFingerprint: preview.fingerprint,
					recordActionId: action.id,
					targetRecordId: workId,
				},
			})
		);
		if (result.status === "refused") {
			return;
		}
		const outcome = await result.value;
		const message = recordActionMutationError(outcome);
		if (message) {
			setError(message);
			return;
		}
		if (outcome.status === "committed" || outcome.status === "replayed") {
			setRunId(outcome.run.id);
			setUndoAvailable(outcome.run.undo === MUTATION_COPY.undo);
			setPreview(outcome.run.fields.length > 0 ? preview : null);
			recordSave();
			await invalidateWork(projectId, workId);
		}
	}, [
		action.id,
		applyKey,
		applyMutation,
		attemptOnlineWork,
		inputValues,
		markUnsaved,
		preview,
		projectId,
		recordSave,
		workId,
	]);
	const onUndo = useCallback(async () => {
		if (!runId) {
			return;
		}
		setError(null);
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			undoMutation.mutateAsync({
				baseRevision: revision,
				idempotencyKey: undoKey,
				payload: { runId },
			})
		);
		if (result.status === "refused") {
			return;
		}
		const outcome = await result.value;
		const message = recordActionMutationError(outcome);
		if (message) {
			setError(message);
			return;
		}
		if (outcome.status === "committed" || outcome.status === "replayed") {
			setUndoAvailable(false);
			setPreview(null);
			recordSave();
			await invalidateWork(projectId, workId);
		}
	}, [
		attemptOnlineWork,
		markUnsaved,
		projectId,
		recordSave,
		revision,
		runId,
		undoKey,
		undoMutation,
		workId,
	]);
	const onApplyClick = useCallback(() => {
		onApply().catch(() => undefined);
	}, [onApply]);
	const onUndoClick = useCallback(() => {
		onUndo().catch(() => undefined);
	}, [onUndo]);
	const applying = applyMutation.isPending;
	const undoing = undoMutation.isPending;
	return (
		<li className="flex flex-col gap-2 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<p className="font-medium">{action.name}</p>
				<Button onClick={onStart} size="sm" type="button" variant="outline">
					{RECORD_ACTION_COPY.start}
				</Button>
				{started && declared.length > 0 ? (
					<Button
						onClick={requestPreview}
						size="sm"
						type="button"
						variant="outline"
					>
						{RECORD_ACTION_COPY.preview}
					</Button>
				) : null}
				{preview ? (
					<Button
						disabled={applying}
						onClick={onApplyClick}
						size="sm"
						type="button"
					>
						{applying ? MUTATION_COPY.finalizing : RECORD_ACTION_COPY.apply}
					</Button>
				) : null}
				{undoAvailable ? (
					<Button
						disabled={undoing}
						onClick={onUndoClick}
						size="sm"
						type="button"
						variant="ghost"
					>
						{undoing ? MUTATION_COPY.finalizing : MUTATION_COPY.undo}
					</Button>
				) : null}
			</div>
			{started && declared.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{declared.map((input) => (
						<li key={input.key}>
							<RuntimeInputRow
								customFields={customFields.data ?? []}
								input={input}
								onValuesChange={setValues}
								relatedWorks={relatedWorks}
								setPreview={setPreview}
								value={values[input.key] ?? ""}
							/>
						</li>
					))}
				</ul>
			) : null}
			{preview && preview.inputs.length > 0 ? (
				<ul className="text-muted-foreground">
					{preview.inputs.map((input) => (
						<li key={input.key}>
							{input.label}: {input.value}
						</li>
					))}
				</ul>
			) : null}
			{preview && preview.fields.length > 0 ? (
				<ul className="text-muted-foreground">
					{preview.fields.map((field) => (
						<li key={field.id}>
							{field.label}: {field.from ?? "—"} → {field.to}
						</li>
					))}
				</ul>
			) : null}
			{error ? (
				<p className="text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</li>
	);
}

function RuntimeInputRow({
	customFields,
	input,
	onValuesChange,
	relatedWorks,
	setPreview,
	value,
}: {
	customFields: readonly {
		id: string;
		options?: readonly string[];
	}[];
	input: RecordActionInput;
	onValuesChange: Dispatch<SetStateAction<Record<string, string>>>;
	relatedWorks: readonly { id: string; key: string; title: string }[];
	setPreview: Dispatch<SetStateAction<PreviewOk["preview"] | null>>;
	value: string;
}) {
	const onValueChange = useCallback(
		(next: string) => {
			setPreview(null);
			onValuesChange((current) => ({
				...current,
				[input.key]: next,
			}));
		},
		[input.key, onValuesChange, setPreview]
	);
	return (
		<RuntimeInputControl
			customFields={customFields}
			input={input}
			onValueChange={onValueChange}
			relatedWorks={relatedWorks}
			value={value}
		/>
	);
}

function RuntimeInputControl({
	customFields,
	input,
	onValueChange,
	relatedWorks,
	value,
}: {
	customFields: readonly {
		id: string;
		options?: readonly string[];
	}[];
	input: RecordActionInput;
	onValueChange: (value: string) => void;
	relatedWorks: readonly { id: string; key: string; title: string }[];
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	const fieldId = "fieldId" in input ? input.fieldId : "";
	const options =
		customFields.find((field) => field.id === fieldId)?.options ?? [];
	if (input.kind === "Date") {
		return (
			<Field>
				<FieldLabel htmlFor={`record-action-run-${input.key}`}>
					{input.label}
				</FieldLabel>
				<Input
					id={`record-action-run-${input.key}`}
					onChange={onChange}
					type="date"
					value={value}
				/>
			</Field>
		);
	}
	if (input.kind === "Number") {
		return (
			<Field>
				<FieldLabel htmlFor={`record-action-run-${input.key}`}>
					{input.label}
				</FieldLabel>
				<Input
					id={`record-action-run-${input.key}`}
					onChange={onChange}
					type="number"
					value={value}
				/>
			</Field>
		);
	}
	if (input.kind === "Select") {
		return (
			<Field>
				<FieldLabel htmlFor={`record-action-run-${input.key}`}>
					{input.label}
				</FieldLabel>
				<NativeSelect
					id={`record-action-run-${input.key}`}
					onChange={onChange}
					value={value}
				>
					<NativeSelectOption value="">{input.label}</NativeSelectOption>
					{options.map((option) => (
						<NativeSelectOption key={option} value={option}>
							{option}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		);
	}
	return (
		<Field>
			<FieldLabel htmlFor={`record-action-run-${input.key}`}>
				{input.label}
			</FieldLabel>
			<NativeSelect
				id={`record-action-run-${input.key}`}
				onChange={onChange}
				value={value}
			>
				<NativeSelectOption value="">{input.label}</NativeSelectOption>
				{relatedWorks.map((work) => (
					<NativeSelectOption key={work.id} value={work.id}>
						{work.key} {work.title}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
