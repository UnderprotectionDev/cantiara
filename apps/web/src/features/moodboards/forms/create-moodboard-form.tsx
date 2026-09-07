import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";
import {
	COMPACT_CREATE_FIELD_CLASS,
	COMPACT_CREATE_FORM_CLASS,
} from "@/features/project-shell/views/compact-create-form";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { MOODBOARDS_COPY } from "./moodboards-copy";

export default function CreateMoodboardForm({
	onCreated,
	projectId,
}: {
	onCreated?: (moodboardId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.moodboards.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.moodboard.id);
					recordSave();
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
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: { projectId, title },
				})
			);
		},
		[attemptOnlineWork, create, markUnsaved, projectId, title]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);

	return (
		<form className={COMPACT_CREATE_FORM_CLASS} onSubmit={onSubmit}>
			<Field className={COMPACT_CREATE_FIELD_CLASS}>
				<FieldLabel htmlFor="moodboard-title">
					{MOODBOARDS_COPY.title}
				</FieldLabel>
				<Input
					id="moodboard-title"
					onChange={onTitleChange}
					required
					value={title}
				/>
			</Field>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{MOODBOARDS_COPY.createMoodboard}</Button>
		</form>
	);
}
