import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { orpc } from "@/utils/orpc";

import { SPEC_CHANGE_REVIEW_COPY } from "./spec-change-review-copy";

export default function SpecChangeReviewQueue({
	documentId,
}: {
	documentId: string;
}) {
	const listed = useQuery(
		orpc.specChangeReview.list.queryOptions({
			input: { documentId },
		})
	);
	const reviews = listed.data ?? [];
	const [selectedId, setSelectedId] = useState<string | null>(null);
	useEffect(() => {
		const latest = reviews.at(-1)?.id ?? null;
		setSelectedId((current) => {
			if (current && reviews.some((review) => review.id === current)) {
				return current;
			}
			return latest;
		});
	}, [reviews]);
	const selected = reviews.find((review) => review.id === selectedId);
	if (reviews.length === 0) {
		return null;
	}
	return (
		<section
			aria-label={SPEC_CHANGE_REVIEW_COPY.specChangeReview}
			className="mt-6"
		>
			<h3 className="font-medium text-sm">
				{SPEC_CHANGE_REVIEW_COPY.specChangeReview}
			</h3>
			<p className="mt-1 text-muted-foreground text-sm">
				{SPEC_CHANGE_REVIEW_COPY.primarySpec} {selected?.primarySpec.title}
			</p>
			<ul className="mt-2 space-y-1">
				{reviews.map((review) => (
					<li key={review.id}>
						<VersionPairButton
							newRevision={review.newVersion.revision}
							onSelect={setSelectedId}
							previousRevision={review.previousVersion.revision}
							reviewId={review.id}
							selected={review.id === selectedId}
						/>
					</li>
				))}
			</ul>
			{selected
				? selected.changedSections.map((section) => (
						<article className="mt-3" key={section.heading}>
							<h4 className="font-medium text-sm">{section.heading}</h4>
							<pre className="mt-1 whitespace-pre-wrap text-muted-foreground text-xs">
								{section.previousBody}
							</pre>
							<pre className="mt-1 whitespace-pre-wrap text-xs">
								{section.newBody}
							</pre>
						</article>
					))
				: null}
		</section>
	);
}

function VersionPairButton({
	newRevision,
	onSelect,
	previousRevision,
	reviewId,
	selected,
}: {
	newRevision: number;
	onSelect: (reviewId: string) => void;
	previousRevision: number;
	reviewId: string;
	selected: boolean;
}) {
	const onClick = useCallback(() => {
		onSelect(reviewId);
	}, [onSelect, reviewId]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="rounded-none border border-input px-2.5 py-1 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			{SPEC_CHANGE_REVIEW_COPY.version} {previousRevision} → {newRevision}
		</button>
	);
}
