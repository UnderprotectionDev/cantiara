import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import { WORK_LIFECYCLE_COPY } from "./work-lifecycle-copy";

type MergeField = "title" | "type" | "status" | "closureResult";

export default function MergeWorkForm({
	candidates,
	onMerged,
	projectId,
	revision,
	workId,
}: {
	candidates: Array<{ id: string; key: string; title: string }>;
	onMerged?: (survivorId: string) => void;
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const initialDuplicate = candidates.at(0);
	const [duplicateId, setDuplicateId] = useState(
		initialDuplicate ? initialDuplicate.id : ""
	);
	const previewNeeded = duplicateId.length > 0;
	const preview = useQuery({
		...orpc.workLifecycle.previewMerge.queryOptions({
			input: { duplicateId, survivorId: workId },
		}),
		enabled: previewNeeded,
	});
	const merge = useMutation(
		orpc.workLifecycle.merge.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					await invalidateWork(projectId, duplicateId);
					onMerged?.(outcome.work.id);
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					if (outcome.reason === "merge-preview-required") {
						setError(WORK_LIFECYCLE_COPY.mergePreview);
						return;
					}
					if (outcome.reason === "merge-conflicts-unresolved") {
						setError(WORK_LIFECYCLE_COPY.fieldConflicts);
						return;
					}
				}
				setError("Conflict");
			},
		})
	);
	const form = useForm({
		defaultValues: {
			closureResult: "survivor" as "survivor" | "duplicate",
			status: "survivor" as "survivor" | "duplicate",
			title: "survivor" as "survivor" | "duplicate",
			type: "survivor" as "survivor" | "duplicate",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			if (!preview.data) {
				setError(WORK_LIFECYCLE_COPY.mergePreview);
				return;
			}
			const duplicate = candidates.find((item) => item.id === duplicateId);
			if (!duplicate) {
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				merge.mutateAsync({
					duplicateBaseRevision: preview.data.duplicate.revision,
					duplicateId,
					fieldChoices: value,
					idempotencyKey: newIdempotencyKey(),
					previewAcknowledged: true,
					survivorBaseRevision: revision,
					survivorId: workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
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
	const onDuplicateChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setDuplicateId(event.target.value);
		},
		[]
	);
	if (candidates.length === 0) {
		return null;
	}
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<Field className="min-w-48">
					<FieldLabel htmlFor="merge-duplicate">
						{WORK_LIFECYCLE_COPY.mergeAsDuplicate}
					</FieldLabel>
					<NativeSelect
						className="w-full"
						id="merge-duplicate"
						onChange={onDuplicateChange}
						value={duplicateId}
					>
						{candidates.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.key} {item.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button disabled={merge.isPending || !preview.data} type="submit">
					{WORK_LIFECYCLE_COPY.mergeAsDuplicate}
				</Button>
			</FieldGroup>
			{preview.data ? (
				<section
					aria-label={WORK_LIFECYCLE_COPY.mergePreview}
					className="text-muted-foreground text-sm"
				>
					<h3 className="font-medium text-foreground text-sm">
						{WORK_LIFECYCLE_COPY.mergePreview}
					</h3>
					<p>
						{WORK_LIFECYCLE_COPY.survivingRecord} {preview.data.survivor.key}
					</p>
					<p>
						{WORK_LIFECYCLE_COPY.origin} {preview.data.duplicate.key}
					</p>
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{WORK_LIFECYCLE_COPY.fieldConflicts}
					</h4>
					{preview.data.fieldConflicts.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.fieldConflicts.map((conflict) => (
							<form.Field
								key={conflict.field}
								name={conflict.field as MergeField}
							>
								{(field) => (
									<ConflictChoice
										conflict={conflict}
										onChange={field.handleChange}
										value={field.state.value}
									/>
								)}
							</form.Field>
						))
					)}
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{WORK_LIFECYCLE_COPY.relationsToRewrite}
					</h4>
					{preview.data.relationsToRewrite.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.relationsToRewrite.map((relation) => (
							<p key={`${relation.fromId}:${relation.toId}`}>
								{WORK_LIFECYCLE_COPY.related} {relation.fromId} →{" "}
								{relation.rewrittenFromId}
							</p>
						))
					)}
				</section>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function ConflictChoice({
	conflict,
	onChange,
	value,
}: {
	conflict: {
		duplicateValue: string;
		field: string;
		survivorValue: string;
	};
	onChange: (value: "survivor" | "duplicate") => void;
	value: "survivor" | "duplicate";
}) {
	const onSelect = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.target.value as "survivor" | "duplicate");
		},
		[onChange]
	);
	return (
		<Field className="mt-1">
			<FieldLabel htmlFor={`merge-field-${conflict.field}`}>
				{conflict.field}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id={`merge-field-${conflict.field}`}
				onChange={onSelect}
				value={value}
			>
				<NativeSelectOption value="survivor">
					{conflict.survivorValue || "—"}
				</NativeSelectOption>
				<NativeSelectOption value="duplicate">
					{conflict.duplicateValue || "—"}
				</NativeSelectOption>
			</NativeSelect>
		</Field>
	);
}

export function MergeUndoButton({
	mergeEventId,
	projectId,
	revision,
	workId,
}: {
	mergeEventId: string;
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const undo = useMutation(
		orpc.workLifecycle.undoMerge.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
					setError(null);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const onClick = useCallback(() => {
		setError(null);
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			undo.mutateAsync({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				mergeEventId,
				survivorId: workId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, markUnsaved, mergeEventId, revision, undo, workId]);
	return (
		<div className="flex flex-col gap-2">
			<Button
				disabled={undo.isPending}
				onClick={onClick}
				type="button"
				variant="outline"
			>
				{MUTATION_COPY.undo}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}
