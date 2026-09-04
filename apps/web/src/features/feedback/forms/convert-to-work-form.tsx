import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { FEEDBACK_COPY } from "@/features/feedback/forms/feedback-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function ConvertToWorkForm({
	feedbackId,
	projectId,
}: {
	feedbackId: string;
	projectId: string;
}) {
	const [error, setError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const preview = useQuery({
		...orpc.feedback.previewConvertToWork.queryOptions({
			input: {
				feedbackId,
				projectId,
				title: title.trim() === "" ? undefined : title.trim(),
			},
		}),
	});
	const convert = useMutation(
		orpc.feedback.convertToWork.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				await queryClient.invalidateQueries({
					queryKey: orpc.feedback.get.queryKey({
						input: { feedbackId },
					}),
				});
				await queryClient.invalidateQueries({
					queryKey: orpc.workLifecycle.list.queryKey({
						input: { projectId },
					}),
				});
			},
		})
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onConfirm = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (preview.data?.status !== "ok") {
				return;
			}
			convert.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					feedbackId,
					previewAcknowledged: true,
					previewFingerprint: preview.data.preview.fingerprint,
					projectId,
					title: title.trim() === "" ? undefined : title.trim(),
				},
			});
		},
		[convert, feedbackId, preview.data, projectId, title]
	);
	const mapping =
		preview.data?.status === "ok" ? preview.data.preview : undefined;

	return (
		<form
			aria-label={FEEDBACK_COPY.convertToWork}
			className="flex flex-col gap-2 border border-input p-2"
			onSubmit={onConfirm}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`feedback-convert-title-${feedbackId}`}>
						{FEEDBACK_COPY.title}
					</FieldLabel>
					<Input
						id={`feedback-convert-title-${feedbackId}`}
						onChange={onTitleChange}
						value={title}
					/>
				</Field>
			</FieldGroup>
			{mapping ? (
				<div className="flex flex-col gap-1 text-sm">
					<p>
						{FEEDBACK_COPY.feedback}: {mapping.recordKind}
					</p>
					<p>
						{FEEDBACK_COPY.project}: {mapping.projectId}
					</p>
					<p>
						{FEEDBACK_COPY.title}: {mapping.title}
					</p>
					<p>
						{FEEDBACK_COPY.description}: {mapping.body}
					</p>
					<p>{mapping.origin}</p>
				</div>
			) : null}
			<Button disabled={mapping === undefined} type="submit">
				{FEEDBACK_COPY.convertToWork}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}
