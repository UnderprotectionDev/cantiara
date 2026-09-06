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

import CreateScreenForm from "../forms/create-screen-form";
import { USER_FLOW_COPY } from "../forms/user-flow-copy";

interface PresentedNode {
	boundAt: string | null;
	id: string;
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
	screenId: string;
	screenTitle: string | null;
}

interface UserFlowDetailView {
	copy: {
		archived: string;
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
	const [screenId, setScreenId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const place = useMutation(
		orpc.userFlow.placeScreenNode.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.userFlow.get.queryKey({
							input: { userFlowId: flowId },
						}),
					});
					setDescription("");
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);

	const onBind = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!(flow.data && screenId)) {
				return;
			}
			place.mutate({
				baseRevision: flow.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					pathText: {
						condition: "",
						decision: "",
						description,
						transition: "",
					},
					screenId,
					userFlowId: flowId,
				},
			});
		},
		[description, flow.data, flowId, place, screenId]
	);

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
			<form className="mt-4 flex flex-col gap-3" onSubmit={onBind}>
				<FieldGroup>
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
				<Button type="submit">{USER_FLOW_COPY.bindScreen}</Button>
			</form>
			<ul className="mt-6 flex flex-col gap-4">
				{view.nodes.map((node) => (
					<li className="rounded-md border p-3" key={node.id}>
						<p>
							{node.screenTitle ?? node.reason}
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
