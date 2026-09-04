import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { CONTACT_AND_COMPANY_COPY } from "./contact-and-company-copy";

export default function UndoMergeContactsForm({
	mergeEventId,
	onUndone,
	revision,
	survivorId,
}: {
	mergeEventId: string;
	onUndone?: (restoredContactId: string) => void;
	revision: number;
	survivorId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const preview = useQuery(
		orpc.contactAndCompany.previewUndoMerge.queryOptions({
			input: { mergeEventId, survivorId },
		})
	);
	const undo = useMutation(
		orpc.contactAndCompany.undoMerge.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.listContacts.queryKey(),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.listDuplicateCandidates.queryKey(),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.getContact.queryKey({
							input: { contactId: survivorId },
						}),
					});
					if (outcome.status === "committed") {
						onUndone?.(outcome.restoredContactId);
					}
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "conflict") {
					setError(MUTATION_COPY.conflict);
					return;
				}
				if (
					outcome.status === "rejected" &&
					outcome.reason === "merge-preview-required"
				) {
					setError(CONTACT_AND_COMPANY_COPY.undoPreview);
					return;
				}
				setError(MUTATION_COPY.conflict);
			},
		})
	);
	const onClick = useCallback(() => {
		setError(null);
		if (!preview.data) {
			setError(CONTACT_AND_COMPANY_COPY.undoPreview);
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			undo.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				mergeEventId,
				previewAcknowledged: true,
				survivorBaseRevision: revision,
				survivorId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		markUnsaved,
		mergeEventId,
		preview.data,
		revision,
		survivorId,
		undo,
	]);
	return (
		<div className="flex flex-col gap-2">
			{preview.data ? (
				<section
					aria-label={CONTACT_AND_COMPANY_COPY.undoPreview}
					className="text-muted-foreground text-sm"
				>
					<h3 className="font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.undoPreview}
					</h3>
					<p>
						{CONTACT_AND_COMPANY_COPY.origin}{" "}
						{preview.data.retiredContact.displayName ??
							preview.data.retiredContact.id}
					</p>
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.emailAliases}
					</h4>
					{preview.data.emailAliasesToSplit.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.emailAliasesToSplit.map((alias) => (
							<p key={alias.normalizedEmail}>{alias.originalEmail}</p>
						))
					)}
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.relationsToRewrite}
					</h4>
					{preview.data.relationsToSplit.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.relationsToSplit.map((relation) => (
							<p key={`${relation.fromId}:${relation.toId}:${relation.type}`}>
								{relation.type} {relation.rewrittenFromId} → {relation.fromId}
							</p>
						))
					)}
					{preview.data.unrestorable.map((item) => (
						<p key={`${item.kind}:${item.id}`}>
							{item.reason} {item.kind}
						</p>
					))}
				</section>
			) : null}
			<Button
				disabled={undo.isPending || !preview.data}
				onClick={onClick}
				type="button"
				variant="outline"
			>
				{CONTACT_AND_COMPANY_COPY.undo}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}
