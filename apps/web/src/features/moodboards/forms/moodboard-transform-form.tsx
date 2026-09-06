import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { MOODBOARDS_COPY } from "./moodboards-copy";

type Rotation = 0 | 90 | 180 | 270;

export default function MoodboardTransformForm({
	crop,
	moodboardId,
	projectId,
	revision,
	rotation,
	visualId,
}: {
	crop: {
		height: number;
		left: number;
		top: number;
		width: number;
	} | null;
	moodboardId: string;
	projectId: string;
	revision: number;
	rotation: Rotation;
	visualId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const initial = crop ?? { height: 1, left: 0, top: 0, width: 1 };
	const [height, setHeight] = useState(String(initial.height));
	const [left, setLeft] = useState(String(initial.left));
	const [top, setTop] = useState(String(initial.top));
	const [width, setWidth] = useState(String(initial.width));
	const save = useMutation(
		orpc.moodboards.setViewTransform.mutationOptions({
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
	const commit = useCallback(
		(next: { crop: typeof crop; rotation: Rotation }) => {
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						crop: next.crop,
						rotation: next.rotation,
						visualId,
					},
				})
			);
		},
		[attemptOnlineWork, markUnsaved, revision, save, visualId]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			commit({
				crop: {
					height: Number(height),
					left: Number(left),
					top: Number(top),
					width: Number(width),
				},
				rotation,
			});
		},
		[commit, height, left, rotation, top, width]
	);
	const onRotate = useCallback(() => {
		const next = ((rotation + 90) % 360) as Rotation;
		commit({
			crop,
			rotation: next,
		});
	}, [commit, crop, rotation]);
	const onLeft = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setLeft(event.target.value);
	}, []);
	const onTop = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTop(event.target.value);
	}, []);
	const onWidth = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setWidth(event.target.value);
	}, []);
	const onHeight = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setHeight(event.target.value);
	}, []);

	return (
		<form className="flex flex-col gap-2" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`moodboard-crop-left-${visualId}`}>
						{MOODBOARDS_COPY.crop}
					</FieldLabel>
					<div className="grid grid-cols-2 gap-2">
						<Input
							id={`moodboard-crop-left-${visualId}`}
							max={1}
							min={0}
							onChange={onLeft}
							step="0.01"
							type="number"
							value={left}
						/>
						<Input
							id={`moodboard-crop-top-${visualId}`}
							max={1}
							min={0}
							onChange={onTop}
							step="0.01"
							type="number"
							value={top}
						/>
						<Input
							id={`moodboard-crop-width-${visualId}`}
							max={1}
							min={0}
							onChange={onWidth}
							step="0.01"
							type="number"
							value={width}
						/>
						<Input
							id={`moodboard-crop-height-${visualId}`}
							max={1}
							min={0}
							onChange={onHeight}
							step="0.01"
							type="number"
							value={height}
						/>
					</div>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<div className="flex flex-wrap gap-2">
				<Button type="submit">{PROJECT_SHELL_COPY.save}</Button>
				<Button onClick={onRotate} type="button">
					{MOODBOARDS_COPY.rotate}
				</Button>
			</div>
		</form>
	);
}
