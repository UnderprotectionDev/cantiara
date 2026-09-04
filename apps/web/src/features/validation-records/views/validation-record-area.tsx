import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import CreateValidationRecordForm from "@/features/validation-records/forms/create-validation-record-form";
import { VALIDATION_RECORDS_COPY } from "@/features/validation-records/forms/validation-records-copy";
import { orpc } from "@/utils/orpc";

import ValidationRecordDetail from "./validation-record-detail";

export default function ValidationRecordArea({
	onOpenDecision,
	onValidationRecordId,
	projectId,
	validationRecordId,
}: {
	onOpenDecision?: (decisionId: string | null) => void;
	onValidationRecordId?: (validationRecordId: string | null) => void;
	projectId: string;
	validationRecordId?: string | null;
}) {
	const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
	const selectedId = validationRecordId ?? localSelectedId;
	const records = useQuery(
		orpc.validationRecords.list.queryOptions({
			input: { projectId },
		})
	);
	const onCreated = useCallback(
		(createdId: string) => {
			setLocalSelectedId(createdId);
			onValidationRecordId?.(createdId);
		},
		[onValidationRecordId]
	);
	const onSelect = useCallback(
		(id: string) => {
			setLocalSelectedId(id);
			onValidationRecordId?.(id);
		},
		[onValidationRecordId]
	);

	if (records.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (records.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateValidationRecordForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{records.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>
								{VALIDATION_RECORDS_COPY.noValidationRecords}
							</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{records.data.map((item) => (
							<li key={item.id}>
								<ValidationRecordRow
									id={item.id}
									onSelect={onSelect}
									selected={item.id === selectedId}
									title={item.title}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<ValidationRecordDetail
						onOpenDecision={onOpenDecision}
						projectId={projectId}
						validationRecordId={selectedId}
					/>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>
								{VALIDATION_RECORDS_COPY.validationRecord}
							</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function ValidationRecordRow({
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
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			<span className="font-medium">{title}</span>
		</button>
	);
}
