import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import CloseWorkForm from "./close-work-form";
import { invalidateWork } from "./invalidate-work";
import {
	WORK_LIFECYCLE_COPY,
	WORK_STATUSES,
	type WorkStatus,
} from "./work-lifecycle-copy";

export default function ChangeWorkStatusForm({
	projectId,
	revision,
	status,
	workId,
}: {
	projectId: string;
	revision: number;
	status: WorkStatus;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [closing, setClosing] = useState(false);
	const change = useMutation(
		orpc.workLifecycle.changeStatus.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
					setError(null);
					return;
				}
				if (
					outcome.status === "rejected" &&
					outcome.reason === "close-step-required"
				) {
					setClosing(true);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const form = useForm({
		defaultValues: { status },
		onSubmit: async ({ value }) => {
			setError(null);
			if (value.status === "Closed") {
				setClosing(true);
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				change.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					status: value.status,
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
	const onCancelClose = useCallback(() => {
		setClosing(false);
		form.setFieldValue("status", status);
	}, [form, status]);

	if (closing) {
		return (
			<CloseWorkForm
				onCancel={onCancelClose}
				projectId={projectId}
				revision={revision}
				workId={workId}
			/>
		);
	}

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<form.Field name="status">
					{(field) => (
						<StatusField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<Button disabled={change.isPending} type="submit">
					{WORK_LIFECYCLE_COPY.status}
				</Button>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function StatusField({
	onValueChange,
	value,
}: {
	onValueChange: (value: WorkStatus) => void;
	value: WorkStatus;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as WorkStatus);
		},
		[onValueChange]
	);
	return (
		<Field className="w-44">
			<FieldLabel htmlFor="change-work-status">
				{WORK_LIFECYCLE_COPY.status}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="change-work-status"
				onChange={onChange}
				value={value}
			>
				{WORK_STATUSES.map((workStatus) => (
					<NativeSelectOption key={workStatus} value={workStatus}>
						{workStatus}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
