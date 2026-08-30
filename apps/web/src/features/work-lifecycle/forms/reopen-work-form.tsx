import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
	getCompletionEffectsClientSession,
	subscribeCompletionEffectsClientSession,
} from "@/features/completion-effects/completion-effects-session";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import {
	NON_TERMINAL_WORK_STATUSES,
	type NonTerminalWorkStatus,
	WORK_LIFECYCLE_COPY,
} from "./work-lifecycle-copy";

export default function ReopenWorkForm({
	projectId,
	revision,
	workId,
}: {
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [reopenConfirmed, setReopenConfirmed] = useState(false);
	const completionSession = useSyncExternalStore(
		subscribeCompletionEffectsClientSession,
		getCompletionEffectsClientSession,
		getCompletionEffectsClientSession
	);
	useEffect(() => {
		if (completionSession.reopenConfirmationRequested) {
			setReopenConfirmed(true);
		}
	}, [completionSession.reopenConfirmationRequested]);
	const reopen = useMutation(
		orpc.workLifecycle.reopen.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
					setError(null);
					return;
				}
				if (
					outcome.status === "rejected" &&
					outcome.reason === "reopen-confirm-required"
				) {
					setError(WORK_LIFECYCLE_COPY.confirmReopen);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const form = useForm({
		defaultValues: { status: "In Progress" as NonTerminalWorkStatus },
		onSubmit: async ({ value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				reopen.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					reopenConfirmed,
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
	const onConfirmIntent = useCallback(() => {
		setReopenConfirmed(true);
	}, []);

	return (
		<form
			className="flex flex-col gap-3"
			id="work-reopen-confirmation"
			onSubmit={onSubmit}
		>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<form.Field name="status">
					{(field) => (
						<TargetStatusField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				{reopenConfirmed ? (
					<Button disabled={reopen.isPending} type="submit">
						{WORK_LIFECYCLE_COPY.confirmReopen}
					</Button>
				) : (
					<Button onClick={onConfirmIntent} type="button">
						{WORK_LIFECYCLE_COPY.reopen}
					</Button>
				)}
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function TargetStatusField({
	onValueChange,
	value,
}: {
	onValueChange: (value: NonTerminalWorkStatus) => void;
	value: NonTerminalWorkStatus;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as NonTerminalWorkStatus);
		},
		[onValueChange]
	);
	return (
		<Field className="w-44">
			<FieldLabel htmlFor="reopen-work-status">
				{WORK_LIFECYCLE_COPY.reopen}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="reopen-work-status"
				onChange={onChange}
				value={value}
			>
				{NON_TERMINAL_WORK_STATUSES.map((workStatus) => (
					<NativeSelectOption key={workStatus} value={workStatus}>
						{workStatus}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
