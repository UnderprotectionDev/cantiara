import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DOCUMENTS_COPY, documentScopeFor } from "./documents-copy";

export default function CreateDocumentTemplateForm({
	projectId,
}: {
	projectId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [skeleton, setSkeleton] = useState("");
	const create = useMutation(
		orpc.documents.createTemplate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.listTemplates.queryKey({
							input: { scope: documentScopeFor(projectId) },
						}),
					});
					recordSave();
					setError(null);
					setName("");
					setSkeleton("");
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						name,
						scope: documentScopeFor(projectId),
						skeleton,
					},
				})
			);
		},
		[attemptOnlineWork, create, markUnsaved, name, projectId, skeleton]
	);
	const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);
	const onSkeletonChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setSkeleton(event.target.value);
		},
		[]
	);

	return (
		<section aria-label={DOCUMENTS_COPY.documentTemplate}>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="document-template-name">
							{DOCUMENTS_COPY.name}
						</FieldLabel>
						<Input
							id="document-template-name"
							onChange={onNameChange}
							required
							value={name}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="document-template-skeleton">
							{DOCUMENTS_COPY.skeleton}
						</FieldLabel>
						<Textarea
							id="document-template-skeleton"
							onChange={onSkeletonChange}
							value={skeleton}
						/>
					</Field>
				</FieldGroup>
				{error ? <p role="alert">{error}</p> : null}
				<Button type="submit">{DOCUMENTS_COPY.addDocumentTemplate}</Button>
			</form>
		</section>
	);
}
