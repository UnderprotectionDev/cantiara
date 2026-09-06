import { Button } from "@cantiara/ui/components/button";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FocusEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	isSpecChangeReviewStatus,
	SPEC_CHANGE_REVIEW_COPY,
	SPEC_CHANGE_REVIEW_STATUSES,
} from "./spec-change-review-copy";

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
							<p className="mt-1 text-muted-foreground text-xs">
								{SPEC_CHANGE_REVIEW_COPY.version}{" "}
								{selected.previousVersion.revision}
							</p>
							<pre className="mt-1 whitespace-pre-wrap text-muted-foreground text-xs">
								{section.previousBody}
							</pre>
							<p className="mt-1 text-muted-foreground text-xs">
								{SPEC_CHANGE_REVIEW_COPY.version} {selected.newVersion.revision}
							</p>
							<pre className="mt-1 whitespace-pre-wrap text-xs">
								{section.newBody}
							</pre>
						</article>
					))
				: null}
			{selected ? (
				<ul className="mt-4 space-y-3">
					{selected.candidates.map((candidate) => (
						<li key={candidate.id}>
							<CandidateRow
								candidate={candidate}
								documentId={documentId}
								reviewId={selected.id}
							/>
						</li>
					))}
				</ul>
			) : null}
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

function CandidateRow({
	candidate,
	documentId,
	reviewId,
}: {
	candidate: {
		brokenReason: string | null;
		changedSection: string | null;
		documentLevel: boolean;
		id: string;
		note: string;
		openTarget:
			| { kind: "broken-reference"; reason: string }
			| { kind: "record"; title: string };
		reviewStatus: (typeof SPEC_CHANGE_REVIEW_STATUSES)[number];
		title: string | null;
		why: readonly string[];
	};
	documentId: string;
	reviewId: string;
}) {
	const mark = useMutation(
		orpc.specChangeReview.markCandidate.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.specChangeReview.list.queryKey({
						input: { documentId },
					}),
				});
			},
		})
	);
	const onStatus = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const status = event.target.value;
			if (!isSpecChangeReviewStatus(status)) {
				return;
			}
			mark.mutate({
				candidateId: candidate.id,
				note: candidate.note,
				reviewId,
				status,
			});
		},
		[candidate.id, candidate.note, mark, reviewId]
	);
	const onNote = useCallback(
		(event: FocusEvent<HTMLTextAreaElement>) => {
			mark.mutate({
				candidateId: candidate.id,
				note: event.target.value,
				reviewId,
				status: candidate.reviewStatus,
			});
		},
		[candidate.id, candidate.reviewStatus, mark, reviewId]
	);
	return (
		<article className="rounded-none border border-input p-2">
			<p className="text-sm">
				{candidate.openTarget.kind === "broken-reference"
					? candidate.openTarget.reason
					: candidate.openTarget.title}
			</p>
			<CandidateAttribution candidate={candidate} />
			<p className="mt-1 text-muted-foreground text-xs">
				{SPEC_CHANGE_REVIEW_COPY.why} {candidate.why.join(", ")}
			</p>
			<NativeSelect
				aria-label={SPEC_CHANGE_REVIEW_STATUSES.join(", ")}
				className="mt-2"
				onChange={onStatus}
				value={candidate.reviewStatus}
			>
				{SPEC_CHANGE_REVIEW_STATUSES.map((status) => (
					<NativeSelectOption key={status} value={status}>
						{status}
					</NativeSelectOption>
				))}
			</NativeSelect>
			<Textarea
				aria-label={SPEC_CHANGE_REVIEW_COPY.note}
				className="mt-2"
				defaultValue={candidate.note}
				onBlur={onNote}
			/>
			{candidate.openTarget.kind === "record" ? (
				<FollowUpWorkAction
					candidateId={candidate.id}
					documentId={documentId}
					reviewId={reviewId}
				/>
			) : null}
		</article>
	);
}

function CandidateAttribution({
	candidate,
}: {
	candidate: { changedSection: string | null; documentLevel: boolean };
}) {
	if (candidate.documentLevel) {
		return (
			<p className="mt-1 text-muted-foreground text-xs">
				{SPEC_CHANGE_REVIEW_COPY.documentLevelCandidate}
			</p>
		);
	}
	if (!candidate.changedSection) {
		return null;
	}
	return (
		<p className="mt-1 text-muted-foreground text-xs">
			{candidate.changedSection}
		</p>
	);
}

function FollowUpWorkAction({
	candidateId,
	documentId,
	reviewId,
}: {
	candidateId: string;
	documentId: string;
	reviewId: string;
}) {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const previewFollowUp = useMutation(
		orpc.specChangeReview.previewFollowUp.mutationOptions()
	);
	const confirmFollowUp = useMutation(
		orpc.specChangeReview.confirmFollowUp.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.specChangeReview.list.queryKey({
						input: { documentId },
					}),
				});
			},
		})
	);
	const onPreview = useCallback(() => {
		const result = attemptOnlineWork("record-create", () =>
			previewFollowUp.mutateAsync({ candidateId, reviewId })
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, candidateId, previewFollowUp, reviewId]);
	const onConfirm = useCallback(() => {
		const preview = previewFollowUp.data;
		if (!(preview && preview.status === "committed")) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			confirmFollowUp.mutateAsync({
				candidateId,
				idempotencyKey: newIdempotencyKey(),
				previewAcknowledged: true,
				reviewId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		candidateId,
		confirmFollowUp,
		markUnsaved,
		previewFollowUp.data,
		reviewId,
	]);
	const preview =
		previewFollowUp.data?.status === "committed"
			? previewFollowUp.data.preview
			: null;
	return (
		<div className="mt-2">
			<Button onClick={onPreview} type="button">
				{SPEC_CHANGE_REVIEW_COPY.createFollowUpWork}
			</Button>
			{preview ? (
				<div className="mt-2 space-y-1 text-sm">
					<p>
						{SPEC_CHANGE_REVIEW_COPY.preview}: {preview.followUpWork.title}
					</p>
					<p>
						{SPEC_CHANGE_REVIEW_COPY.project} {preview.project.name}
					</p>
					<p>
						{SPEC_CHANGE_REVIEW_COPY.startingStatus}{" "}
						{preview.followUpWork.startingStatus}
					</p>
					<p>
						{SPEC_CHANGE_REVIEW_COPY.version}{" "}
						{preview.specVersions.previous.revision} →{" "}
						{preview.specVersions.new.revision}
					</p>
					<p>
						{SPEC_CHANGE_REVIEW_COPY.candidateSource}{" "}
						{preview.candidateSourceRelation.origin}
						{", "}
						{preview.candidateSourceRelation.why.join(", ")}
					</p>
					<Button onClick={onConfirm} type="button">
						{SPEC_CHANGE_REVIEW_COPY.confirm}
					</Button>
				</div>
			) : null}
		</div>
	);
}
