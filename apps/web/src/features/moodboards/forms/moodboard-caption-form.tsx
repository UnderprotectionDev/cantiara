import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { MOODBOARDS_COPY } from "./moodboards-copy";

export default function MoodboardCaptionForm({
	caption,
	moodboardId,
	projectId,
	revision,
	visualId,
}: {
	caption: string;
	moodboardId: string;
	projectId: string;
	revision: number;
	visualId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [value, setValue] = useState(caption);
	const save = useMutation(
		orpc.moodboards.setCaption.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.get.queryKey({
							input: { moodboardId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setError(null);
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
				save.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					payload: { caption: value, visualId },
				})
			);
		},
		[attemptOnlineWork, markUnsaved, revision, save, value, visualId]
	);
	const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setValue(event.target.value);
	}, []);

	return (
		<form className="flex flex-col gap-2" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor={`moodboard-caption-${visualId}`}>
					{MOODBOARDS_COPY.caption}
				</FieldLabel>
				<Input
					id={`moodboard-caption-${visualId}`}
					maxLength={280}
					onChange={onChange}
					value={value}
				/>
			</Field>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{PROJECT_SHELL_COPY.save}</Button>
		</form>
	);
}
