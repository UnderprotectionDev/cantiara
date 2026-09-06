import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import CreateFromUserFlowTemplateForm from "@/features/user-flow/forms/create-from-user-flow-template-form";
import CreateUserFlowForm from "@/features/user-flow/forms/create-user-flow-form";
import { USER_FLOW_COPY } from "@/features/user-flow/forms/user-flow-copy";
import { orpc } from "@/utils/orpc";

import UserFlowDetail from "./user-flow-detail";

export default function UserFlowArea({ projectId }: { projectId: string }) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const flows = useQuery(
		orpc.userFlow.list.queryOptions({ input: { projectId } })
	);
	const onCreated = useCallback((createdId: string) => {
		setSelectedId(createdId);
	}, []);
	const onSelect = useCallback((id: string) => {
		setSelectedId(id);
	}, []);

	if (flows.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (flows.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const rows = flows.data ?? [];

	return (
		<div className="flex flex-col gap-8">
			<CreateUserFlowForm onCreated={onCreated} projectId={projectId} />
			<CreateFromUserFlowTemplateForm
				onCreated={onCreated}
				projectId={projectId}
			/>
			{rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>{USER_FLOW_COPY.noUserFlows}</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="flex flex-col gap-1">
					{rows.map((flow) => (
						<li key={flow.id}>
							<FlowRowButton
								id={flow.id}
								onSelect={onSelect}
								title={flow.title}
							/>
						</li>
					))}
				</ul>
			)}
			{selectedId ? (
				<UserFlowDetail flowId={selectedId} projectId={projectId} />
			) : null}
		</div>
	);
}

function FlowRowButton({
	id,
	onSelect,
	title,
}: {
	id: string;
	onSelect: (id: string) => void;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			className="text-left text-sm underline-offset-4 hover:underline"
			onClick={onClick}
			type="button"
		>
			{title}
		</button>
	);
}
