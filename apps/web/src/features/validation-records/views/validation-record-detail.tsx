import { Button } from "@cantiara/ui/components/button";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import RelateValidationContextForm from "@/features/validation-records/forms/relate-validation-context-form";
import { VALIDATION_RECORDS_COPY } from "@/features/validation-records/forms/validation-records-copy";
import { orpc } from "@/utils/orpc";

export default function ValidationRecordDetail({
	onOpenDecision,
	projectId,
	validationRecordId,
}: {
	onOpenDecision?: (decisionId: string | null) => void;
	projectId: string;
	validationRecordId: string;
}) {
	const record = useQuery(
		orpc.validationRecords.get.queryOptions({
			input: { validationRecordId },
		})
	);
	const onRelated = useCallback(() => {
		record.refetch().catch(() => undefined);
	}, [record]);

	if (record.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (record.isError || !record.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<article className="flex flex-col gap-4">
			<header className="flex flex-col gap-1">
				<h2 className="font-medium text-base">{record.data.title}</h2>
				<p className="text-muted-foreground text-sm">
					{VALIDATION_RECORDS_COPY.validationRecord}
				</p>
			</header>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{VALIDATION_RECORDS_COPY.method}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">{record.data.method}</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{VALIDATION_RECORDS_COPY.result}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">{record.data.result}</p>
			</section>
			<section className="flex flex-col gap-2">
				<h3 className="text-muted-foreground text-xs">
					{VALIDATION_RECORDS_COPY.related}
				</h3>
				{record.data.relatedContext.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{VALIDATION_RECORDS_COPY.related}
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{record.data.relatedContext.map((item) => (
							<li key={`${item.kind}:${item.id}`}>
								<RelatedContextRow
									item={item}
									onOpenDecision={onOpenDecision}
								/>
							</li>
						))}
					</ul>
				)}
				<RelateValidationContextForm
					onRelated={onRelated}
					projectId={projectId}
					validationRecordId={record.data.id}
				/>
			</section>
		</article>
	);
}

function RelatedContextRow({
	item,
	onOpenDecision,
}: {
	item: {
		id: string;
		kind: "Assumption" | "Question" | "Decision";
		title: string;
	};
	onOpenDecision?: (decisionId: string | null) => void;
}) {
	let label: string = VALIDATION_RECORDS_COPY.decision;
	if (item.kind === "Question") {
		label = VALIDATION_RECORDS_COPY.openQuestion;
	} else if (item.kind === "Assumption") {
		label = VALIDATION_RECORDS_COPY.assumption;
	}
	const onOpen = useCallback(() => {
		onOpenDecision?.(item.id);
	}, [item.id, onOpenDecision]);
	return (
		<div className="flex flex-col gap-1">
			<p className="text-sm">{`${label} · ${item.title}`}</p>
			{item.kind === "Decision" ? (
				<Button onClick={onOpen} type="button" variant="outline">
					{VALIDATION_RECORDS_COPY.decision}
				</Button>
			) : null}
		</div>
	);
}
