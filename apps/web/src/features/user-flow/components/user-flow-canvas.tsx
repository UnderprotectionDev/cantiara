import { Button } from "@cantiara/ui/components/button";
import {
	Background,
	Controls,
	type Node,
	type OnSelectionChangeParams,
	Panel,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
} from "@xyflow/react";
import type { KeyboardEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { USER_FLOW_COPY } from "../forms/user-flow-copy";

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
	onUndo: () => void;
	onZOrder: (nodeIds: string[]) => void;
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

function toFlowNodes(nodes: CanvasNode[], liveCards: CanvasLiveCard[]): Node[] {
	const flowNodes = nodes.map((node) => ({
		data: { kind: node.kind, label: nodeLabel(node) },
		id: node.id,
		position: { x: node.layout.x, y: node.layout.y },
		style: {
			opacity: node.visualStyle?.emphasis === "muted" ? 0.65 : 1,
			zIndex: node.layout.z,
		},
		zIndex: node.layout.z,
	}));
	const cards = liveCards.map((card) => ({
		data: {
			kind: card.recordKind,
			label: `${card.recordKind} · ${card.title}`,
		},
		id: liveCardCanvasId(card.id),
		position: { x: card.layout.x, y: card.layout.y },
		style: { zIndex: card.layout.z },
		zIndex: card.layout.z,
	}));
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

function handleCanvasKey(
	event: KeyboardEvent<HTMLDivElement>,
	input: {
		onDuplicate: (nodeIds: string[]) => void;
		onGrid: (nodeIds: string[]) => void;
		onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
		onMoveLiveCard?: (cardId: string, deltaX: number, deltaY: number) => void;
		onUndo: () => void;
		onZOrder: (nodeIds: string[]) => void;
		selectedIds: string[];
	}
): void {
	const { liveCardIds, nodeIds } = partitionSelection(input.selectedIds);
	const arrows: Record<string, [number, number]> = {
		ArrowDown: [0, 16],
		ArrowLeft: [-16, 0],
		ArrowRight: [16, 0],
		ArrowUp: [0, -16],
	};
	const delta = arrows[event.key];
	if (delta) {
		event.preventDefault();
		applyArrowMove(delta, {
			liveCardIds,
			nodeIds,
			onMove: input.onMove,
			onMoveLiveCard: input.onMoveLiveCard,
		});
		return;
	}
	if (event.metaKey || event.ctrlKey) {
		if (event.key === "z") {
			event.preventDefault();
			input.onUndo();
		}
		if (event.key === "d" || event.key === "c" || event.key === "v") {
			event.preventDefault();
			if (nodeIds.length > 0) {
				input.onDuplicate(nodeIds);
			}
		}
		return;
	}
	if (event.key === "g") {
		event.preventDefault();
		if (nodeIds.length > 0) {
			input.onGrid(nodeIds);
		}
	}
	if (event.key === "]") {
		event.preventDefault();
		if (nodeIds.length > 0) {
			input.onZOrder(nodeIds);
		}
	}
}

function CanvasInner({
	liveCards = [],
	nodes,
	onAlign,
	onDuplicate,
	onGrid,
	onMove,
	onMoveLiveCard,
	onUndo,
	onZOrder,
}: UserFlowCanvasProps) {
	const { fitView } = useReactFlow();
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const flowNodes = useMemo(
		() => toFlowNodes(nodes, liveCards),
		[liveCards, nodes]
	);

	const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
		setSelectedIds(params.nodes.map((node) => node.id));
	}, []);

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
		fitView({
			nodes:
				selectedIds.length > 0 ? selectedIds.map((id) => ({ id })) : undefined,
			padding: 0.2,
		}).catch(() => undefined);
	}, [fitView, selectedIds]);

	const onAlignClick = useCallback(() => {
		onAlign(partitionSelection(selectedIds).nodeIds);
	}, [onAlign, selectedIds]);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			handleCanvasKey(event, {
				onDuplicate,
				onGrid,
				onMove,
				onMoveLiveCard,
				onUndo,
				onZOrder,
				selectedIds,
			});
		},
		[onDuplicate, onGrid, onMove, onMoveLiveCard, onUndo, onZOrder, selectedIds]
	);

	return (
		<div className="h-[28rem] rounded-md border">
			<ReactFlow
				aria-label={USER_FLOW_COPY.userFlow}
				fitView
				multiSelectionKeyCode="Shift"
				nodes={flowNodes}
				onKeyDown={onKeyDown}
				onNodeDragStop={onNodeDragStop}
				onSelectionChange={onSelectionChange}
				proOptions={{ hideAttribution: true }}
			>
				<Background gap={16} />
				<Controls showFitView={false} />
				<Panel position="top-left">
					<div className="flex flex-wrap gap-2">
						<Button onClick={onFitView} type="button" variant="outline">
							{USER_FLOW_COPY.fitView}
						</Button>
						<Button onClick={onAlignClick} type="button" variant="outline">
							{USER_FLOW_COPY.align}
						</Button>
						<Button onClick={onUndo} type="button" variant="outline">
							{USER_FLOW_COPY.undo}
						</Button>
					</div>
				</Panel>
			</ReactFlow>
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
