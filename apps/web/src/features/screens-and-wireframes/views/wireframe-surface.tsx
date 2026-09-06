import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Layer, Rect, Stage, Text } from "react-konva";

import ConvertAndBindForm from "@/features/screens-and-wireframes/forms/convert-and-bind-form";
import { SCREENS_COPY } from "@/features/screens-and-wireframes/forms/screens-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function WireframeSurface({
	onChanged,
	projectId,
	revision,
	screenId,
	versionNumber,
}: {
	onChanged: () => void;
	projectId: string;
	revision: number;
	screenId: string;
	versionNumber: number | null;
}) {
	const version = useQuery({
		...orpc.screensAndWireframes.getVersion.queryOptions({
			input: {
				overlayCurrent: true,
				screenId,
				versionNumber: versionNumber ?? 1,
			},
		}),
		enabled: versionNumber !== null,
	});
	const saveVersion = useMutation(
		orpc.screensAndWireframes.saveVersion.mutationOptions({
			onSuccess: () => {
				invalidate(projectId, screenId, versionNumber).catch(() => undefined);
				onChanged();
			},
		})
	);
	const detach = useMutation(
		orpc.screensAndWireframes.detachLinkedBlock.mutationOptions({
			onSuccess: () => {
				invalidate(projectId, screenId, versionNumber).catch(() => undefined);
				onChanged();
			},
		})
	);
	const onAddButton = useCallback(() => {
		const existing = version.data?.document.nodes ?? [];
		saveVersion.mutate({
			baseRevision: revision,
			document: {
				animations: version.data?.document.animations ?? [],
				canvasTypeface: "Shantell Sans",
				nodes: [
					...existing,
					{
						geometry: {
							height: 40,
							width: 120,
							x: 16,
							y: 16 + existing.length * 52,
						},
						id: crypto.randomUUID(),
						kind: "Button",
						label: SCREENS_COPY.button,
						seed: existing.length + 1,
					},
				],
				schema: "WireframeDocument",
				schemaVersion: 1,
			},
			idempotencyKey: newIdempotencyKey(),
			screenId,
		});
	}, [revision, saveVersion, screenId, version.data]);
	const onDetach = useCallback(
		(nodeId: string) => {
			detach.mutate({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				nodeId,
				screenId,
			});
		},
		[detach, revision, screenId]
	);

	const nodes = version.data?.presentedNodes ?? [];
	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">{SCREENS_COPY.wireframe}</h3>
			<div className="flex flex-wrap gap-2">
				<Button onClick={onAddButton} type="button" variant="outline">
					{SCREENS_COPY.button}
				</Button>
			</div>
			{versionNumber !== null && version.data ? (
				<Stage height={240} listening={false} width={480}>
					<Layer>
						{nodes.map((node) => (
							<Rect
								fill="transparent"
								height={node.geometry.height}
								key={node.id}
								stroke="#171717"
								strokeWidth={1}
								width={node.geometry.width}
								x={node.geometry.x}
								y={node.geometry.y}
							/>
						))}
						{nodes.map((node) => (
							<Text
								fontFamily="Shantell Sans, sans-serif"
								fontSize={14}
								key={`${node.id}-label`}
								text={
									node.text?.status === "broken"
										? SCREENS_COPY.broken
										: (node.text?.value ?? node.label ?? node.kind)
								}
								x={node.geometry.x + 8}
								y={node.geometry.y + 12}
							/>
						))}
					</Layer>
				</Stage>
			) : null}
			<ul className="flex flex-col gap-2 text-sm">
				{nodes.map((node) => (
					<li className="flex flex-wrap items-center gap-2" key={node.id}>
						<span>{node.kind}</span>
						{node.label ? <span>{node.label}</span> : null}
						{node.text?.status === "broken" ? (
							<span>{SCREENS_COPY.broken}</span>
						) : null}
						{node.text?.status === "ok" ? <span>{node.text.value}</span> : null}
						{node.linkedBlockId ? (
							<DetachButton nodeId={node.id} onDetach={onDetach} />
						) : null}
						{versionNumber !== null && !node.liveRecord ? (
							<ConvertAndBindForm
								nodeId={node.id}
								onConverted={onChanged}
								projectId={projectId}
								screenId={screenId}
								versionNumber={versionNumber}
							/>
						) : null}
						{node.liveRecord ? (
							<span>{SCREENS_COPY.openSourceRecord}</span>
						) : null}
					</li>
				))}
			</ul>
		</section>
	);
}

function DetachButton({
	nodeId,
	onDetach,
}: {
	nodeId: string;
	onDetach: (nodeId: string) => void;
}) {
	const onClick = useCallback(() => {
		onDetach(nodeId);
	}, [nodeId, onDetach]);
	return (
		<Button onClick={onClick} type="button" variant="outline">
			{SCREENS_COPY.detachLink}
		</Button>
	);
}

async function invalidate(
	projectId: string,
	screenId: string,
	versionNumber: number | null
): Promise<void> {
	await queryClient.invalidateQueries({
		queryKey: orpc.screensAndWireframes.list.queryKey({
			input: { projectId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.screensAndWireframes.get.queryKey({
			input: { screenId },
		}),
	});
	if (versionNumber === null) {
		return;
	}
	await queryClient.invalidateQueries({
		queryKey: orpc.screensAndWireframes.getVersion.queryKey({
			input: { overlayCurrent: true, screenId, versionNumber },
		}),
	});
}
