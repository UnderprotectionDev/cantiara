import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import CreateDocumentForm from "../forms/create-document-form";
import CreateDocumentFromTemplateForm from "../forms/create-document-from-template-form";
import CreateDocumentTemplateForm from "../forms/create-document-template-form";
import { DOCUMENTS_COPY, documentScopeFor } from "../forms/documents-copy";
import DocumentDetail from "./document-detail";

export default function DocumentArea({
	onOpenSourceRecord,
	projectId,
}: {
	onOpenSourceRecord?: (id: string) => void;
	projectId: string | null;
}) {
	const scope = documentScopeFor(projectId);
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [archived, setArchived] = useState(false);
	const [folderName, setFolderName] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const materialize = useMutation(
		orpc.documents.materializeStarterSkeletons.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.documents.list.queryKey({
						input: { archived, scope },
					}),
				});
			},
		})
	);
	useEffect(() => {
		if (!projectId) {
			return;
		}
		const result = attemptOnlineWork("record-create", () =>
			materialize.mutateAsync({
				idempotencyKey: `starter-skeleton-documents:${projectId}`,
				payload: { projectId },
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, materialize.mutateAsync, projectId]);
	const documents = useQuery(
		orpc.documents.list.queryOptions({ input: { archived, scope } })
	);
	const folders = useQuery(
		orpc.documents.listFolders.queryOptions({ input: { scope } })
	);
	const createFolder = useMutation(
		orpc.documents.createFolder.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.listFolders.queryKey({
							input: { scope },
						}),
					});
					recordSave();
					setFolderName("");
				}
			},
		})
	);
	const onCreated = useCallback((documentId: string) => {
		setSelectedId(documentId);
	}, []);
	const onSelect = useCallback((documentId: string) => {
		setSelectedId(documentId);
	}, []);
	const onArchivedChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setArchived(event.target.checked);
			setSelectedId(null);
		},
		[]
	);
	const onFolderNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setFolderName(event.target.value);
		},
		[]
	);
	const onCreateFolder = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const name = folderName.trim();
			if (name.length === 0) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				createFolder.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: { name, scope },
				})
			);
		},
		[attemptOnlineWork, createFolder, folderName, markUnsaved, scope]
	);

	if (
		documents.isPending ||
		folders.isPending ||
		(projectId !== null && materialize.isPending)
	) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (documents.isError || folders.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateDocumentForm onCreated={onCreated} projectId={projectId} />
			<CreateDocumentFromTemplateForm
				onCreated={onCreated}
				projectId={projectId}
			/>
			<CreateDocumentTemplateForm projectId={projectId} />
			<form
				className="flex flex-wrap items-end gap-3"
				onSubmit={onCreateFolder}
			>
				<Field>
					<FieldLabel htmlFor="document-folder-name">
						{DOCUMENTS_COPY.folder}
					</FieldLabel>
					<Input
						id="document-folder-name"
						onChange={onFolderNameChange}
						value={folderName}
					/>
				</Field>
				<Button type="submit">{DOCUMENTS_COPY.createFolder}</Button>
			</form>
			<label className="flex items-center gap-2 text-sm">
				<input checked={archived} onChange={onArchivedChange} type="checkbox" />
				{DOCUMENTS_COPY.archived}
			</label>
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{documents.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{DOCUMENTS_COPY.noDocuments}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{documents.data.map((item) => (
							<li key={item.id}>
								<DocumentRow
									folderName={
										folders.data.find((folder) => folder.id === item.folderId)
											?.name
									}
									id={item.id}
									onSelect={onSelect}
									parent={Boolean(item.parentId)}
									selected={item.id === selectedId}
									title={item.title}
									type={item.type}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<DocumentDetail
						archivedList={archived}
						documentId={selectedId}
						onOpenSourceRecord={onOpenSourceRecord}
						onSelect={onSelect}
						projectId={projectId}
					/>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{DOCUMENTS_COPY.selectDocument}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function DocumentRow({
	folderName,
	id,
	onSelect,
	parent,
	selected,
	title,
	type,
}: {
	folderName?: string;
	id: string;
	onSelect: (id: string) => void;
	parent: boolean;
	selected: boolean;
	title: string;
	type: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			<span className={parent ? "ml-4 block font-medium" : "font-medium"}>
				{title}
			</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">
				{`${folderName ? `${folderName} · ` : ""}${type}`}
			</span>
		</button>
	);
}
