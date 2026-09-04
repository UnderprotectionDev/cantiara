import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

import {
	FEEDBACK_COPY,
	FEEDBACK_STATUSES,
} from "@/features/feedback/forms/feedback-copy";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function FeedbackDetail({
	feedbackId,
	projectId,
}: {
	feedbackId: string;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const record = useQuery(
		orpc.feedback.get.queryOptions({
			input: { feedbackId },
		})
	);
	const setStatus = useMutation(
		orpc.feedback.setStatus.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.feedback.get.queryKey({
							input: { feedbackId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.feedback.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
				}
			},
		})
	);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			if (!record.data) {
				return;
			}
			const status = event.target.value;
			if (
				!(FEEDBACK_STATUSES as readonly string[]).includes(status) ||
				status === record.data.status
			) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-edit", () =>
				setStatus.mutateAsync({
					baseRevision: record.data.revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						feedbackId: record.data.id,
						status: status as (typeof FEEDBACK_STATUSES)[number],
					},
				})
			);
		},
		[attemptOnlineWork, markUnsaved, record.data, setStatus]
	);

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
			<header className="flex flex-col gap-2">
				<h2 className="font-medium text-base">{FEEDBACK_COPY.feedback}</h2>
				<p className="text-muted-foreground text-sm">{record.data.status}</p>
			</header>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{FEEDBACK_COPY.originalMessage}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{record.data.originalMessage}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{FEEDBACK_COPY.channel}
				</h3>
				<p className="mt-1 text-sm">{record.data.channel}</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{FEEDBACK_COPY.occurredAt}
				</h3>
				<p className="mt-1 text-sm">{record.data.occurredAt}</p>
			</section>
			{record.data.url ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{FEEDBACK_COPY.link}
					</h3>
					<p className="mt-1 text-sm">{record.data.url}</p>
				</section>
			) : null}
			{record.data.attachments.length > 0 ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{FEEDBACK_COPY.attachments}
					</h3>
					<ul className="mt-1 flex flex-col gap-1">
						{record.data.attachments.map((attachment) => (
							<li className="text-sm" key={attachment.id}>
								{attachment.fileAttachmentId}
							</li>
						))}
					</ul>
				</section>
			) : null}
			<Field>
				<FieldLabel htmlFor="feedback-status">
					{FEEDBACK_COPY.status}
				</FieldLabel>
				<NativeSelect
					id="feedback-status"
					onChange={onStatusChange}
					value={record.data.status}
				>
					{FEEDBACK_STATUSES.map((status) => (
						<NativeSelectOption key={status} value={status}>
							{status}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		</article>
	);
}
