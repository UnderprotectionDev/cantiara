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

export interface UserFlowCanvasProps {
	nodes: CanvasNode[];
	onAlign: (nodeIds: string[]) => void;
	onDuplicate: (nodeIds: string[]) => void;
	onGrid: (nodeIds: string[]) => void;
	onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
	onUndo: () => void;
	onZOrder: (nodeIds: string[]) => void;
}

function nodeLabel(node: CanvasNode): string {
	if (node.kind === USER_FLOW_COPY.screen) {
		return node.screenTitle ?? USER_FLOW_COPY.screen;
	}
	return node.label || node.kind;
}

function toFlowNodes(nodes: CanvasNode[]): Node[] {
	return nodes.map((node) => ({
		data: { kind: node.kind, label: nodeLabel(node) },
		id: node.id,
		position: { x: node.layout.x, y: node.layout.y },
		style: {
			opacity: node.visualStyle?.emphasis === "muted" ? 0.65 : 1,
			zIndex: node.layout.z,
		},
		zIndex: node.layout.z,
	}));
}

function handleCanvasKey(
	event: KeyboardEvent<HTMLDivElement>,
	input: {
		onDuplicate: (nodeIds: string[]) => void;
		onGrid: (nodeIds: string[]) => void;
		onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
		onUndo: () => void;
		onZOrder: (nodeIds: string[]) => void;
		selectedIds: string[];
	}
): void {
	const arrows: Record<string, [number, number]> = {
		ArrowDown: [0, 16],
		ArrowLeft: [-16, 0],
		ArrowRight: [16, 0],
		ArrowUp: [0, -16],
	};
	const delta = arrows[event.key];
	if (delta) {
		event.preventDefault();
		input.onMove(input.selectedIds, delta[0], delta[1]);
		return;
	}
	if (event.metaKey || event.ctrlKey) {
		if (event.key === "z") {
			event.preventDefault();
			input.onUndo();
		}
		if (event.key === "d" || event.key === "c" || event.key === "v") {
			event.preventDefault();
			input.onDuplicate(input.selectedIds);
		}
		return;
	}
	if (event.key === "g") {
		event.preventDefault();
		input.onGrid(input.selectedIds);
	}
	if (event.key === "]") {
		event.preventDefault();
		input.onZOrder(input.selectedIds);
	}
}

function CanvasInner({
	nodes,
	onAlign,
	onDuplicate,
	onGrid,
	onMove,
	onUndo,
	onZOrder,
}: UserFlowCanvasProps) {
	const { fitView } = useReactFlow();
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const flowNodes = useMemo(() => toFlowNodes(nodes), [nodes]);

	const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
		setSelectedIds(params.nodes.map((node) => node.id));
	}, []);

	const onNodeDragStop = useCallback(
		(_event: unknown, node: Node, dragged: Node[]) => {
			const moved = dragged.length > 0 ? dragged : [node];
			const ids = moved.map((item) => item.id);
			const origin = nodes.find((item) => item.id === node.id);
			if (!origin) {
				return;
			}
			onMove(
				ids,
				node.position.x - origin.layout.x,
				node.position.y - origin.layout.y
			);
		},
		[nodes, onMove]
	);

	const onFitView = useCallback(() => {
		fitView({
			nodes:
				selectedIds.length > 0 ? selectedIds.map((id) => ({ id })) : undefined,
			padding: 0.2,
		}).catch(() => undefined);
	}, [fitView, selectedIds]);

	const onAlignClick = useCallback(() => {
		onAlign(selectedIds);
	}, [onAlign, selectedIds]);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			handleCanvasKey(event, {
				onDuplicate,
				onGrid,
				onMove,
				onUndo,
				onZOrder,
				selectedIds,
			});
		},
		[onDuplicate, onGrid, onMove, onUndo, onZOrder, selectedIds]
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
