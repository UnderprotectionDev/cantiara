import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import CreateRiskForm from "@/features/risks/forms/create-risk-form";
import { RISK_STATUSES, RISKS_COPY } from "@/features/risks/forms/risks-copy";
import { orpc } from "@/utils/orpc";

import RiskDetail from "./risk-detail";

export default function RiskArea({
	onRiskId,
	projectId,
	riskId,
}: {
	onRiskId?: (riskId: string | null) => void;
	projectId: string;
	riskId?: string | null;
}) {
	const [status, setStatus] = useState<string>("");
	const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
	const selectedId = riskId ?? localSelectedId;
	const risks = useQuery(
		orpc.risks.list.queryOptions({
			input: {
				projectId,
				...(RISK_STATUSES.includes(status as (typeof RISK_STATUSES)[number])
					? { status: status as (typeof RISK_STATUSES)[number] }
					: {}),
			},
		})
	);
	const onCreated = useCallback(
		(createdId: string) => {
			setLocalSelectedId(createdId);
			onRiskId?.(createdId);
		},
		[onRiskId]
	);
	const onSelect = useCallback(
		(id: string) => {
			setLocalSelectedId(id);
			onRiskId?.(id);
		},
		[onRiskId]
	);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setStatus(event.target.value);
		},
		[]
	);

	if (risks.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (risks.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateRiskForm onCreated={onCreated} projectId={projectId} />
			<Field>
				<FieldLabel htmlFor="risk-status-filter">
					{PROJECT_SHELL_COPY.status}
				</FieldLabel>
				<NativeSelect
					id="risk-status-filter"
					onChange={onStatusChange}
					value={status}
				>
					<NativeSelectOption value="">
						{RECORD_DISCOVERY_COPY.anyScope}
					</NativeSelectOption>
					{RISK_STATUSES.map((item) => (
						<NativeSelectOption key={item} value={item}>
							{item}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{risks.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{RISKS_COPY.noRisks}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{risks.data.map((item) => (
							<li key={item.id}>
								<RiskRow
									id={item.id}
									onSelect={onSelect}
									selected={item.id === selectedId}
									status={item.status}
									title={item.title}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<RiskDetail riskId={selectedId} />
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{RISKS_COPY.risk}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function RiskRow({
	id,
	onSelect,
	selected,
	status,
	title,
}: {
	id: string;
	onSelect: (id: string) => void;
	selected: boolean;
	status: string;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			<span className="font-medium">{title}</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">
				{status}
			</span>
		</button>
	);
}
