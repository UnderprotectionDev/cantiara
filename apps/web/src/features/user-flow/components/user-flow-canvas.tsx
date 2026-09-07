import { Button } from "@cantiara/ui/components/button";
import {
	Background,
	Controls,
	type Node,
	type NodeProps,
	type OnSelectionChangeParams,
	Panel,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import {
	flowCanvasColorMode,
	shouldFitViewAfterPlace,
	USER_FLOW_COPY,
} from "../forms/user-flow-copy";

import "@xyflow/react/dist/style.css";

interface CanvasNode {
	id: string;
	kind: string;
	label: string;
	layout: { x: number; y: number; z: number };
	screenTitle: string | null;
	visualStyle: { emphasis: string } | null;
}

interface CanvasLiveCard {
	id: string;
	layout: { x: number; y: number; z: number };
	recordKind: string;
	title: string;
}

export interface UserFlowCanvasProps {
	liveCards?: CanvasLiveCard[];
	nodes: CanvasNode[];
	onAlign: (nodeIds: string[]) => void;
	onDuplicate: (nodeIds: string[]) => void;
	onGrid: (nodeIds: string[]) => void;
	onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
	onMoveLiveCard?: (cardId: string, deltaX: number, deltaY: number) => void;
	onPersistViewport: (viewport: {
		centerX: number;
		centerY: number;
		zoom: number;
	}) => void;
	onSelectedIdsChange: (nodeIds: string[]) => void;
	onUndo: () => void;
	onZOrder: (nodeIds: string[]) => void;
	restored: {
		fitted: boolean;
		viewport: { centerX: number; centerY: number; zoom: number };
	} | null;
	selectedIds: string[];
}

const LIVE_CARD_PREFIX = "live:";

function liveCardCanvasId(cardId: string): string {
	return `${LIVE_CARD_PREFIX}${cardId}`;
}

function liveCardIdFromCanvas(id: string): string | null {
	if (!id.startsWith(LIVE_CARD_PREFIX)) {
		return null;
	}
	return id.slice(LIVE_CARD_PREFIX.length);
}

function nodeLabel(node: CanvasNode): string {
	if (node.kind === USER_FLOW_COPY.screen) {
		return node.screenTitle ?? USER_FLOW_COPY.screen;
	}
	return node.label || node.kind;
}

function toFlowNodes(
	nodes: CanvasNode[],
	liveCards: CanvasLiveCard[],
	selectedIds: string[]
): Node[] {
	const selected = new Set(selectedIds);
	const flowNodes = nodes.map((node) => ({
		data: { kind: node.kind, label: nodeLabel(node) },
		id: node.id,
		position: { x: node.layout.x, y: node.layout.y },
		selected: selected.has(node.id),
		style: {
			opacity: node.visualStyle?.emphasis === "muted" ? 0.65 : 1,
		},
		type: "flowStep",
		zIndex: node.layout.z,
	}));
	const cards = liveCards.map((card) => {
		const id = liveCardCanvasId(card.id);
		return {
			data: {
				kind: card.recordKind,
				label: `${card.recordKind} · ${card.title}`,
			},
			id,
			position: { x: card.layout.x, y: card.layout.y },
			selected: selected.has(id),
			type: "flowStep",
			zIndex: card.layout.z,
		};
	});
	return [...flowNodes, ...cards];
}

function partitionSelection(ids: string[]): {
	liveCardIds: string[];
	nodeIds: string[];
} {
	const liveCardIds: string[] = [];
	const nodeIds: string[] = [];
	for (const id of ids) {
		const cardId = liveCardIdFromCanvas(id);
		if (cardId) {
			liveCardIds.push(cardId);
			continue;
		}
		nodeIds.push(id);
	}
	return { liveCardIds, nodeIds };
}

function applyArrowMove(
	delta: [number, number],
	input: {
		liveCardIds: string[];
		nodeIds: string[];
		onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
		onMoveLiveCard?: (cardId: string, deltaX: number, deltaY: number) => void;
	}
): void {
	if (input.nodeIds.length > 0) {
		input.onMove(input.nodeIds, delta[0], delta[1]);
		return;
	}
	const [cardId] = input.liveCardIds;
	if (cardId) {
		input.onMoveLiveCard?.(cardId, delta[0], delta[1]);
	}
}

function canvasKeyboardCommand(
	key: string,
	selectedIds: readonly string[]
):
	| { deltaX: number; deltaY: number; type: "move" | "pan" }
	| { factor: number; type: "zoom" }
	| { type: "select-all" }
	| null {
	if (key === "=" || key === "+") {
		return { factor: 2, type: "zoom" };
	}
	if (key === "-" || key === "_") {
		return { factor: 0.5, type: "zoom" };
	}
	if (key === "a" || key === "A") {
		return { type: "select-all" };
	}
	const arrows: Record<string, [number, number]> = {
		ArrowDown: [0, 16],
		ArrowLeft: [-16, 0],
		ArrowRight: [16, 0],
		ArrowUp: [0, -16],
	};
	const delta = arrows[key];
	if (!delta) {
		return null;
	}
	if (selectedIds.length > 0) {
		return { deltaX: delta[0], deltaY: delta[1], type: "move" };
	}
	return { deltaX: delta[0], deltaY: delta[1], type: "pan" };
}

function handleModifierCanvasKey(
	event: KeyboardEvent<HTMLDivElement>,
	input: {
		nodeIds: string[];
		onDuplicate: (nodeIds: string[]) => void;
		onSelectAll: () => void;
		onUndo: () => void;
	}
): void {
	if (event.key === "z") {
		event.preventDefault();
		input.onUndo();
	}
	if (event.key === "d" || event.key === "c" || event.key === "v") {
		event.preventDefault();
		if (input.nodeIds.length > 0) {
			input.onDuplicate(input.nodeIds);
		}
	}
	if (event.key === "a") {
		event.preventDefault();
		input.onSelectAll();
	}
}

function handleCanvasKey(
	event: KeyboardEvent<HTMLDivElement>,
	input: {
		nodeIds: string[];
		onDuplicate: (nodeIds: string[]) => void;
		onGrid: (nodeIds: string[]) => void;
		onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
		onMoveLiveCard?: (cardId: string, deltaX: number, deltaY: number) => void;
		onPan: (deltaX: number, deltaY: number) => void;
		onSelectAll: () => void;
		onUndo: () => void;
		onZoom: (factor: number) => void;
		onZOrder: (nodeIds: string[]) => void;
		selectedIds: string[];
	}
): void {
	const { liveCardIds, nodeIds } = partitionSelection(input.selectedIds);
	if (event.metaKey || event.ctrlKey) {
		handleModifierCanvasKey(event, {
			nodeIds,
			onDuplicate: input.onDuplicate,
			onSelectAll: input.onSelectAll,
			onUndo: input.onUndo,
		});
		return;
	}
	const command = canvasKeyboardCommand(event.key, input.selectedIds);
	if (command?.type === "move") {
		event.preventDefault();
		applyArrowMove([command.deltaX, command.deltaY], {
			liveCardIds,
			nodeIds,
			onMove: input.onMove,
			onMoveLiveCard: input.onMoveLiveCard,
		});
		return;
	}
	if (command?.type === "pan") {
		event.preventDefault();
		input.onPan(command.deltaX, command.deltaY);
		return;
	}
	if (command?.type === "zoom") {
		event.preventDefault();
		input.onZoom(command.factor);
		return;
	}
	if (command?.type === "select-all") {
		event.preventDefault();
		input.onSelectAll();
		return;
	}
	if (event.key === "g" && nodeIds.length > 0) {
		event.preventDefault();
		input.onGrid(nodeIds);
	}
	if (event.key === "]" && nodeIds.length > 0) {
		event.preventDefault();
		input.onZOrder(nodeIds);
	}
}

function FlowStepNode({ data, selected }: NodeProps) {
	const kind = typeof data.kind === "string" ? data.kind : "";
	const label = typeof data.label === "string" ? data.label : "";
	return (
		<div
			className={
				selected
					? "min-w-32 max-w-56 rounded-md border border-ring bg-card px-3 py-2 text-card-foreground shadow-sm"
					: "min-w-32 max-w-56 rounded-md border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
			}
		>
			<p className="text-[10px] text-muted-foreground">{kind}</p>
			<p className="truncate font-medium text-sm">{label}</p>
		</div>
	);
}

const FLOW_NODE_TYPES = {
	flowStep: FlowStepNode,
};

function CanvasInner({
	liveCards = [],
	nodes,
	onAlign,
	onDuplicate,
	onGrid,
	onMove,
	onMoveLiveCard,
	onPersistViewport,
	onSelectedIdsChange,
	onUndo,
	onZOrder,
	restored,
	selectedIds,
}: UserFlowCanvasProps) {
	const { resolvedTheme } = useTheme();
	const { fitView, getViewport, setViewport, zoomIn, zoomOut } = useReactFlow();
	const skipPersist = useRef(true);
	const previousContentCount = useRef(0);
	const flowNodes = useMemo(
		() => toFlowNodes(nodes, liveCards, selectedIds),
		[liveCards, nodes, selectedIds]
	);

	useEffect(() => {
		if (!restored) {
			return;
		}
		skipPersist.current = true;
		if (restored.fitted) {
			if (nodes.length === 0 && liveCards.length === 0) {
				return;
			}
			fitView({ padding: 0.2 }).catch(() => undefined);
			return;
		}
		setViewport({
			x: restored.viewport.centerX,
			y: restored.viewport.centerY,
			zoom: restored.viewport.zoom,
		});
	}, [fitView, liveCards.length, nodes.length, restored, setViewport]);

	useEffect(() => {
		const nextCount = flowNodes.length;
		if (shouldFitViewAfterPlace(previousContentCount.current, nextCount)) {
			skipPersist.current = true;
			fitView({ padding: 0.2 }).catch(() => undefined);
		}
		previousContentCount.current = nextCount;
	}, [fitView, flowNodes.length]);

	const persistNow = useCallback(() => {
		const viewport = getViewport();
		onPersistViewport({
			centerX: viewport.x,
			centerY: viewport.y,
			zoom: viewport.zoom,
		});
	}, [getViewport, onPersistViewport]);

	const onSelectionChange = useCallback(
		(params: OnSelectionChangeParams) => {
			onSelectedIdsChange(params.nodes.map((node) => node.id));
		},
		[onSelectedIdsChange]
	);

	const onNodeDragStop = useCallback(
		(_event: unknown, node: Node, dragged: Node[]) => {
			const moved = dragged.length > 0 ? dragged : [node];
			const cardId = liveCardIdFromCanvas(node.id);
			if (cardId) {
				const origin = liveCards.find((item) => item.id === cardId);
				if (!origin) {
					return;
				}
				onMoveLiveCard?.(
					cardId,
					node.position.x - origin.layout.x,
					node.position.y - origin.layout.y
				);
				return;
			}
			const ids = partitionSelection(moved.map((item) => item.id)).nodeIds;
			const origin = nodes.find((item) => item.id === node.id);
			if (!origin || ids.length === 0) {
				return;
			}
			onMove(
				ids,
				node.position.x - origin.layout.x,
				node.position.y - origin.layout.y
			);
		},
		[liveCards, nodes, onMove, onMoveLiveCard]
	);

	const onFitView = useCallback(() => {
		if (flowNodes.length === 0) {
			return;
		}
		skipPersist.current = true;
		fitView({
			nodes:
				selectedIds.length > 0 ? selectedIds.map((id) => ({ id })) : undefined,
			padding: 0.2,
		})
			.then(() => {
				const viewport = getViewport();
				onPersistViewport({
					centerX: viewport.x,
					centerY: viewport.y,
					zoom: viewport.zoom,
				});
			})
			.catch(() => undefined);
	}, [fitView, flowNodes.length, getViewport, onPersistViewport, selectedIds]);

	const onAlignClick = useCallback(() => {
		onAlign(partitionSelection(selectedIds).nodeIds);
	}, [onAlign, selectedIds]);

	const onPan = useCallback(
		(deltaX: number, deltaY: number) => {
			const viewport = getViewport();
			setViewport({
				x: viewport.x + deltaX,
				y: viewport.y + deltaY,
				zoom: viewport.zoom,
			});
			onPersistViewport({
				centerX: viewport.x + deltaX,
				centerY: viewport.y + deltaY,
				zoom: viewport.zoom,
			});
		},
		[getViewport, onPersistViewport, setViewport]
	);

	const onZoom = useCallback(
		(factor: number) => {
			if (factor > 1) {
				zoomIn().catch(() => undefined);
			} else {
				zoomOut().catch(() => undefined);
			}
			persistNow();
		},
		[persistNow, zoomIn, zoomOut]
	);

	const onSelectAll = useCallback(() => {
		onSelectedIdsChange(nodes.map((node) => node.id));
	}, [nodes, onSelectedIdsChange]);

	const onMoveEnd = useCallback(() => {
		if (skipPersist.current) {
			skipPersist.current = false;
			return;
		}
		persistNow();
	}, [persistNow]);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			handleCanvasKey(event, {
				nodeIds: nodes.map((node) => node.id),
				onDuplicate,
				onGrid,
				onMove,
				onMoveLiveCard,
				onPan,
				onSelectAll,
				onUndo,
				onZOrder,
				onZoom,
				selectedIds,
			});
		},
		[
			nodes,
			onDuplicate,
			onGrid,
			onMove,
			onMoveLiveCard,
			onPan,
			onSelectAll,
			onUndo,
			onZoom,
			onZOrder,
			selectedIds,
		]
	);

	const flowSelectedIds = partitionSelection(selectedIds).nodeIds;

	return (
		<div className="relative h-[min(70vh,40rem)] min-h-[28rem] min-w-0 overflow-hidden rounded-md border bg-muted/20">
			<ReactFlow
				aria-label={USER_FLOW_COPY.userFlow}
				className="h-full min-h-[28rem] w-full"
				colorMode={flowCanvasColorMode(resolvedTheme)}
				elementsSelectable
				fitView={false}
				maxZoom={2}
				minZoom={0.25}
				multiSelectionKeyCode="Shift"
				nodes={flowNodes}
				nodesConnectable={false}
				nodeTypes={FLOW_NODE_TYPES}
				onKeyDown={onKeyDown}
				onMoveEnd={onMoveEnd}
				onNodeDragStop={onNodeDragStop}
				onSelectionChange={onSelectionChange}
				panOnScroll
				proOptions={{ hideAttribution: true }}
				style={{ height: "100%", width: "100%" }}
			>
				<Background gap={16} />
				<Controls
					className="!border-border !bg-card !shadow-none [&>button]:!border-border [&>button]:!bg-card [&>button]:!fill-foreground"
					showFitView={false}
					showInteractive={false}
				/>
				<Panel position="top-right">
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={flowNodes.length === 0}
							onClick={onFitView}
							type="button"
							variant="outline"
						>
							{USER_FLOW_COPY.fitView}
						</Button>
						<Button
							disabled={flowSelectedIds.length === 0}
							onClick={onAlignClick}
							type="button"
							variant="outline"
						>
							{USER_FLOW_COPY.align}
						</Button>
						<Button onClick={onUndo} type="button" variant="outline">
							{USER_FLOW_COPY.undo}
						</Button>
					</div>
				</Panel>
			</ReactFlow>
			{flowNodes.length === 0 ? (
				<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
					<p className="rounded-md border border-border bg-background/95 px-3 py-2 text-center text-muted-foreground text-sm">
						{USER_FLOW_COPY.placeNode}
					</p>
				</div>
			) : null}
		</div>
	);
}

export default function UserFlowCanvas(props: UserFlowCanvasProps) {
	return (
		<ReactFlowProvider>
			<CanvasInner {...props} />
		</ReactFlowProvider>
	);
}
