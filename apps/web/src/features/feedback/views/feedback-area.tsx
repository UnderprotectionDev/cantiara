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

import CreateFeedbackForm from "@/features/feedback/forms/create-feedback-form";
import {
	FEEDBACK_COPY,
	FEEDBACK_STATUSES,
} from "@/features/feedback/forms/feedback-copy";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import { orpc } from "@/utils/orpc";

import FeedbackDetail from "./feedback-detail";

export default function FeedbackArea({
	feedbackId,
	onFeedbackId,
	projectId,
}: {
	feedbackId?: string | null;
	onFeedbackId?: (feedbackId: string | null) => void;
	projectId: string;
}) {
	const [status, setStatus] = useState<string>("");
	const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
	const selectedId = feedbackId ?? localSelectedId;
	const records = useQuery(
		orpc.feedback.list.queryOptions({
			input: {
				projectId,
				...((FEEDBACK_STATUSES as readonly string[]).includes(status)
					? { status: status as (typeof FEEDBACK_STATUSES)[number] }
					: {}),
			},
		})
	);
	const onCreated = useCallback(
		(createdId: string) => {
			setLocalSelectedId(createdId);
			onFeedbackId?.(createdId);
		},
		[onFeedbackId]
	);
	const onSelect = useCallback(
		(id: string) => {
			setLocalSelectedId(id);
			onFeedbackId?.(id);
		},
		[onFeedbackId]
	);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setStatus(event.target.value);
		},
		[]
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
			<h2 className="font-medium text-base">{FEEDBACK_COPY.feedback}</h2>
			<CreateFeedbackForm onCreated={onCreated} projectId={projectId} />
			<Field>
				<FieldLabel htmlFor="feedback-status-filter">
					{FEEDBACK_COPY.status}
				</FieldLabel>
				<NativeSelect
					id="feedback-status-filter"
					onChange={onStatusChange}
					value={status}
				>
					<NativeSelectOption value="">
						{RECORD_DISCOVERY_COPY.anyScope}
					</NativeSelectOption>
					{FEEDBACK_STATUSES.map((item) => (
						<NativeSelectOption key={item} value={item}>
							{item}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{records.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{FEEDBACK_COPY.noFeedback}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{records.data.map((item) => (
							<li key={item.id}>
								<FeedbackRow
									channel={item.channel}
									id={item.id}
									onSelect={onSelect}
									selected={item.id === selectedId}
									status={item.status}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<FeedbackDetail feedbackId={selectedId} projectId={projectId} />
				) : null}
			</div>
		</div>
	);
}

function FeedbackRow({
	channel,
	id,
	onSelect,
	selected,
	status,
}: {
	channel: string;
	id: string;
	onSelect: (id: string) => void;
	selected: boolean;
	status: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-sm"
			onClick={onClick}
			type="button"
		>
			<span>{channel}</span>
			<span className="text-muted-foreground text-xs">{status}</span>
		</button>
	);
}
