import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	DOCUMENTS_COPY,
	documentScopeFor,
	PERSONAL_REVIEW_KIND,
} from "./documents-copy";

const PERSONAL_REVIEW_SOURCE = `prepared:${PERSONAL_REVIEW_KIND}`;

export default function CreateDocumentFromTemplateForm({
	onCreated,
	projectId,
}: {
	onCreated?: (documentId: string) => void;
	projectId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const scope = documentScopeFor(projectId);
	const [error, setError] = useState<string | null>(null);
	const [source, setSource] = useState(PERSONAL_REVIEW_SOURCE);
	const [title, setTitle] = useState("");
	const [placeholderValues, setPlaceholderValues] = useState<
		Record<string, string>
	>({});
	const catalog = useQuery(orpc.documents.catalog.queryOptions());
	const templates = useQuery(
		orpc.documents.listTemplates.queryOptions({ input: { scope } })
	);
	const selectedTemplate = useMemo(
		() => (templates.data ?? []).find((row) => row.id === source) ?? null,
		[source, templates.data]
	);
	const placeholders = selectedTemplate?.placeholders ?? [];
	const instantiate = useMutation(
		orpc.documents.instantiateFromTemplate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.list.queryKey({
							input: { scope },
						}),
					});
					onCreated?.(outcome.document.id);
					recordSave();
					setError(null);
					setTitle("");
					setPlaceholderValues({});
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSourceChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setSource(event.target.value);
			setPlaceholderValues({});
		},
		[]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onPlaceholderChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const { name, value } = event.target;
			setPlaceholderValues((current) => ({ ...current, [name]: value }));
		},
		[]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			const payload =
				source === PERSONAL_REVIEW_SOURCE
					? {
							preparedKind: PERSONAL_REVIEW_KIND,
							scope,
							title,
						}
					: {
							placeholderValues,
							templateId: source,
							title,
						};
			attemptOnlineWork("record-create", () =>
				instantiate.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload,
				})
			);
		},
		[
			attemptOnlineWork,
			instantiate,
			markUnsaved,
			placeholderValues,
			scope,
			source,
			title,
		]
	);

	return (
		<section aria-label={DOCUMENTS_COPY.createFromTemplate}>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="create-document-from-template">
							{DOCUMENTS_COPY.documentTemplate}
						</FieldLabel>
						<NativeSelect
							id="create-document-from-template"
							onChange={onSourceChange}
							value={source}
						>
							<NativeSelectOption value={PERSONAL_REVIEW_SOURCE}>
								{catalog.data?.personalReview.name ??
									DOCUMENTS_COPY.personalReview}
							</NativeSelectOption>
							{(templates.data ?? []).map((row) => (
								<NativeSelectOption key={row.id} value={row.id}>
									{row.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="create-from-template-title">
							{DOCUMENTS_COPY.title}
						</FieldLabel>
						<Input
							id="create-from-template-title"
							onChange={onTitleChange}
							required
							value={title}
						/>
					</Field>
					{placeholders.map((name) => (
						<Field key={name}>
							<FieldLabel htmlFor={`placeholder-${name}`}>{name}</FieldLabel>
							<Input
								id={`placeholder-${name}`}
								name={name}
								onChange={onPlaceholderChange}
								value={placeholderValues[name] ?? ""}
							/>
						</Field>
					))}
				</FieldGroup>
				{error ? <p role="alert">{error}</p> : null}
				<Button type="submit">{DOCUMENTS_COPY.createFromTemplate}</Button>
			</form>
		</section>
	);
}
