import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { orpc, queryClient } from "@/utils/orpc";

import CreateProjectWallForm from "./create-project-wall-form";
import ProjectWallCanvas from "./project-wall-canvas";
import { PROJECT_WALL_COPY } from "./project-wall-copy";

export default function ProjectWallArea({
	onOpenSourceRecord,
	projectId,
}: {
	onOpenSourceRecord?: (sourceId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork } = useClientShell();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const materialize = useMutation(
		orpc.projectWall.materializeStarterSkeletons.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.projectWall.list.queryKey({
						input: { projectId },
					}),
				});
			},
		})
	);
	useEffect(() => {
		const result = attemptOnlineWork("record-create", () =>
			materialize.mutateAsync({
				idempotencyKey: `starter-skeleton-walls:${projectId}`,
				payload: { projectId },
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, materialize.mutateAsync, projectId]);
	const walls = useQuery(
		orpc.projectWall.list.queryOptions({ input: { projectId } })
	);
	const onCreated = useCallback((wallId: string) => {
		setSelectedId(wallId);
	}, []);
	const onSelect = useCallback((wallId: string) => {
		setSelectedId(wallId);
	}, []);

	if (walls.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (walls.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const selected = selectedId ?? walls.data[0]?.id ?? null;

	return (
		<div className="flex flex-col gap-6">
			<CreateProjectWallForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{walls.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{PROJECT_WALL_COPY.noProjectWall}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{walls.data.map((item) => (
							<li key={item.id}>
								<WallRow
									name={item.name}
									onSelect={onSelect}
									selected={item.id === selected}
									wallId={item.id}
								/>
							</li>
						))}
					</ul>
				)}
				{selected ? (
					<ProjectWallCanvas
						onOpenSourceRecord={onOpenSourceRecord}
						wallId={selected}
					/>
				) : null}
			</div>
		</div>
	);
}

function WallRow({
	name,
	onSelect,
	selected,
	wallId,
}: {
	name: string;
	onSelect: (wallId: string) => void;
	selected: boolean;
	wallId: string;
}) {
	const onClick = useCallback(() => {
		onSelect(wallId);
	}, [onSelect, wallId]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
			onClick={onClick}
			type="button"
		>
			{name}
		</button>
	);
}
