import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { FEEDBACK_COPY } from "@/features/feedback/forms/feedback-copy";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { SMART_COLLECTIONS_COPY } from "@/features/smart-collections/views/smart-collections-copy";
import { orpc } from "@/utils/orpc";

import FeedbackDetail from "./feedback-detail";

type FeedSortField = "title" | "";

export default function FeedArea({
	onSourceId,
	projectId,
}: {
	onSourceId?: (sourceId: string | null) => void;
	projectId: string;
}) {
	const [filterText, setFilterText] = useState("");
	const [sortField, setSortField] = useState<FeedSortField>("");
	const [selected, setSelected] = useState<{
		id: string;
		recordKind: "Feedback" | "Source";
	} | null>(null);
	const feed = useQuery(
		orpc.feedback.listFeed.queryOptions({
			input: {
				projectId,
				...(filterText.trim().length > 0 ? { filterText } : {}),
				...(sortField === "title"
					? { sortDirection: "asc" as const, sortField: "title" as const }
					: {}),
			},
		})
	);
	const onFilterChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setFilterText(event.target.value);
	}, []);
	const onSortChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setSortField(event.target.value === "title" ? "title" : "");
	}, []);
	const onOpen = useCallback(
		(id: string, recordKind: "Feedback" | "Source") => {
			if (recordKind === "Source") {
				onSourceId?.(id);
				return;
			}
			setSelected({ id, recordKind });
		},
		[onSourceId]
	);

	if (feed.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (feed.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<h2 className="font-medium text-base">{FEEDBACK_COPY.feed}</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="feed-filter">
						{SMART_COLLECTIONS_COPY.filter}
					</FieldLabel>
					<Input
						id="feed-filter"
						onChange={onFilterChange}
						value={filterText}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="feed-sort">
						{SMART_COLLECTIONS_COPY.sort}
					</FieldLabel>
					<NativeSelect
						id="feed-sort"
						onChange={onSortChange}
						value={sortField}
					>
						<NativeSelectOption value="">
							{FEEDBACK_COPY.occurredAt}
						</NativeSelectOption>
						<NativeSelectOption value="title">
							{SMART_COLLECTIONS_COPY.title}
						</NativeSelectOption>
					</NativeSelect>
				</Field>
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
				{feed.data.rows.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{FEEDBACK_COPY.noFeed}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{feed.data.rows.map((row) => (
							<li key={row.id}>
								<FeedRow
									attachments={row.attachments.length}
									body={row.body}
									id={row.id}
									identityOrChannel={row.identityOrChannel}
									occurredAt={row.occurredAt}
									onOpen={onOpen}
									openSourceRecord={row.openSourceRecord}
									recordKind={row.recordKind}
									relatedDecisions={row.relatedDecisionIds.length}
									relatedWork={row.relatedWorkIds.length}
									selected={selected?.id === row.id}
								/>
							</li>
						))}
					</ul>
				)}
				{selected?.recordKind === "Feedback" ? (
					<FeedbackDetail feedbackId={selected.id} projectId={projectId} />
				) : null}
			</div>
		</div>
	);
}

function FeedRow({
	attachments,
	body,
	id,
	identityOrChannel,
	occurredAt,
	onOpen,
	openSourceRecord,
	recordKind,
	relatedDecisions,
	relatedWork,
	selected,
}: {
	attachments: number;
	body: string;
	id: string;
	identityOrChannel: string;
	occurredAt: string;
	onOpen: (id: string, recordKind: "Feedback" | "Source") => void;
	openSourceRecord: string;
	recordKind: "Feedback" | "Source";
	relatedDecisions: number;
	relatedWork: number;
	selected: boolean;
}) {
	const onClick = useCallback(() => {
		onOpen(id, recordKind);
	}, [id, onOpen, recordKind]);
	return (
		<article
			aria-current={selected ? "true" : undefined}
			className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm"
		>
			<p className="font-medium">{identityOrChannel}</p>
			<p className="text-muted-foreground text-xs">{occurredAt}</p>
			<p className="line-clamp-4 whitespace-pre-wrap">{body}</p>
			<p className="text-muted-foreground text-xs">
				{FEEDBACK_COPY.attachments}: {attachments}
			</p>
			<p className="text-muted-foreground text-xs">
				{FEEDBACK_COPY.work}: {relatedWork} · {FEEDBACK_COPY.decision}:{" "}
				{relatedDecisions}
			</p>
			<Button onClick={onClick} type="button" variant="ghost">
				{openSourceRecord}
			</Button>
		</article>
	);
}
