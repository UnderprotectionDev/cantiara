import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import UserFlowCanvas from "../components/user-flow-canvas";
import ConvertAndBindForm from "../forms/convert-and-bind-form";
import CreateScreenForm from "../forms/create-screen-form";
import PlaceLiveCardForm from "../forms/place-live-card-form";
import RebindOriginForm from "../forms/rebind-origin-form";
import SaveUserFlowTemplateForm from "../forms/save-user-flow-template-form";
import { FLOW_NODE_KINDS, USER_FLOW_COPY } from "../forms/user-flow-copy";

interface PresentedNode {
	boundAt: string | null;
	groupId: string | null;
	id: string;
	kind: string;
	label: string;
	layout: { x: number; y: number; z: number };
	openHref: string | null;
	openSourceRecord: string | null;
	pathText: {
		condition: string;
		decision: string;
		description: string;
		transition: string;
	};
	preview: string | null;
	reason: string | null;
	resolution: string;
	screenId: string | null;
	screenTitle: string | null;
	visualStyle: { emphasis: string } | null;
}

interface FlowGroup {
	id: string;
	title: string;
}

interface PresentedLiveCard {
	id: string;
	layout: { x: number; y: number; z: number };
	recordId: string;
	recordKind: string;
	status: string | null;
	title: string;
}

interface PresentedOriginRelation {
	id: string;
	nodeId: string | null;
	recordId: string;
	recordKind: string;
	sourceVersion: string | null;
	type: string;
}

interface UserFlowDetailView {
	copy: {
		archived: string;
		convertAndBind: string;
		fitView: string;
		group: string;
		inspect: string;
		openSourceRecord: string;
		outline: string;
		promoteToScreen: string;
		unbind: string;
		userFlow: string;
	};
	groups: readonly FlowGroup[];
	id: string;
	liveCards: PresentedLiveCard[];
	nodes: PresentedNode[];
	originRelations: PresentedOriginRelation[];
	revision: number;
	title: string;
}

export default function UserFlowDetail({
	flowId,
	projectId,
}: {
	flowId: string;
	projectId: string;
}) {
	const flow = useQuery(
		orpc.userFlow.get.queryOptions({ input: { userFlowId: flowId } })
	);
	const viewport = useQuery(
		orpc.userFlow.getViewport.queryOptions({ input: { userFlowId: flowId } })
	);
	const screens = useQuery(
		orpc.userFlow.listScreens.queryOptions({ input: { projectId } })
	);
	const [description, setDescription] = useState("");
	const [kind, setKind] = useState<(typeof FLOW_NODE_KINDS)[number]>(
		USER_FLOW_COPY.screen
	);
	const [label, setLabel] = useState("");
	const [screenId, setScreenId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.userFlow.get.queryKey({
				input: { userFlowId: flowId },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.userFlow.getViewport.queryKey({
				input: { userFlowId: flowId },
			}),
		});
	}, [flowId]);

	const onOutcome = useCallback(
		async (outcome: { status: string; reason?: string }) => {
			if (outcome.status === "committed" || outcome.status === "replayed") {
				await invalidate();
				setDescription("");
				setLabel("");
				setError(null);
				return;
			}
			if (outcome.status === "rejected" && outcome.reason) {
				setError(outcome.reason);
			}
		},
		[invalidate]
	);

	const place = useMutation(
		orpc.userFlow.placeFlowNode.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const editorOp = useMutation(
		orpc.userFlow.applyEditorOp.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const reorder = useMutation(
		orpc.userFlow.reorderOutline.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const group = useMutation(
		orpc.userFlow.groupOutline.mutationOptions({
			onSuccess: async (outcome) => {
				await onOutcome(outcome);
				if (outcome.status === "committed" || outcome.status === "replayed") {
					setSelectedIds([]);
				}
			},
		})
	);
	const bindScreen = useMutation(
		orpc.userFlow.bindOutlineScreen.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const unbindScreen = useMutation(
		orpc.userFlow.unbindOutlineScreen.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const saveViewport = useMutation(
		orpc.userFlow.saveViewport.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.userFlow.getViewport.queryKey({
						input: { userFlowId: flowId },
					}),
				});
			},
		})
	);
	const moveLive = useMutation(
		orpc.userFlow.moveLiveCard.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const promote = useMutation(
		orpc.userFlow.promoteStepToScreen.mutationOptions({
			onSuccess: onOutcome,
		})
	);

	const onPlace = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!flow.data) {
				return;
			}
			if (kind === USER_FLOW_COPY.screen && !screenId) {
				return;
			}
			place.mutate({
				baseRevision: flow.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					kind,
					label,
					pathText: {
						condition: "",
						decision: "",
						description,
						transition: "",
					},
					screenId: kind === USER_FLOW_COPY.screen ? screenId : undefined,
					userFlowId: flowId,
				},
			});
		},
		[description, flow.data, flowId, kind, label, place, screenId]
	);

	const runOp = useCallback(
		(payload: {
			axis?: "left";
			deltaX?: number;
			deltaY?: number;
			nodeIds?: string[];
			op: "align" | "move" | "duplicate" | "undo" | "grid" | "z-order";
			direction?: "front";
		}) => {
			if (!flow.data) {
				return;
			}
			editorOp.mutate({
				baseRevision: flow.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					...payload,
					userFlowId: flowId,
				},
			});
		},
		[editorOp, flow.data, flowId]
	);

	const onAlign = useCallback(
		(nodeIds: string[]) => {
			runOp({ axis: "left", nodeIds, op: "align" });
		},
		[runOp]
	);
	const onDuplicate = useCallback(
		(nodeIds: string[]) => {
			runOp({ nodeIds, op: "duplicate" });
		},
		[runOp]
	);
	const onMove = useCallback(
		(nodeIds: string[], deltaX: number, deltaY: number) => {
			runOp({ deltaX, deltaY, nodeIds, op: "move" });
		},
		[runOp]
	);
	const onUndo = useCallback(() => {
		runOp({ op: "undo" });
	}, [runOp]);
	const onGrid = useCallback(
		(nodeIds: string[]) => {
			runOp({ nodeIds, op: "grid" });
		},
		[runOp]
	);
	const onZOrder = useCallback(
		(nodeIds: string[]) => {
			runOp({ direction: "front", nodeIds, op: "z-order" });
		},
		[runOp]
	);
	const onPromote = useCallback(
		(nodeId: string) => {
			if (!flow.data) {
				return;
			}
			promote.mutate({
				baseRevision: flow.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { nodeId, userFlowId: flowId },
			});
		},
		[flow.data, flowId, promote]
	);
	const onMoveLiveCard = useCallback(
		(cardId: string, deltaX: number, deltaY: number) => {
			if (!flow.data) {
				return;
			}
			moveLive.mutate({
				baseRevision: flow.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { cardId, deltaX, deltaY, userFlowId: flowId },
			});
		},
		[flow.data, flowId, moveLive]
	);

	const collapsedIds = viewport.data?.viewport.collapsedGroupIds ?? [];

	const onPersistViewport = useCallback(
		(next: { centerX: number; centerY: number; zoom: number }) => {
			saveViewport.mutate({
				payload: {
					userFlowId: flowId,
					viewport: {
						...next,
						collapsedGroupIds: collapsedIds,
					},
				},
			});
		},
		[collapsedIds, flowId, saveViewport]
	);

	const onToggleCollapse = useCallback(
		(groupId: string) => {
			const next = collapsedIds.includes(groupId)
				? collapsedIds.filter((id) => id !== groupId)
				: [...collapsedIds, groupId];
			saveViewport.mutate({
				payload: {
					userFlowId: flowId,
					viewport: {
						centerX: viewport.data?.viewport.centerX ?? 0,
						centerY: viewport.data?.viewport.centerY ?? 0,
						collapsedGroupIds: next,
						zoom: viewport.data?.viewport.zoom ?? 1,
					},
				},
			});
		},
		[collapsedIds, flowId, saveViewport, viewport.data]
	);

	const onToggleSelect = useCallback((nodeId: string) => {
		setSelectedIds((current) =>
			current.includes(nodeId)
				? current.filter((id) => id !== nodeId)
				: [...current, nodeId]
		);
	}, []);

	const onOutlineMove = useCallback(
		(nodeId: string, direction: -1 | 1) => {
			if (!flow.data) {
				return;
			}
			const ids = flow.data.nodes.map((node) => node.id);
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
				baseRevision: flow.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { nodeIds: nextIds, userFlowId: flowId },
			});
		},
		[flow.data, flowId, reorder]
	);

	const onGroup = useCallback(() => {
		if (!flow.data) {
			return;
		}
		const nodeIds = selectedIds.filter((id) => !id.startsWith("live:"));
		if (nodeIds.length === 0) {
			return;
		}
		group.mutate({
			baseRevision: flow.data.revision,
			idempotencyKey: newIdempotencyKey(),
			payload: {
				nodeIds,
				title: USER_FLOW_COPY.group,
				userFlowId: flowId,
			},
		});
	}, [flow.data, flowId, group, selectedIds]);

	const onBind = useCallback(() => {
		const nodeIds = selectedIds.filter((id) => !id.startsWith("live:"));
		const [nodeId] = nodeIds;
		if (!(flow.data && screenId && nodeId) || nodeIds.length !== 1) {
			return;
		}
		bindScreen.mutate({
			baseRevision: flow.data.revision,
			idempotencyKey: newIdempotencyKey(),
			payload: { nodeId, screenId, userFlowId: flowId },
		});
	}, [bindScreen, flow.data, flowId, screenId, selectedIds]);

	const onUnbind = useCallback(() => {
		const nodeIds = selectedIds.filter((id) => !id.startsWith("live:"));
		const [nodeId] = nodeIds;
		if (!(flow.data && nodeId) || nodeIds.length !== 1) {
			return;
		}
		unbindScreen.mutate({
			baseRevision: flow.data.revision,
			idempotencyKey: newIdempotencyKey(),
			payload: { nodeId, userFlowId: flowId },
		});
	}, [flow.data, flowId, selectedIds, unbindScreen]);

	const onKindChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setKind(event.target.value as (typeof FLOW_NODE_KINDS)[number]);
	}, []);
	const onScreenChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setScreenId(event.target.value);
		},
		[]
	);
	const onDescriptionChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setDescription(event.target.value);
		},
		[]
	);
	const onLabelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setLabel(event.target.value);
	}, []);

	if (flow.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (flow.isError || !flow.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const view = flow.data as UserFlowDetailView;

	return (
		<article>
			<h2 className="font-semibold text-lg tracking-tight">{view.title}</h2>
			<p className="text-muted-foreground text-sm">{view.copy.userFlow}</p>
			<div className="mt-4">
				<CreateScreenForm projectId={projectId} />
			</div>
			<div className="mt-4">
				<SaveUserFlowTemplateForm userFlowId={flowId} />
			</div>
			<div className="mt-4">
				<PlaceLiveCardForm
					baseRevision={view.revision}
					onPlaced={invalidate}
					projectId={projectId}
					userFlowId={flowId}
				/>
			</div>
			<form className="mt-4 flex flex-col gap-3" onSubmit={onPlace}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="flow-node-kind">
							{USER_FLOW_COPY.placeNode}
						</FieldLabel>
						<NativeSelect
							id="flow-node-kind"
							onChange={onKindChange}
							value={kind}
						>
							{FLOW_NODE_KINDS.map((item) => (
								<NativeSelectOption key={item} value={item}>
									{item}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					{kind === USER_FLOW_COPY.screen ? (
						<Field>
							<FieldLabel htmlFor="bind-screen">
								{USER_FLOW_COPY.screen}
							</FieldLabel>
							<NativeSelect
								id="bind-screen"
								onChange={onScreenChange}
								value={screenId}
							>
								<NativeSelectOption value="">
									{USER_FLOW_COPY.screen}
								</NativeSelectOption>
								{(screens.data ?? []).map((screen) => (
									<NativeSelectOption key={screen.id} value={screen.id}>
										{screen.title}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					) : (
						<Field>
							<FieldLabel htmlFor="node-label">{kind}</FieldLabel>
							<Input id="node-label" onChange={onLabelChange} value={label} />
						</Field>
					)}
					<Field>
						<FieldLabel htmlFor="node-description">
							{USER_FLOW_COPY.description}
						</FieldLabel>
						<Input
							id="node-description"
							onChange={onDescriptionChange}
							value={description}
						/>
					</Field>
				</FieldGroup>
				{error ? <p role="alert">{error}</p> : null}
				<Button type="submit">
					{kind === USER_FLOW_COPY.screen
						? USER_FLOW_COPY.bindScreen
						: USER_FLOW_COPY.placeNode}
				</Button>
			</form>
			<UserFlowSurface
				canBind={Boolean(screenId)}
				collapsedIds={collapsedIds}
				flowId={flowId}
				onAlign={onAlign}
				onBind={onBind}
				onDuplicate={onDuplicate}
				onGrid={onGrid}
				onGroup={onGroup}
				onInvalidate={invalidate}
				onMove={onMove}
				onMoveLiveCard={onMoveLiveCard}
				onOutlineMove={onOutlineMove}
				onPersistViewport={onPersistViewport}
				onPromote={onPromote}
				onSelectedIdsChange={setSelectedIds}
				onToggleCollapse={onToggleCollapse}
				onToggleSelect={onToggleSelect}
				onUnbind={onUnbind}
				onUndo={onUndo}
				onZOrder={onZOrder}
				restored={viewport.data ?? null}
				selectedIds={selectedIds}
				view={view}
			/>
		</article>
	);
}

function UserFlowSurface({
	canBind,
	collapsedIds,
	flowId,
	onAlign,
	onBind,
	onDuplicate,
	onGrid,
	onGroup,
	onInvalidate,
	onMove,
	onMoveLiveCard,
	onOutlineMove,
	onPersistViewport,
	onPromote,
	onSelectedIdsChange,
	onToggleCollapse,
	onToggleSelect,
	onUnbind,
	onUndo,
	onZOrder,
	restored,
	selectedIds,
	view,
}: {
	canBind: boolean;
	collapsedIds: string[];
	flowId: string;
	onAlign: (nodeIds: string[]) => void;
	onBind: () => void;
	onDuplicate: (nodeIds: string[]) => void;
	onGrid: (nodeIds: string[]) => void;
	onGroup: () => void;
	onInvalidate: () => Promise<void>;
	onMove: (nodeIds: string[], deltaX: number, deltaY: number) => void;
	onMoveLiveCard: (cardId: string, deltaX: number, deltaY: number) => void;
	onOutlineMove: (nodeId: string, direction: -1 | 1) => void;
	onPersistViewport: (viewport: {
		centerX: number;
		centerY: number;
		zoom: number;
	}) => void;
	onPromote: (nodeId: string) => void;
	onSelectedIdsChange: (nodeIds: string[]) => void;
	onToggleCollapse: (groupId: string) => void;
	onToggleSelect: (nodeId: string) => void;
	onUnbind: () => void;
	onUndo: () => void;
	onZOrder: (nodeIds: string[]) => void;
	restored: {
		fitted: boolean;
		viewport: { centerX: number; centerY: number; zoom: number };
	} | null;
	selectedIds: string[];
	view: UserFlowDetailView;
}) {
	const flowSelectedIds = selectedIds.filter((id) => !id.startsWith("live:"));
	const [selectedId] = flowSelectedIds;
	const selectedNode =
		flowSelectedIds.length === 1
			? (view.nodes.find((node) => node.id === selectedId) ?? null)
			: null;
	return (
		<>
			<div className="mt-4 flex flex-wrap gap-2">
				<Button
					disabled={flowSelectedIds.length === 0}
					onClick={onGroup}
					type="button"
					variant="outline"
				>
					{USER_FLOW_COPY.group}
				</Button>
				<Button
					disabled={flowSelectedIds.length !== 1 || !canBind}
					onClick={onBind}
					type="button"
					variant="outline"
				>
					{USER_FLOW_COPY.bindScreen}
				</Button>
				<Button
					disabled={flowSelectedIds.length !== 1}
					onClick={onUnbind}
					type="button"
					variant="outline"
				>
					{USER_FLOW_COPY.unbind}
				</Button>
			</div>
			<div className="mt-6 grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
				<nav aria-label={USER_FLOW_COPY.outline}>
					<h3 className="font-medium text-sm">{USER_FLOW_COPY.outline}</h3>
					{view.nodes.length === 0 ? (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>{USER_FLOW_COPY.placeNode}</EmptyTitle>
							</EmptyHeader>
						</Empty>
					) : (
						<ul className="mt-2 flex flex-col gap-2">
							{view.groups.map((flowGroup) => (
								<OutlineGroup
									collapsed={collapsedIds.includes(flowGroup.id)}
									id={flowGroup.id}
									key={flowGroup.id}
									nodes={view.nodes.filter(
										(node) => node.groupId === flowGroup.id
									)}
									onMove={onOutlineMove}
									onToggleCollapse={onToggleCollapse}
									onToggleSelect={onToggleSelect}
									selectedIds={flowSelectedIds}
									title={flowGroup.title}
								/>
							))}
							{view.nodes
								.filter((node) => node.groupId === null)
								.map((node) => (
									<OutlineNode
										key={node.id}
										node={node}
										onMove={onOutlineMove}
										onToggleSelect={onToggleSelect}
										selected={flowSelectedIds.includes(node.id)}
									/>
								))}
						</ul>
					)}
				</nav>
				<div>
					<UserFlowCanvas
						liveCards={view.liveCards}
						nodes={view.nodes}
						onAlign={onAlign}
						onDuplicate={onDuplicate}
						onGrid={onGrid}
						onMove={onMove}
						onMoveLiveCard={onMoveLiveCard}
						onPersistViewport={onPersistViewport}
						onSelectedIdsChange={onSelectedIdsChange}
						onUndo={onUndo}
						onZOrder={onZOrder}
						restored={restored}
						selectedIds={selectedIds}
					/>
					<InspectedFlowNode
						flowId={flowId}
						onInvalidate={onInvalidate}
						onPromote={onPromote}
						originRelations={view.originRelations}
						revision={view.revision}
						selectedNode={selectedNode}
					/>
					<LiveCardList cards={view.liveCards} />
				</div>
			</div>
		</>
	);
}

function InspectedFlowNode({
	flowId,
	onInvalidate,
	onPromote,
	originRelations,
	revision,
	selectedNode,
}: {
	flowId: string;
	onInvalidate: () => Promise<void>;
	onPromote: (nodeId: string) => void;
	originRelations: PresentedOriginRelation[];
	revision: number;
	selectedNode: PresentedNode | null;
}) {
	if (!selectedNode) {
		return null;
	}
	return (
		<section aria-label={USER_FLOW_COPY.inspect} className="mt-4">
			<h3 className="font-medium text-sm">{USER_FLOW_COPY.inspect}</h3>
			<p className="mt-2 text-sm">
				{selectedNode.kind}
				{selectedNode.kind === USER_FLOW_COPY.screen
					? ` · ${selectedNode.screenTitle ?? selectedNode.reason}`
					: ` · ${selectedNode.label}`}
			</p>
			{selectedNode.boundAt && selectedNode.resolution === "broken" ? (
				<p className="text-muted-foreground text-sm">{selectedNode.boundAt}</p>
			) : null}
			{selectedNode.pathText.description ? (
				<p className="text-muted-foreground text-sm">
					{selectedNode.pathText.description}
				</p>
			) : null}
			{selectedNode.preview ? (
				<p className="text-muted-foreground text-sm">{selectedNode.preview}</p>
			) : null}
			{selectedNode.openSourceRecord && selectedNode.openHref ? (
				<a className="text-sm underline" href={selectedNode.openHref}>
					{selectedNode.openSourceRecord}
				</a>
			) : null}
			<div className="mt-2 flex flex-wrap gap-2">
				<ConvertAndBindForm
					baseRevision={revision}
					nodeId={selectedNode.id}
					onConverted={onInvalidate}
					userFlowId={flowId}
				/>
				{selectedNode.kind === USER_FLOW_COPY.screen ? null : (
					<PromoteNodeButton nodeId={selectedNode.id} onPromote={onPromote} />
				)}
				{originRelations
					.filter((relation) => relation.nodeId === selectedNode.id)
					.map((relation) => (
						<RebindOriginForm
							key={relation.id}
							nodeId={selectedNode.id}
							onRebound={onInvalidate}
							recordId={relation.recordId}
							recordKind={relation.recordKind}
							sourceVersion={relation.sourceVersion}
							userFlowId={flowId}
						/>
					))}
			</div>
		</section>
	);
}

function LiveCardList({ cards }: { cards: PresentedLiveCard[] }) {
	if (cards.length === 0) {
		return null;
	}
	return (
		<ul className="mt-6 flex flex-col gap-2">
			{cards.map((card) => (
				<li className="rounded-md border p-3" key={card.id}>
					<p>
						{card.recordKind} · {card.title}
						{card.status ? ` · ${card.status}` : null}
					</p>
					<p className="text-muted-foreground text-sm">
						{USER_FLOW_COPY.openSourceRecord}
					</p>
				</li>
			))}
		</ul>
	);
}

function OutlineGroup({
	collapsed,
	id,
	nodes,
	onMove,
	onToggleCollapse,
	onToggleSelect,
	selectedIds,
	title,
}: {
	collapsed: boolean;
	id: string;
	nodes: PresentedNode[];
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
					{collapsed
						? USER_FLOW_COPY.expandGroup
						: USER_FLOW_COPY.collapseGroup}
				</Button>
			</div>
			{collapsed ? null : (
				<ul className="mt-2 flex flex-col gap-2 pl-3">
					{nodes.map((node) => (
						<OutlineNode
							key={node.id}
							node={node}
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

function OutlineNode({
	node,
	onMove,
	onToggleSelect,
	selected,
}: {
	node: PresentedNode;
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
	const label =
		node.kind === USER_FLOW_COPY.screen
			? (node.screenTitle ?? node.reason ?? node.kind)
			: node.label || node.kind;

	return (
		<li className="rounded-md border px-2.5 py-2 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					aria-pressed={selected}
					onClick={onSelect}
					size="sm"
					type="button"
					variant={selected ? "secondary" : "outline"}
				>
					{label}
				</Button>
				<Button onClick={onUp} size="sm" type="button" variant="ghost">
					{USER_FLOW_COPY.moveUp}
				</Button>
				<Button onClick={onDown} size="sm" type="button" variant="ghost">
					{USER_FLOW_COPY.moveDown}
				</Button>
				{node.openHref ? (
					<a className="text-sm underline" href={node.openHref}>
						{node.openSourceRecord}
					</a>
				) : null}
			</div>
		</li>
	);
}

function PromoteNodeButton({
	nodeId,
	onPromote,
}: {
	nodeId: string;
	onPromote: (nodeId: string) => void;
}) {
	const onClick = useCallback(() => {
		onPromote(nodeId);
	}, [nodeId, onPromote]);
	return (
		<Button onClick={onClick} type="button" variant="outline">
			{USER_FLOW_COPY.promoteToScreen}
		</Button>
	);
}
