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
	const selected = selectedId ?? rows[0]?.id ?? null;

	return (
		<div className="flex min-w-0 flex-col gap-8">
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
				<ul className="flex min-w-0 flex-col gap-1">
					{rows.map((flow) => (
						<li className="min-w-0" key={flow.id}>
							<FlowRowButton
								id={flow.id}
								onSelect={onSelect}
								selected={flow.id === selected}
								title={flow.title}
							/>
						</li>
					))}
				</ul>
			)}
			{selected ? (
				<UserFlowDetail flowId={selected} projectId={projectId} />
			) : null}
		</div>
	);
}

function FlowRowButton({
	id,
	onSelect,
	selected,
	title,
}: {
	id: string;
	onSelect: (id: string) => void;
	selected: boolean;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className={
				selected
					? "w-full min-w-0 truncate rounded-sm bg-muted px-2 py-1.5 text-left font-medium text-foreground text-sm"
					: "w-full min-w-0 truncate rounded-sm px-2 py-1.5 text-left text-foreground text-sm hover:bg-muted/60"
			}
			onClick={onClick}
			type="button"
		>
			{title}
		</button>
	);
}
