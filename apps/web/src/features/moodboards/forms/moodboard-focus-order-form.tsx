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

export default function MoodboardFocusOrderForm({
	moodboardId,
	projectId,
	revision,
	visuals,
}: {
	moodboardId: string;
	projectId: string;
	revision: number;
	visuals: readonly { id: string; label: string }[];
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [ranks, setRanks] = useState<Record<string, string>>(() =>
		Object.fromEntries(
			visuals.map((visual, index) => [visual.id, String(index + 1)])
		)
	);
	const save = useMutation(
		orpc.moodboards.setFocusOrder.mutationOptions({
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
			const visualIds = [...visuals]
				.sort(
					(left, right) =>
						Number(ranks[left.id] ?? 0) - Number(ranks[right.id] ?? 0)
				)
				.map((visual) => visual.id);
			attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					payload: { moodboardId, visualIds },
				})
			);
		},
		[
			attemptOnlineWork,
			markUnsaved,
			moodboardId,
			ranks,
			revision,
			save,
			visuals,
		]
	);
	const onRank = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		const id = event.target.name;
		const next = event.target.value;
		setRanks((current) => ({ ...current, [id]: next }));
	}, []);

	return (
		<form className="flex flex-col gap-2" onSubmit={onSubmit}>
			{visuals.map((visual) => (
				<Field key={visual.id}>
					<FieldLabel htmlFor={`moodboard-focus-${visual.id}`}>
						{MOODBOARDS_COPY.focusOrder} · {visual.label}
					</FieldLabel>
					<Input
						id={`moodboard-focus-${visual.id}`}
						min={1}
						name={visual.id}
						onChange={onRank}
						type="number"
						value={ranks[visual.id] ?? "1"}
					/>
				</Field>
			))}
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{PROJECT_SHELL_COPY.save}</Button>
		</form>
	);
}
