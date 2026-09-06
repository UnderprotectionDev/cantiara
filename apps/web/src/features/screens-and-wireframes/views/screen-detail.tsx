import { Button } from "@cantiara/ui/components/button";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { SCREENS_COPY } from "@/features/screens-and-wireframes/forms/screens-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import WireframeSurface from "./wireframe-surface";

export default function ScreenDetail({
	onCleared,
	projectId,
	screenId,
}: {
	onCleared?: () => void;
	projectId: string;
	screenId: string;
}) {
	const screen = useQuery(
		orpc.screensAndWireframes.get.queryOptions({ input: { screenId } })
	);
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.screensAndWireframes.list.queryKey({
				input: { projectId },
			}),
		});
		await screen.refetch();
	}, [projectId, screen]);

	const archive = useMutation(
		orpc.screensAndWireframes.archive.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const unarchive = useMutation(
		orpc.screensAndWireframes.unarchive.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const trash = useMutation(
		orpc.screensAndWireframes.trash.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const restore = useMutation(
		orpc.screensAndWireframes.restore.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const permanentlyDelete = useMutation(
		orpc.screensAndWireframes.permanentlyDelete.mutationOptions({
			onSuccess: () => {
				queryClient
					.invalidateQueries({
						queryKey: orpc.screensAndWireframes.list.queryKey({
							input: { projectId },
						}),
					})
					.catch(() => undefined);
				onCleared?.();
			},
		})
	);

	const run = useCallback(
		(kind: "archive" | "unarchive" | "trash" | "restore" | "delete") => {
			const revision = screen.data?.revision;
			if (!revision) {
				return;
			}
			const payload = {
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				screenId,
			};
			if (kind === "archive") {
				archive.mutate(payload);
				return;
			}
			if (kind === "unarchive") {
				unarchive.mutate(payload);
				return;
			}
			if (kind === "trash") {
				trash.mutate(payload);
				return;
			}
			if (kind === "restore") {
				restore.mutate(payload);
				return;
			}
			permanentlyDelete.mutate(payload);
		},
		[
			archive,
			permanentlyDelete,
			restore,
			screen.data?.revision,
			screenId,
			trash,
			unarchive,
		]
	);
	const onArchive = useCallback(() => {
		run("archive");
	}, [run]);
	const onUnarchive = useCallback(() => {
		run("unarchive");
	}, [run]);
	const onTrash = useCallback(() => {
		run("trash");
	}, [run]);
	const onRestore = useCallback(() => {
		run("restore");
	}, [run]);
	const onDelete = useCallback(() => {
		run("delete");
	}, [run]);
	const onWireframeChanged = useCallback(() => {
		invalidate().catch(() => undefined);
	}, [invalidate]);

	if (screen.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (screen.isError || !screen.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const record = screen.data;
	return (
		<div className="flex flex-col gap-4">
			<h2 className="font-semibold text-lg tracking-tight">{record.title}</h2>
			<p className="text-muted-foreground text-sm">{record.life}</p>
			{record.life === SCREENS_COPY.active ? (
				<WireframeSurface
					onChanged={onWireframeChanged}
					projectId={projectId}
					revision={record.revision}
					screenId={screenId}
					versionNumber={record.versions.at(-1)?.versionNumber ?? null}
				/>
			) : null}
			<div className="flex flex-wrap gap-2">
				{record.life === SCREENS_COPY.active ? (
					<>
						<Button onClick={onArchive} type="button" variant="outline">
							{SCREENS_COPY.archive}
						</Button>
						<Button onClick={onTrash} type="button" variant="outline">
							{SCREENS_COPY.moveToTrash}
						</Button>
					</>
				) : null}
				{record.life === SCREENS_COPY.archived ? (
					<>
						<Button onClick={onUnarchive} type="button" variant="outline">
							{SCREENS_COPY.unarchive}
						</Button>
						<Button onClick={onTrash} type="button" variant="outline">
							{SCREENS_COPY.moveToTrash}
						</Button>
					</>
				) : null}
				{record.life === SCREENS_COPY.inTrash ? (
					<>
						<Button onClick={onRestore} type="button" variant="outline">
							{SCREENS_COPY.restore}
						</Button>
						<Button onClick={onDelete} type="button" variant="outline">
							{SCREENS_COPY.deletePermanently}
						</Button>
					</>
				) : null}
			</div>
		</div>
	);
}
