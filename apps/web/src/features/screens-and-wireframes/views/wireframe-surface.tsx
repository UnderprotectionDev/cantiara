import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import { Layer, Rect, Stage, Text } from "react-konva";

import { SCREENS_COPY } from "@/features/screens-and-wireframes/forms/screens-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

interface OutlineNode {
	geometry: { height: number; width: number; x: number; y: number };
	groupId?: string;
	id: string;
	kind: string;
	label?: string;
	linkedBlockId?: string;
	openHref: string | null;
	openSourceRecord: string;
	text?: { status: "broken" | "ok"; value: string };
}

interface OutlineGroup {
	id: string;
	title: string;
}

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
	const viewport = useQuery(
		orpc.screensAndWireframes.getViewport.queryOptions({
			input: { screenId },
		})
	);
	const linkedBlocks = useQuery(
		orpc.screensAndWireframes.listLinkedBlocks.queryOptions({
			input: { projectId },
		})
	);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const saveVersion = useMutation(
		orpc.screensAndWireframes.saveVersion.mutationOptions({
			onSuccess: () => {
				invalidate(projectId, screenId, versionNumber).catch(() => undefined);
				onChanged();
			},
		})
	);
	const createNode = useMutation(
		orpc.screensAndWireframes.createOutlineNode.mutationOptions({
			onSuccess: () => {
				invalidate(projectId, screenId, versionNumber).catch(() => undefined);
				onChanged();
			},
		})
	);
	const reorder = useMutation(
		orpc.screensAndWireframes.reorderOutline.mutationOptions({
			onSuccess: () => {
				invalidate(projectId, screenId, versionNumber).catch(() => undefined);
				onChanged();
			},
		})
	);
	const group = useMutation(
		orpc.screensAndWireframes.groupOutline.mutationOptions({
			onSuccess: () => {
				invalidate(projectId, screenId, versionNumber).catch(() => undefined);
				onChanged();
				setSelectedIds([]);
			},
		})
	);
	const bind = useMutation(
		orpc.screensAndWireframes.bindOutline.mutationOptions({
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
	const saveViewport = useMutation(
		orpc.screensAndWireframes.saveViewport.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.screensAndWireframes.getViewport.queryKey({
						input: { screenId },
					}),
				});
			},
		})
	);

	const restored = viewport.data?.viewport;
	const collapsed = useMemo(
		() => new Set(restored?.collapsedGroupIds ?? []),
		[restored?.collapsedGroupIds]
	);
	const nodes = (version.data?.presentedNodes ?? []) as OutlineNode[];
	const groups = (version.data?.document.groups ?? []) as OutlineGroup[];

	const persistViewport = useCallback(
		(next: {
			centerX: number;
			centerY: number;
			collapsedGroupIds: string[];
			zoom: number;
		}) => {
			saveViewport.mutate({
				payload: {
					screenId,
					viewport: next,
				},
			});
		},
		[saveViewport, screenId]
	);

	const onFitView = useCallback(() => {
		persistViewport({
			centerX: 0,
			centerY: 0,
			collapsedGroupIds: [],
			zoom: 1,
		});
	}, [persistViewport]);

	const onAddButton = useCallback(() => {
		createNode.mutate({
			baseRevision: revision,
			idempotencyKey: newIdempotencyKey(),
			payload: {
				kind: "Button",
				screenId,
			},
		});
	}, [createNode, revision, screenId]);

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

	const onToggleSelect = useCallback((nodeId: string) => {
		setSelectedIds((current) =>
			current.includes(nodeId)
				? current.filter((id) => id !== nodeId)
				: [...current, nodeId]
		);
	}, []);

	const onMove = useCallback(
		(nodeId: string, direction: -1 | 1) => {
			const ids = nodes.map((node) => node.id);
			const index = ids.indexOf(nodeId);
			const next = index + direction;
			if (index < 0 || next < 0 || next >= ids.length) {
				return;
			}
			const nextIds = [...ids];
			const [moved] = nextIds.splice(index, 1);
			if (!moved) {
				return;
			}
			nextIds.splice(next, 0, moved);
			reorder.mutate({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { nodeIds: nextIds, screenId },
			});
		},
		[nodes, reorder, revision, screenId]
	);

	const onGroup = useCallback(() => {
		if (selectedIds.length === 0) {
			return;
		}
		group.mutate({
			baseRevision: revision,
			idempotencyKey: newIdempotencyKey(),
			payload: {
				nodeIds: selectedIds,
				screenId,
				title: SCREENS_COPY.group,
			},
		});
	}, [group, revision, screenId, selectedIds]);

	const onBind = useCallback(() => {
		const linkedBlockId = linkedBlocks.data?.[0]?.id;
		const [nodeId] = selectedIds;
		if (!(linkedBlockId && nodeId)) {
			return;
		}
		bind.mutate({
			baseRevision: revision,
			idempotencyKey: newIdempotencyKey(),
			payload: { linkedBlockId, nodeId, screenId },
		});
	}, [bind, linkedBlocks.data, revision, screenId, selectedIds]);

	const onToggleCollapse = useCallback(
		(groupId: string) => {
			const next = new Set(collapsed);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			persistViewport({
				centerX: restored?.centerX ?? 0,
				centerY: restored?.centerY ?? 0,
				collapsedGroupIds: [...next],
				zoom: restored?.zoom ?? 1,
			});
		},
		[collapsed, persistViewport, restored]
	);

	const persistGeometry = useCallback(
		(deltaX: number, deltaY: number, axis: "left" | null) => {
			const document = version.data?.document;
			if (!document) {
				return;
			}
			const selected = document.nodes.filter((node) =>
				selectedIds.includes(node.id)
			);
			const left =
				axis === "left"
					? Math.min(...selected.map((node) => node.geometry.x))
					: null;
			saveVersion.mutate({
				baseRevision: revision,
				document: {
					...document,
					nodes: document.nodes.map((node) => {
						if (!selectedIds.includes(node.id)) {
							return node;
						}
						return {
							...node,
							geometry: {
								...node.geometry,
								x: left ?? node.geometry.x + deltaX,
								y: node.geometry.y + deltaY,
							},
						};
					}),
				},
				idempotencyKey: newIdempotencyKey(),
				screenId,
			});
		},
		[revision, saveVersion, screenId, selectedIds, version.data?.document]
	);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			const applied = applyWireframeKey(event, {
				hasSelection: selectedIds.length > 0,
				multiSelect: selectedIds.length > 1,
				viewport: {
					centerX: restored?.centerX ?? 0,
					centerY: restored?.centerY ?? 0,
					zoom: restored?.zoom ?? 1,
				},
			});
			if (!applied) {
				return;
			}
			event.preventDefault();
			if (applied.kind === "nudge") {
				persistGeometry(applied.deltaX, applied.deltaY, null);
				return;
			}
			if (applied.kind === "align") {
				persistGeometry(0, 0, "left");
				return;
			}
			persistViewport({
				centerX: applied.viewport.centerX,
				centerY: applied.viewport.centerY,
				collapsedGroupIds: [...collapsed],
				zoom: applied.viewport.zoom,
			});
		},
		[collapsed, persistGeometry, persistViewport, restored, selectedIds]
	);

	const selectedNode = nodes.find((node) => node.id === selectedIds[0]);
	const scale = restored?.zoom ?? 1;
	const translateX = -(restored?.centerX ?? 0);
	const translateY = -(restored?.centerY ?? 0);

	return (
		// Canvas keyboard pan/zoom/select lives on the surface, not a button.
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: keyboard canvas
		<div
			aria-label={SCREENS_COPY.wireframe}
			className="flex flex-col gap-3"
			onKeyDown={onKeyDown}
			role="application"
			// biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard canvas
			tabIndex={0}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="font-medium text-sm">{SCREENS_COPY.wireframe}</h3>
				<div className="flex flex-wrap gap-2">
					<Button onClick={onFitView} type="button" variant="outline">
						{SCREENS_COPY.fitView}
					</Button>
					<Button
						disabled={selectedIds.length === 0}
						onClick={onGroup}
						type="button"
						variant="outline"
					>
						{SCREENS_COPY.group}
					</Button>
					<Button
						disabled={selectedIds.length === 0 || !linkedBlocks.data?.[0]}
						onClick={onBind}
						type="button"
						variant="outline"
					>
						{SCREENS_COPY.navigation}
					</Button>
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button onClick={onAddButton} type="button" variant="outline">
					{SCREENS_COPY.button}
				</Button>
			</div>
			<div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
				<nav aria-label={SCREENS_COPY.outline}>
					<h3 className="font-medium text-sm">{SCREENS_COPY.outline}</h3>
					{nodes.length === 0 ? (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>{SCREENS_COPY.button}</EmptyTitle>
							</EmptyHeader>
						</Empty>
					) : (
						<ul className="mt-2 flex flex-col gap-2">
							{groups.map((boardGroup) => (
								<OutlineGroupRow
									collapsed={collapsed.has(boardGroup.id)}
									id={boardGroup.id}
									key={boardGroup.id}
									nodes={nodes.filter((node) => node.groupId === boardGroup.id)}
									onDetach={onDetach}
									onMove={onMove}
									onToggleCollapse={onToggleCollapse}
									onToggleSelect={onToggleSelect}
									selectedIds={selectedIds}
									title={boardGroup.title}
								/>
							))}
							{nodes
								.filter((node) => !node.groupId)
								.map((node) => (
									<OutlineNodeRow
										key={node.id}
										node={node}
										onDetach={onDetach}
										onMove={onMove}
										onToggleSelect={onToggleSelect}
										selected={selectedIds.includes(node.id)}
									/>
								))}
						</ul>
					)}
				</nav>
				<div>
					{versionNumber !== null && version.data ? (
						<div
							aria-hidden
							className="overflow-hidden rounded-none border border-input"
							style={{
								transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
								transformOrigin: "center center",
							}}
						>
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
						</div>
					) : null}
					{selectedNode ? (
						<section aria-label={SCREENS_COPY.inspect} className="mt-4">
							<h3 className="font-medium text-sm">{SCREENS_COPY.inspect}</h3>
							<p className="mt-2 text-sm">
								{selectedNode.label ?? selectedNode.kind}
							</p>
							{selectedNode.text?.status === "broken" ? (
								<p>{SCREENS_COPY.broken}</p>
							) : null}
							{selectedNode.openHref ? (
								<a className="text-sm underline" href={selectedNode.openHref}>
									{selectedNode.openSourceRecord}
								</a>
							) : null}
						</section>
					) : null}
				</div>
			</div>
		</div>
	);
}

function applyWireframeKey(
	event: KeyboardEvent<HTMLElement>,
	input: {
		hasSelection: boolean;
		multiSelect: boolean;
		viewport: { centerX: number; centerY: number; zoom: number };
	}
):
	| { deltaX: number; deltaY: number; kind: "nudge" }
	| { kind: "align" }
	| {
			kind: "viewport";
			viewport: { centerX: number; centerY: number; zoom: number };
	  }
	| null {
	const delta = arrowDelta(event.key);
	if (event.shiftKey && input.hasSelection && delta) {
		return { deltaX: delta.x * 8, deltaY: delta.y * 8, kind: "nudge" };
	}
	if (delta) {
		return {
			kind: "viewport",
			viewport: {
				centerX: input.viewport.centerX + delta.x * 24,
				centerY: input.viewport.centerY + delta.y * 24,
				zoom: input.viewport.zoom,
			},
		};
	}
	if (event.key === "+" || event.key === "=") {
		return {
			kind: "viewport",
			viewport: {
				...input.viewport,
				zoom: Math.min(8, input.viewport.zoom * 1.25),
			},
		};
	}
	if (event.key === "-" || event.key === "_") {
		return {
			kind: "viewport",
			viewport: {
				...input.viewport,
				zoom: Math.max(0.05, input.viewport.zoom / 1.25),
			},
		};
	}
	if (event.key.toLowerCase() === "a" && input.multiSelect) {
		return { kind: "align" };
	}
	return null;
}

function arrowDelta(key: string): { x: number; y: number } | null {
	if (key === "ArrowLeft") {
		return { x: -1, y: 0 };
	}
	if (key === "ArrowRight") {
		return { x: 1, y: 0 };
	}
	if (key === "ArrowUp") {
		return { x: 0, y: -1 };
	}
	if (key === "ArrowDown") {
		return { x: 0, y: 1 };
	}
	return null;
}

function OutlineGroupRow({
	collapsed,
	id,
	nodes,
	onDetach,
	onMove,
	onToggleCollapse,
	onToggleSelect,
	selectedIds,
	title,
}: {
	collapsed: boolean;
	id: string;
	nodes: OutlineNode[];
	onDetach: (nodeId: string) => void;
	onMove: (nodeId: string, direction: -1 | 1) => void;
	onToggleCollapse: (groupId: string) => void;
	onToggleSelect: (nodeId: string) => void;
	selectedIds: string[];
	title: string;
}) {
	const onCollapse = useCallback(() => {
		onToggleCollapse(id);
	}, [id, onToggleCollapse]);
	return (
		<li>
			<div className="flex items-center gap-2">
				<span className="font-medium text-sm">{title}</span>
				<Button onClick={onCollapse} size="sm" type="button" variant="ghost">
					{collapsed ? SCREENS_COPY.expandGroup : SCREENS_COPY.collapseGroup}
				</Button>
			</div>
			{collapsed ? null : (
				<ul className="mt-2 flex flex-col gap-2 pl-3">
					{nodes.map((node) => (
						<OutlineNodeRow
							key={node.id}
							node={node}
							onDetach={onDetach}
							onMove={onMove}
							onToggleSelect={onToggleSelect}
							selected={selectedIds.includes(node.id)}
						/>
					))}
				</ul>
			)}
		</li>
	);
}

function OutlineNodeRow({
	node,
	onDetach,
	onMove,
	onToggleSelect,
	selected,
}: {
	node: OutlineNode;
	onDetach: (nodeId: string) => void;
	onMove: (nodeId: string, direction: -1 | 1) => void;
	onToggleSelect: (nodeId: string) => void;
	selected: boolean;
}) {
	const onSelect = useCallback(() => {
		onToggleSelect(node.id);
	}, [node.id, onToggleSelect]);
	const onUp = useCallback(() => {
		onMove(node.id, -1);
	}, [node.id, onMove]);
	const onDown = useCallback(() => {
		onMove(node.id, 1);
	}, [node.id, onMove]);
	const onUnbind = useCallback(() => {
		onDetach(node.id);
	}, [node.id, onDetach]);

	return (
		<li className="rounded-none border border-input px-2.5 py-2 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					aria-pressed={selected}
					onClick={onSelect}
					size="sm"
					type="button"
					variant={selected ? "secondary" : "outline"}
				>
					{node.label ?? node.kind}
				</Button>
				<Button onClick={onUp} size="sm" type="button" variant="ghost">
					{SCREENS_COPY.moveUp}
				</Button>
				<Button onClick={onDown} size="sm" type="button" variant="ghost">
					{SCREENS_COPY.moveDown}
				</Button>
				{node.linkedBlockId ? (
					<Button onClick={onUnbind} size="sm" type="button" variant="outline">
						{SCREENS_COPY.detachLink}
					</Button>
				) : null}
				{node.openHref ? (
					<a className="text-sm underline" href={node.openHref}>
						{node.openSourceRecord}
					</a>
				) : null}
			</div>
		</li>
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
	if (versionNumber !== null) {
		await queryClient.invalidateQueries({
			queryKey: orpc.screensAndWireframes.getVersion.queryKey({
				input: { overlayCurrent: true, screenId, versionNumber },
			}),
		});
	}
	await queryClient.invalidateQueries({
		queryKey: orpc.screensAndWireframes.getViewport.queryKey({
			input: { screenId },
		}),
	});
}
