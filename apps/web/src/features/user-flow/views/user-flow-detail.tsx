import { Button } from "@cantiara/ui/components/button";
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
import CreateScreenForm from "../forms/create-screen-form";
import { FLOW_NODE_KINDS, USER_FLOW_COPY } from "../forms/user-flow-copy";

interface PresentedNode {
	boundAt: string | null;
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

interface UserFlowDetailView {
	copy: {
		archived: string;
		fitView: string;
		openSourceRecord: string;
		userFlow: string;
	};
	id: string;
	nodes: PresentedNode[];
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

	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.userFlow.get.queryKey({
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
			<div className="mt-6">
				<UserFlowCanvas
					nodes={view.nodes}
					onAlign={onAlign}
					onDuplicate={onDuplicate}
					onGrid={onGrid}
					onMove={onMove}
					onUndo={onUndo}
					onZOrder={onZOrder}
				/>
			</div>
			<ul className="mt-6 flex flex-col gap-4">
				{view.nodes.map((node) => (
					<li className="rounded-md border p-3" key={node.id}>
						<p>
							{node.kind}
							{node.kind === USER_FLOW_COPY.screen
								? ` · ${node.screenTitle ?? node.reason}`
								: ` · ${node.label}`}
							{node.reason ? ` · ${node.reason}` : null}
						</p>
						{node.boundAt && node.resolution === "broken" ? (
							<p className="text-muted-foreground text-sm">{node.boundAt}</p>
						) : null}
						{node.pathText.description ? (
							<p className="text-muted-foreground text-sm">
								{node.pathText.description}
							</p>
						) : null}
						{node.preview ? (
							<p className="text-muted-foreground text-sm">{node.preview}</p>
						) : null}
						{node.openSourceRecord && node.openHref ? (
							<a className="text-sm underline" href={node.openHref}>
								{node.openSourceRecord}
							</a>
						) : null}
					</li>
				))}
			</ul>
		</article>
	);
}
