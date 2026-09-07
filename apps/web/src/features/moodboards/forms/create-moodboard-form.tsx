import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";
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
		<form
			className="flex max-w-xl flex-wrap items-end gap-3"
			onSubmit={onSubmit}
		>
			<Field className="w-auto min-w-[12rem] max-w-sm flex-1">
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
