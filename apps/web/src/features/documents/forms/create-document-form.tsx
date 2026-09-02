import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import DocumentEditor from "./document-editor";
import {
	DOCUMENT_TYPES,
	DOCUMENTS_COPY,
	type DocumentType,
	documentScopeFor,
} from "./documents-copy";

export default function CreateDocumentForm({
	onCreated,
	projectId,
}: {
	onCreated?: (documentId: string) => void;
	projectId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [type, setType] = useState<DocumentType>("General");
	const create = useMutation(
		orpc.documents.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.list.queryKey({
							input: { scope: documentScopeFor(projectId) },
						}),
					});
					onCreated?.(outcome.document.id);
					recordSave();
					setBody("");
					setError(null);
					setTitle("");
					setType("General");
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
						body,
						scope: documentScopeFor(projectId),
						title,
						type,
					},
				})
			);
		},
		[attemptOnlineWork, body, create, markUnsaved, projectId, title, type]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onTypeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setType(event.target.value as DocumentType);
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="document-title">
						{DOCUMENTS_COPY.title}
					</FieldLabel>
					<Input
						id="document-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="document-type">{DOCUMENTS_COPY.type}</FieldLabel>
					<NativeSelect id="document-type" onChange={onTypeChange} value={type}>
						{DOCUMENT_TYPES.map((name) => (
							<NativeSelectOption key={name} value={name}>
								{name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel>{DOCUMENTS_COPY.body}</FieldLabel>
					<DocumentEditor onChange={setBody} value={body} />
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{DOCUMENTS_COPY.createDocument}</Button>
		</form>
	);
}
