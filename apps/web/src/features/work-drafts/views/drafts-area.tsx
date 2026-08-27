import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import WorkDraftForm from "../forms/work-draft-form";
import { WORK_DRAFTS_COPY } from "../forms/work-drafts-copy";

export default function DraftsArea() {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const catalog = useQuery(orpc.workDrafts.catalog.queryOptions());
	const list = useQuery(orpc.workDrafts.list.queryOptions());
	const [draftId, setDraftId] = useState<string | null>(null);
	const [resumeKey, setResumeKey] = useState<string | null>(null);
	const copy = catalog.data?.copy ?? WORK_DRAFTS_COPY;
	const remove = useMutation(
		orpc.workDrafts.delete.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.workDrafts.list.queryKey(),
				});
			},
		})
	);
	const onResume = useCallback((id: string) => {
		setDraftId(id);
		setResumeKey(id);
	}, []);
	const onDelete = useCallback(
		(id: string) => {
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				remove.mutateAsync({
					draftId: id,
					idempotencyKey: newIdempotencyKey(),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then(() => {
					setDraftId((current) => (current === id ? null : current));
					setResumeKey((current) => (current === id ? null : current));
				})
				.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, remove]
	);

	return (
		<FounderPage title={copy.drafts} wide>
			<WorkDraftForm
				draftId={draftId}
				onDraftId={setDraftId}
				resumeKey={resumeKey}
			/>
			{list.data?.length ? (
				<ul aria-label={copy.drafts}>
					{list.data.map((draft) => (
						<DraftListItem
							copy={copy}
							draft={draft}
							key={draft.id}
							onDelete={onDelete}
							onResume={onResume}
						/>
					))}
				</ul>
			) : (
				<p>{copy.noDrafts}</p>
			)}
		</FounderPage>
	);
}

function DraftListItem({
	copy,
	draft,
	onDelete,
	onResume,
}: {
	copy: typeof WORK_DRAFTS_COPY;
	draft: { form: { title: string }; id: string };
	onDelete: (id: string) => void;
	onResume: (id: string) => void;
}) {
	const resume = useCallback(() => {
		onResume(draft.id);
	}, [draft.id, onResume]);
	const remove = useCallback(() => {
		onDelete(draft.id);
	}, [draft.id, onDelete]);
	return (
		<li className="flex items-center justify-between gap-3 py-2">
			<span className="truncate">{draft.form.title}</span>
			<span className="flex gap-2">
				<Button onClick={resume} size="sm" type="button" variant="ghost">
					{copy.resume}
				</Button>
				<Button onClick={remove} size="sm" type="button" variant="ghost">
					{copy.delete}
				</Button>
			</span>
		</li>
	);
}
