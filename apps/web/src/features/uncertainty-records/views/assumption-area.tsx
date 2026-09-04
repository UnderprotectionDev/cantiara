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
import CreateAssumptionForm from "@/features/uncertainty-records/forms/create-assumption-form";
import {
	ASSUMPTION_LIVES,
	UNCERTAINTY_COPY,
} from "@/features/uncertainty-records/forms/uncertainty-records-copy";
import { orpc } from "@/utils/orpc";

import AssumptionDetail from "./assumption-detail";

export default function AssumptionArea({
	assumptionId,
	onAssumptionId,
	projectId,
}: {
	assumptionId?: string | null;
	onAssumptionId?: (assumptionId: string | null) => void;
	projectId: string;
}) {
	const [life, setLife] = useState<string>("");
	const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
	const selectedId = assumptionId ?? localSelectedId;
	const assumptions = useQuery(
		orpc.uncertaintyRecords.listAssumptions.queryOptions({
			input: {
				projectId,
				...((ASSUMPTION_LIVES as readonly string[]).includes(life)
					? { life: life as (typeof ASSUMPTION_LIVES)[number] }
					: {}),
			},
		})
	);
	const onCreated = useCallback(
		(createdId: string) => {
			setLocalSelectedId(createdId);
			onAssumptionId?.(createdId);
		},
		[onAssumptionId]
	);
	const onSelect = useCallback(
		(id: string) => {
			setLocalSelectedId(id);
			onAssumptionId?.(id);
		},
		[onAssumptionId]
	);
	const onLifeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setLife(event.target.value);
	}, []);

	if (assumptions.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (assumptions.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<h2 className="font-medium text-base">{UNCERTAINTY_COPY.assumption}</h2>
			<CreateAssumptionForm onCreated={onCreated} projectId={projectId} />
			<Field>
				<FieldLabel htmlFor="assumption-life-filter">
					{PROJECT_SHELL_COPY.status}
				</FieldLabel>
				<NativeSelect
					id="assumption-life-filter"
					onChange={onLifeChange}
					value={life}
				>
					<NativeSelectOption value="">
						{RECORD_DISCOVERY_COPY.anyScope}
					</NativeSelectOption>
					{ASSUMPTION_LIVES.map((item) => (
						<NativeSelectOption key={item} value={item}>
							{item}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{assumptions.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{UNCERTAINTY_COPY.noAssumptions}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{assumptions.data.map((item) => (
							<li key={item.id}>
								<AssumptionRow
									id={item.id}
									life={item.life}
									onSelect={onSelect}
									selected={item.id === selectedId}
									statement={item.statement}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<AssumptionDetail assumptionId={selectedId} projectId={projectId} />
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{UNCERTAINTY_COPY.assumption}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function AssumptionRow({
	id,
	life,
	onSelect,
	selected,
	statement,
}: {
	id: string;
	life: string;
	onSelect: (id: string) => void;
	selected: boolean;
	statement: string;
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
			<span className="font-medium">{statement}</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">{life}</span>
		</button>
	);
}
