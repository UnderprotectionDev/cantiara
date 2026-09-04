import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import RecordOpenQuestionOutcomeForm from "@/features/uncertainty-records/forms/record-open-question-outcome-form";
import { UNCERTAINTY_COPY } from "@/features/uncertainty-records/forms/uncertainty-records-copy";
import { orpc } from "@/utils/orpc";

export default function OpenQuestionDetail({
	openQuestionId,
	projectId,
}: {
	openQuestionId: string;
	projectId: string;
}) {
	const openQuestion = useQuery(
		orpc.uncertaintyRecords.getOpenQuestion.queryOptions({
			input: { openQuestionId },
		})
	);
	const onChanged = useCallback(() => {
		openQuestion.refetch().catch(() => undefined);
	}, [openQuestion]);

	if (openQuestion.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (openQuestion.isError || !openQuestion.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<article className="flex flex-col gap-4">
			<header className="flex flex-col gap-2">
				<p className="text-muted-foreground text-xs">
					{UNCERTAINTY_COPY.openQuestion}
				</p>
				<h2 className="font-medium text-base">{openQuestion.data.title}</h2>
				<p className="text-muted-foreground text-sm">
					{openQuestion.data.life}
				</p>
			</header>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{UNCERTAINTY_COPY.question}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{openQuestion.data.question}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{UNCERTAINTY_COPY.context}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{openQuestion.data.context}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{UNCERTAINTY_COPY.answer}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{openQuestion.data.answer}
				</p>
			</section>
			{openQuestion.data.rationale ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{UNCERTAINTY_COPY.rationale}
					</h3>
					<p className="mt-1 whitespace-pre-wrap text-sm">
						{openQuestion.data.rationale}
					</p>
				</section>
			) : null}
			{openQuestion.data.evidenceMissing ? (
				<p role="status">{UNCERTAINTY_COPY.evidenceMissing}</p>
			) : null}
			{openQuestion.data.evidence.length > 0 ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{UNCERTAINTY_COPY.evidence}
					</h3>
					<ul className="mt-1 flex flex-col gap-1">
						{openQuestion.data.evidence.map((item) => (
							<li className="text-sm" key={item.id}>
								{`${item.type} · ${item.sourceKind}`}
							</li>
						))}
					</ul>
				</section>
			) : null}
			<RecordOpenQuestionOutcomeForm
				baseRevision={openQuestion.data.revision}
				life={openQuestion.data.life}
				onRecorded={onChanged}
				openQuestionId={openQuestion.data.id}
				projectId={projectId}
			/>
		</article>
	);
}
