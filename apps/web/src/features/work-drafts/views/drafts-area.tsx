import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import WorkDraftForm from "../forms/work-draft-form";
import {
	resumeListedDraft,
	type WorkDraftFormValues,
} from "../forms/work-draft-form-state";
import { WORK_DRAFTS_COPY } from "../forms/work-drafts-copy";
import { draftsListPresentation } from "./drafts-list-presentation";

interface ListedDraft {
	form: {
		customFieldValues: Record<string, string>;
		projectId: string | null;
		title: string;
		type: WorkDraftFormValues["type"];
	};
	id: string;
	updatedAt: Date | string;
}

export default function DraftsArea() {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const catalog = useQuery(orpc.workDrafts.catalog.queryOptions());
	const list = useQuery(orpc.workDrafts.list.queryOptions());
	const [draftId, setDraftId] = useState<string | null>(null);
	const [formInstance, setFormInstance] = useState(0);
	const [initialForm, setInitialForm] = useState<
		WorkDraftFormValues | undefined
	>();
	const [lastSuccessfulSaveAt, setLastSuccessfulSaveAt] = useState<
		Date | string | null
	>(null);
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
	const onResume = useCallback((draft: ListedDraft) => {
		const resumed = resumeListedDraft(draft);
		setDraftId(resumed.draftId);
		setInitialForm(resumed.form);
		setLastSuccessfulSaveAt(draft.updatedAt);
		setFormInstance((current) => current + 1);
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
					if (draftId !== id) {
						return;
					}
					setDraftId(null);
					setInitialForm(undefined);
					setLastSuccessfulSaveAt(null);
					setFormInstance((current) => current + 1);
				})
				.catch(() => undefined);
		},
		[attemptOnlineWork, draftId, markUnsaved, remove]
	);

	return (
		<FounderPage title={copy.drafts} wide>
			<WorkDraftForm
				draftId={draftId}
				initialForm={initialForm}
				key={formInstance}
				lastSuccessfulSaveAt={lastSuccessfulSaveAt}
				onDraftId={setDraftId}
			/>
			<DraftsList
				copy={copy}
				list={list}
				onDelete={onDelete}
				onResume={onResume}
			/>
		</FounderPage>
	);
}

function DraftsList({
	copy,
	list,
	onDelete,
	onResume,
}: {
	copy: typeof WORK_DRAFTS_COPY;
	list: {
		data: readonly ListedDraft[] | undefined;
		isError: boolean;
		isPending: boolean;
	};
	onDelete: (id: string) => void;
	onResume: (draft: ListedDraft) => void;
}) {
	const presentation = draftsListPresentation(list);
	if (presentation.kind === "failed") {
		return <p>{MAIN_FLOW_COPY.failed}</p>;
	}
	if (presentation.kind === "loading") {
		return <p>{copy.loading}</p>;
	}
	if (presentation.kind === "empty") {
		return <p>{copy.noDrafts}</p>;
	}
	return (
		<ul aria-label={copy.drafts}>
			{presentation.drafts.map((draft) => (
				<DraftListItem
					copy={copy}
					draft={draft}
					key={draft.id}
					onDelete={onDelete}
					onResume={onResume}
				/>
			))}
		</ul>
	);
}

function DraftListItem({
	copy,
	draft,
	onDelete,
	onResume,
}: {
	copy: typeof WORK_DRAFTS_COPY;
	draft: ListedDraft;
	onDelete: (id: string) => void;
	onResume: (draft: ListedDraft) => void;
}) {
	const resume = useCallback(() => {
		onResume(draft);
	}, [draft, onResume]);
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
