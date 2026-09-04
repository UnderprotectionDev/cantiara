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

import { SOURCES_COPY } from "./sources-copy";

export default function SaveSourceVersionForm({
	baseRevision,
	onSaved,
	projectId,
	sourceId,
	url,
}: {
	baseRevision: number;
	onSaved?: () => void;
	projectId: string;
	sourceId: string;
	url: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [capturedContent, setCapturedContent] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const save = useMutation(
		orpc.sources.saveVersion.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.sources.list.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.sources.get.queryKey({
							input: { sourceId },
						}),
					});
					onSaved?.();
					recordSave();
					setCapturedContent("");
					setError(null);
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
			attemptOnlineWork("record-edit", () =>
				save.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						capturedContent,
						sourceId,
						title,
						url,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			baseRevision,
			capturedContent,
			markUnsaved,
			save,
			sourceId,
			title,
			url,
		]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onCapturedChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setCapturedContent(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="source-version-title">
						{SOURCES_COPY.title}
					</FieldLabel>
					<Input
						id="source-version-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-version-captured">
						{SOURCES_COPY.capturedContent}
					</FieldLabel>
					<Textarea
						id="source-version-captured"
						onChange={onCapturedChange}
						value={capturedContent}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{SOURCES_COPY.saveAsNewSourceVersion}</Button>
		</form>
	);
}
