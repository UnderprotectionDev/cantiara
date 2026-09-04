import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { FEEDBACK_COPY } from "./feedback-copy";

export default function CreateFeedbackForm({
	onCreated,
	projectId,
}: {
	onCreated?: (feedbackId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [channel, setChannel] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [link, setLink] = useState("");
	const [occurredAt, setOccurredAt] = useState("");
	const [originalMessage, setOriginalMessage] = useState("");
	const [sourceId, setSourceId] = useState("");
	const sources = useQuery(
		orpc.sources.list.queryOptions({
			input: { projectId },
		})
	);
	const create = useMutation(
		orpc.feedback.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateList();
					onCreated?.(outcome.feedback.id);
					recordSave();
					resetForm();
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const createFromSource = useMutation(
		orpc.feedback.createFromSource.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateList();
					onCreated?.(outcome.feedback.id);
					recordSave();
					resetForm();
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);

	const invalidateList = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.feedback.list.queryKey({
				input: { projectId },
			}),
		});
	}, [projectId]);

	const resetForm = useCallback(() => {
		setError(null);
		setChannel("");
		setLink("");
		setOccurredAt("");
		setOriginalMessage("");
		setSourceId("");
	}, []);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			if (sourceId) {
				attemptOnlineWork("record-create", () =>
					createFromSource.mutateAsync({
						idempotencyKey: newIdempotencyKey(),
						payload: {
							channel,
							sourceId,
						},
					})
				);
				return;
			}
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						channel,
						occurredAt: occurredAt || undefined,
						originalMessage,
						projectId,
						url: link,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			channel,
			create,
			createFromSource,
			link,
			markUnsaved,
			occurredAt,
			originalMessage,
			projectId,
			sourceId,
		]
	);

	const onOriginalMessageChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setOriginalMessage(event.target.value);
		},
		[]
	);
	const onChannelChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setChannel(event.target.value);
		},
		[]
	);
	const onOccurredAtChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setOccurredAt(event.target.value);
		},
		[]
	);
	const onLinkChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setLink(event.target.value);
	}, []);
	const onSourceChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setSourceId(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="feedback-original-message">
						{FEEDBACK_COPY.originalMessage}
					</FieldLabel>
					<Textarea
						id="feedback-original-message"
						onChange={onOriginalMessageChange}
						required={!sourceId}
						value={originalMessage}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="feedback-channel">
						{FEEDBACK_COPY.channel}
					</FieldLabel>
					<Input
						id="feedback-channel"
						onChange={onChannelChange}
						required
						value={channel}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="feedback-occurred-at">
						{FEEDBACK_COPY.occurredAt}
					</FieldLabel>
					<Input
						id="feedback-occurred-at"
						onChange={onOccurredAtChange}
						type="datetime-local"
						value={occurredAt}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="feedback-link">{FEEDBACK_COPY.link}</FieldLabel>
					<Input id="feedback-link" onChange={onLinkChange} value={link} />
				</Field>
				<Field>
					<FieldLabel htmlFor="feedback-source">
						{FEEDBACK_COPY.createFromSource}
					</FieldLabel>
					<NativeSelect
						id="feedback-source"
						onChange={onSourceChange}
						value={sourceId}
					>
						<NativeSelectOption value="">
							{FEEDBACK_COPY.source}
						</NativeSelectOption>
						{(sources.data ?? []).map((source) => (
							<NativeSelectOption key={source.id} value={source.id}>
								{source.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{FEEDBACK_COPY.createFeedback}</Button>
		</form>
	);
}
