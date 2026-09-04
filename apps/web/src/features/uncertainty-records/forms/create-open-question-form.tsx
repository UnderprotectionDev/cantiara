import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { UNCERTAINTY_COPY } from "./uncertainty-records-copy";

export default function CreateOpenQuestionForm({
	onCreated,
	projectId,
}: {
	onCreated?: (openQuestionId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [context, setContext] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [question, setQuestion] = useState("");
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.uncertaintyRecords.createOpenQuestion.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.uncertaintyRecords.listOpenQuestions.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.openQuestion.id);
					recordSave();
					setContext("");
					setError(null);
					setQuestion("");
					setTitle("");
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						context,
						projectId,
						question,
						title,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			context,
			create,
			markUnsaved,
			projectId,
			question,
			title,
		]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onQuestionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setQuestion(event.target.value);
		},
		[]
	);
	const onContextChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setContext(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="open-question-title">
						{UNCERTAINTY_COPY.title}
					</FieldLabel>
					<Input
						id="open-question-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="open-question-question">
						{UNCERTAINTY_COPY.question}
					</FieldLabel>
					<Textarea
						id="open-question-question"
						onChange={onQuestionChange}
						required
						value={question}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="open-question-context">
						{UNCERTAINTY_COPY.context}
					</FieldLabel>
					<Textarea
						id="open-question-context"
						onChange={onContextChange}
						value={context}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{UNCERTAINTY_COPY.createOpenQuestion}</Button>
		</form>
	);
}
