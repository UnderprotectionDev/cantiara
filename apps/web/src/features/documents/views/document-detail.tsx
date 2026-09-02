import { Button } from "@cantiara/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cantiara/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import DocumentEditor from "../forms/document-editor";
import {
	DOCUMENT_TYPES,
	DOCUMENTS_COPY,
	type DocumentType,
	documentScopeFor,
} from "../forms/documents-copy";
import DocumentBodyView, { type DocumentBodyBlock } from "./document-body";

export default function DocumentDetail({
	documentId,
	projectId,
}: {
	documentId: string;
	projectId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [type, setType] = useState<DocumentType>("General");
	const selected = useQuery(
		orpc.documents.get.queryOptions({
			input: { documentId },
		})
	);
	const presented = useQuery({
		...orpc.documents.present.queryOptions({
			input: { body },
		}),
		enabled: Boolean(selected.data),
	});

	useEffect(() => {
		if (!selected.data) {
			return;
		}
		setBody(selected.data.body);
		setTitle(selected.data.title);
		setType(selected.data.type);
	}, [selected.data]);

	const save = useMutation(
		orpc.documents.update.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.list.queryKey({
							input: { scope: documentScopeFor(projectId) },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.get.queryKey({
							input: { documentId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
				if (outcome.status === "conflict") {
					setError(outcome.conflict);
				}
			},
		})
	);

	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onTypeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setType(event.target.value as DocumentType);
	}, []);
	const onBlockSourceChange = useCallback(
		(previous: string, next: string) => {
			setBody((current) => replaceFirst(current, previous, next));
			markUnsaved();
		},
		[markUnsaved]
	);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!selected.data) {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					baseRevision: selected.data.revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						body,
						documentId,
						title,
						type,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			body,
			documentId,
			markUnsaved,
			save,
			selected.data,
			title,
			type,
		]
	);

	if (selected.isPending) {
		return <p className="text-muted-foreground text-sm">…</p>;
	}
	if (!selected.data) {
		return <p role="alert">{DOCUMENTS_COPY.selectDocument}</p>;
	}

	const blocks = (presented.data?.blocks ?? []) as DocumentBodyBlock[];

	return (
		<Card className="min-w-0">
			<CardHeader className="border-b">
				<CardTitle>{selected.data.title}</CardTitle>
			</CardHeader>
			<CardContent>
				<form className="flex flex-col gap-3" onSubmit={onSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="edit-document-title">
								{DOCUMENTS_COPY.title}
							</FieldLabel>
							<Input
								id="edit-document-title"
								onChange={onTitleChange}
								value={title}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="edit-document-type">
								{DOCUMENTS_COPY.type}
							</FieldLabel>
							<NativeSelect
								id="edit-document-type"
								onChange={onTypeChange}
								value={type}
							>
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
					<Button type="submit">{DOCUMENTS_COPY.save}</Button>
				</form>
				<div className="mt-6">
					<DocumentBodyView
						blocks={blocks}
						onBlockSourceChange={onBlockSourceChange}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function replaceFirst(haystack: string, needle: string, next: string): string {
	const index = haystack.indexOf(needle);
	if (index < 0) {
		return haystack;
	}
	return (
		haystack.slice(0, index) + next + haystack.slice(index + needle.length)
	);
}
