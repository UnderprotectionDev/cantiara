import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DECISIONS_COPY } from "./decisions-copy";

export default function RemoveSupersessionForm({
	baseRevision,
	onRemoved,
	projectId,
	successorId,
	supersededId,
}: {
	baseRevision: number;
	onRemoved?: () => void;
	projectId: string;
	successorId: string;
	supersededId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const preview = useQuery({
		...orpc.decisions.previewRemoveSupersession.queryOptions({
			input: {
				payload: { successorId, supersededId },
			},
		}),
		enabled: open,
	});
	const remove = useMutation(
		orpc.decisions.removeSupersession.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.decisions.list.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.decisions.get.queryKey({
							input: { decisionId: successorId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.decisions.get.queryKey({
							input: { decisionId: supersededId },
						}),
					});
					recordSave();
					onRemoved?.();
					setError(null);
					setOpen(false);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onOpen = useCallback(() => {
		setOpen(true);
		setError(null);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (preview.data?.status !== "ok") {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				remove.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						confirm: true,
						successorId,
						supersededId,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			baseRevision,
			markUnsaved,
			preview.data?.status,
			remove,
			successorId,
			supersededId,
		]
	);
	if (!open) {
		return (
			<Button onClick={onOpen} type="button">
				{DECISIONS_COPY.removeSupersession}
			</Button>
		);
	}
	const previewOk = preview.data?.status === "ok" ? preview.data.preview : null;
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			{previewOk ? (
				<section aria-label={DECISIONS_COPY.preview}>
					<p className="text-sm">
						{`${previewOk.superseded.title} ${previewOk.superseded.life} → ${previewOk.superseded.nextLife}`}
					</p>
					<p className="text-sm">
						{`${previewOk.successor.title} ${previewOk.successor.life} → ${previewOk.successor.nextLife}`}
					</p>
				</section>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
			<Button disabled={!previewOk || remove.isPending} type="submit">
				{DECISIONS_COPY.confirm}
			</Button>
		</form>
	);
}
