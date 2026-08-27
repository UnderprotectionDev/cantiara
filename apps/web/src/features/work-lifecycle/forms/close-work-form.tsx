import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import {
	CLOSURE_RESULTS,
	type ClosureResult,
	WORK_LIFECYCLE_COPY,
} from "./work-lifecycle-copy";

export default function CloseWorkForm({
	onCancel,
	projectId,
	revision,
	workId,
}: {
	onCancel: () => void;
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [notes, setNotes] = useState("");
	const preview = useQuery(
		orpc.workLifecycle.previewClose.queryOptions({
			input: { notes, workId },
		})
	);
	const close = useMutation(
		orpc.workLifecycle.close.mutationOptions({
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
	const form = useForm({
		defaultValues: { reason: "", result: "Completed" as ClosureResult },
		onSubmit: async ({ value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				close.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					reason: value.reason,
					result: value.result,
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
	const findings = preview.data?.findings;
	const hasFindings = Boolean(
		findings &&
			(findings.activeBlockers.length > 0 ||
				findings.incompleteChecklistItems.length > 0)
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<form.Field name="result">
					{(field) => (
						<ResultField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="reason">
					{(field) => (
						<ReasonField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
			</FieldGroup>
			<NotesField onValueChange={setNotes} value={notes} />
			{hasFindings ? (
				<section
					aria-label={WORK_LIFECYCLE_COPY.closureCheck}
					className="text-muted-foreground text-sm"
				>
					<h3 className="font-medium text-foreground text-sm">
						{WORK_LIFECYCLE_COPY.closureCheck}
					</h3>
					<ul>
						{findings?.incompleteChecklistItems.map((item) => (
							<li key={item.id}>{item.title}</li>
						))}
						{findings?.activeBlockers.map((item) => (
							<li key={item.id}>{item.title}</li>
						))}
					</ul>
				</section>
			) : null}
			{preview.data?.keepLastingContext ? (
				<section
					aria-label={WORK_LIFECYCLE_COPY.keepLastingContext}
					className="text-muted-foreground text-sm"
				>
					<h3 className="font-medium text-foreground text-sm">
						{WORK_LIFECYCLE_COPY.keepLastingContext}
					</h3>
					<p>{preview.data.keepLastingContext.decision.action}</p>
					<p>{preview.data.keepLastingContext.decision.body}</p>
					<p>{preview.data.keepLastingContext.personalWiki.action}</p>
					<p>{preview.data.keepLastingContext.personalWiki.body}</p>
				</section>
			) : null}
			<div className="flex flex-wrap gap-2">
				<Button onClick={onCancel} type="button" variant="ghost">
					{hasFindings
						? WORK_LIFECYCLE_COPY.returnToWork
						: MUTATION_COPY.cancel}
				</Button>
				{hasFindings ? (
					<Button disabled={close.isPending} type="submit">
						{WORK_LIFECYCLE_COPY.closeAnyway}
					</Button>
				) : (
					<Button disabled={close.isPending} type="submit">
						{WORK_LIFECYCLE_COPY.completed}
					</Button>
				)}
			</div>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function ResultField({
	onValueChange,
	value,
}: {
	onValueChange: (value: ClosureResult) => void;
	value: ClosureResult;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as ClosureResult);
		},
		[onValueChange]
	);
	return (
		<Field className="w-44">
			<FieldLabel htmlFor="close-work-result">
				{WORK_LIFECYCLE_COPY.completed}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="close-work-result"
				onChange={onChange}
				value={value}
			>
				{CLOSURE_RESULTS.map((result) => (
					<NativeSelectOption key={result} value={result}>
						{result}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function ReasonField({
	onValueChange,
	value,
}: {
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field className="min-w-48 flex-1">
			<FieldLabel htmlFor="close-work-reason">
				{WORK_LIFECYCLE_COPY.reason}
			</FieldLabel>
			<Textarea id="close-work-reason" onChange={onChange} value={value} />
		</Field>
	);
}

function NotesField({
	onValueChange,
	value,
}: {
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="close-work-notes">
				{WORK_LIFECYCLE_COPY.keepLastingContext}
			</FieldLabel>
			<Textarea id="close-work-notes" onChange={onChange} value={value} />
		</Field>
	);
}
