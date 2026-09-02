import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DOCUMENTS_COPY, documentScopeFor } from "./documents-copy";

export default function ConvertToTemplateForm({
	documentId,
	projectId,
}: {
	documentId: string;
	projectId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const preview = useQuery({
		...orpc.documents.previewConvertToTemplate.queryOptions({
			input: { documentId },
		}),
		enabled: open,
	});
	const convert = useMutation(
		orpc.documents.convertToTemplate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.listTemplates.queryKey({
							input: { scope: documentScopeFor(projectId) },
						}),
					});
					recordSave();
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
	const onPreview = useCallback(() => {
		setError(null);
		setOpen(true);
	}, []);
	const onApply = useCallback(() => {
		if (preview.data?.status !== "ok") {
			return;
		}
		setError(null);
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			convert.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				payload: { documentId },
			})
		);
	}, [attemptOnlineWork, convert, documentId, markUnsaved, preview.data]);

	const previewBody =
		preview.data?.status === "ok" ? preview.data.preview : null;

	const previewFailed = preview.isError || preview.data?.status === "rejected";

	return (
		<section aria-label={DOCUMENTS_COPY.convertToTemplate}>
			{open ? (
				<div className="flex flex-col gap-2">
					{previewBody ? (
						<div>
							<p className="text-sm">{previewBody.name}</p>
							<pre className="overflow-auto whitespace-pre-wrap border border-input p-2 text-xs">
								{previewBody.skeleton}
							</pre>
							{previewBody.placeholders.length > 0 ? (
								<p className="text-muted-foreground text-xs">
									{DOCUMENTS_COPY.placeholders}:{" "}
									{previewBody.placeholders
										.map((name) => `{{${name}}}`)
										.join(", ")}
								</p>
							) : null}
							<Button onClick={onApply} type="button">
								{DOCUMENTS_COPY.convertToTemplate}
							</Button>
						</div>
					) : null}
					{!previewBody && previewFailed ? (
						<p role="alert">{DOCUMENTS_COPY.selectDocument}</p>
					) : null}
					{previewBody || previewFailed ? null : (
						<p className="text-muted-foreground text-sm">…</p>
					)}
				</div>
			) : (
				<Button onClick={onPreview} type="button" variant="outline">
					{DOCUMENTS_COPY.convertToTemplate}
				</Button>
			)}
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}
