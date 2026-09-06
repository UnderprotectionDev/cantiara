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
}

export interface UserFlowCanvasProps {
	nodes: CanvasNode[];
	onAlign: (nodeIds: string[]) => void;
	onDuplicate: (nodeIds: string[]) => void;
	onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
	onUndo: () => void;
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
		style: { zIndex: node.layout.z },
		zIndex: node.layout.z,
	}));
}

function CanvasInner({
	nodes,
	onAlign,
	onDuplicate,
	onMove,
	onUndo,
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
		fitView({ padding: 0.2 }).catch(() => undefined);
	}, [fitView]);

	const onAlignClick = useCallback(() => {
		onAlign(selectedIds);
	}, [onAlign, selectedIds]);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				onMove(selectedIds, -16, 0);
			}
			if (event.key === "ArrowRight") {
				event.preventDefault();
				onMove(selectedIds, 16, 0);
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				onMove(selectedIds, 0, -16);
			}
			if (event.key === "ArrowDown") {
				event.preventDefault();
				onMove(selectedIds, 0, 16);
			}
			if ((event.metaKey || event.ctrlKey) && event.key === "z") {
				event.preventDefault();
				onUndo();
			}
			if ((event.metaKey || event.ctrlKey) && event.key === "d") {
				event.preventDefault();
				onDuplicate(selectedIds);
			}
		},
		[onDuplicate, onMove, onUndo, selectedIds]
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
