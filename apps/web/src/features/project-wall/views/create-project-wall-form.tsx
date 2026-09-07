import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_WALL_COPY } from "./project-wall-copy";

export default function CreateProjectWallForm({
	onCreated,
	projectId,
}: {
	onCreated?: (wallId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const create = useMutation(
		orpc.projectWall.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.projectWall.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.wall.id);
					recordSave();
					setError(null);
					setName("");
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
					payload: { name, projectId },
				})
			);
		},
		[attemptOnlineWork, create, markUnsaved, name, projectId]
	);
	const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);

	return (
		<form
			className="flex max-w-xl flex-wrap items-end gap-3"
			onSubmit={onSubmit}
		>
			<Field className="w-auto min-w-[12rem] max-w-sm flex-1">
				<FieldLabel htmlFor="project-wall-name">
					{PROJECT_WALL_COPY.name}
				</FieldLabel>
				<Input id="project-wall-name" onChange={onNameChange} value={name} />
			</Field>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{PROJECT_WALL_COPY.createProjectWall}</Button>
		</form>
	);
}
