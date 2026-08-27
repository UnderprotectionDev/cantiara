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
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import {
	involvesFeature,
	WORK_LIFECYCLE_COPY,
	WORK_TYPES,
	type WorkType,
} from "./work-lifecycle-copy";

export default function ChangeWorkTypeForm({
	projectId,
	revision,
	type,
	workId,
}: {
	projectId: string;
	revision: number;
	type: WorkType;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [pendingType, setPendingType] = useState<WorkType>(type);
	const previewNeeded = involvesFeature(type, pendingType);
	const preview = useQuery({
		...orpc.workLifecycle.previewTypeChange.queryOptions({
			input: { type: pendingType, workId },
		}),
		enabled: previewNeeded,
	});
	const previewReady = !previewNeeded || Boolean(preview.data);
	const previewBlocked = Boolean(preview.data?.blocked);
	const change = useMutation(
		orpc.workLifecycle.changeType.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					if (outcome.reason === "feature-exit-blocked") {
						setError(WORK_LIFECYCLE_COPY.detachBeforeLeavingFeature);
						return;
					}
					if (outcome.reason === "feature-impact-preview-required") {
						setError(WORK_LIFECYCLE_COPY.impactPreview);
						return;
					}
				}
				setError("Conflict");
			},
		})
	);
	const form = useForm({
		defaultValues: { type },
		onSubmit: async ({ value }) => {
			setError(null);
			if (involvesFeature(type, value.type) && !preview.data) {
				setError(WORK_LIFECYCLE_COPY.impactPreview);
				return;
			}
			if (preview.data?.blocked) {
				setError(WORK_LIFECYCLE_COPY.detachBeforeLeavingFeature);
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				change.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					previewAcknowledged: involvesFeature(type, value.type),
					type: value.type,
					workId,
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
	const onTypeChange = useCallback(
		(value: WorkType) => {
			setPendingType(value);
			form.setFieldValue("type", value);
		},
		[form]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<form.Field name="type">
					{(field) => (
						<TypeField onValueChange={onTypeChange} value={field.state.value} />
					)}
				</form.Field>
				<Button
					disabled={change.isPending || !previewReady || previewBlocked}
					type="submit"
				>
					{previewNeeded
						? WORK_LIFECYCLE_COPY.confirmTypeChange
						: WORK_LIFECYCLE_COPY.changeType}
				</Button>
			</FieldGroup>
			{previewNeeded && preview.data ? (
				<section
					aria-label={WORK_LIFECYCLE_COPY.impactPreview}
					className="text-muted-foreground text-sm"
				>
					<h3 className="font-medium text-foreground text-sm">
						{WORK_LIFECYCLE_COPY.impactPreview}
					</h3>
					<p>
						{WORK_LIFECYCLE_COPY.includedWork}{" "}
						{preview.data.includedWork.length}
					</p>
					<p>
						{WORK_LIFECYCLE_COPY.featureHealth}{" "}
						{preview.data.healthHistory.length}
					</p>
					<p>
						{WORK_LIFECYCLE_COPY.primarySpec}{" "}
						{preview.data.primarySpec?.title ?? "—"}
					</p>
					{preview.data.blocked ? (
						<p role="alert">{WORK_LIFECYCLE_COPY.detachBeforeLeavingFeature}</p>
					) : null}
				</section>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function TypeField({
	onValueChange,
	value,
}: {
	onValueChange: (value: WorkType) => void;
	value: WorkType;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as WorkType);
		},
		[onValueChange]
	);
	return (
		<Field className="w-40">
			<FieldLabel htmlFor="change-work-type">
				{WORK_LIFECYCLE_COPY.type}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="change-work-type"
				onChange={onChange}
				value={value}
			>
				{WORK_TYPES.map((workType) => (
					<NativeSelectOption key={workType} value={workType}>
						{workType}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
