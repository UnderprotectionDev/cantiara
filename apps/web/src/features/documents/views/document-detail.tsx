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
	archivedList,
	documentId,
	projectId,
}: {
	archivedList?: boolean;
	documentId: string;
	projectId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [folderId, setFolderId] = useState<string>("");
	const [parentId, setParentId] = useState<string>("");
	const [title, setTitle] = useState("");
	const [type, setType] = useState<DocumentType>("General");
	const scope = documentScopeFor(projectId);
	const selected = useQuery(
		orpc.documents.get.queryOptions({
			input: { documentId },
		})
	);
	const listed = useQuery(
		orpc.documents.list.queryOptions({
			input: { scope },
		})
	);
	const folders = useQuery(
		orpc.documents.listFolders.queryOptions({ input: { scope } })
	);
	const placementPreview = useQuery({
		...orpc.documents.previewPlacement.queryOptions({
			input: {
				documentId,
				folderId: folderId.length > 0 ? folderId : null,
				parentId: parentId.length > 0 ? parentId : null,
			},
		}),
		enabled: Boolean(selected.data),
	});
	const archivePreview = useQuery({
		...orpc.documents.previewArchive.queryOptions({
			input: { documentId },
		}),
		enabled: Boolean(selected.data),
	});
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
		setFolderId(selected.data.folderId ?? "");
		setParentId(selected.data.parentId ?? "");
	}, [selected.data]);

	const invalidateDocuments = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.list.queryKey({
				input: { archived: archivedList, scope },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.list.queryKey({
				input: { scope },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.get.queryKey({
				input: { documentId },
			}),
		});
	}, [archivedList, documentId, scope]);

	const place = useMutation(
		orpc.documents.place.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateDocuments();
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(placementError(outcome.reason));
				}
			},
		})
	);
	const archive = useMutation(
		orpc.documents.archive.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateDocuments();
					recordSave();
					setError(null);
				}
			},
		})
	);
	const unarchive = useMutation(
		orpc.documents.unarchive.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateDocuments();
					recordSave();
					setError(null);
				}
			},
		})
	);
	const save = useMutation(
		orpc.documents.update.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateDocuments();
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
	const onFolderChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setFolderId(event.target.value);
		},
		[]
	);
	const onParentChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setParentId(event.target.value);
		},
		[]
	);
	const onBlockSourceChange = useCallback(
		(previous: string, next: string) => {
			setBody((current) => replaceFirst(current, previous, next));
			markUnsaved();
		},
		[markUnsaved]
	);

	const onPlace = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!selected.data) {
				return;
			}
			if (placementPreview.data?.status === "blocked") {
				setError(placementError(placementPreview.data.reason));
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				place.mutateAsync({
					baseRevision: selected.data.revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						documentId,
						folderId: folderId.length > 0 ? folderId : null,
						parentId: parentId.length > 0 ? parentId : null,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			documentId,
			folderId,
			markUnsaved,
			parentId,
			place,
			placementPreview.data,
			selected.data,
		]
	);
	const onArchive = useCallback(() => {
		if (!selected.data) {
			return;
		}
		markUnsaved();
		const procedure = selected.data.archived ? unarchive : archive;
		attemptOnlineWork("record-create", () =>
			procedure.mutateAsync({
				baseRevision: selected.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { documentId },
			})
		);
	}, [
		archive,
		attemptOnlineWork,
		documentId,
		markUnsaved,
		selected.data,
		unarchive,
	]);
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
	const parentChoices = (listed.data ?? []).filter(
		(item) => item.id !== documentId
	);

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
				{selected.data.inDocTags.length > 0 ? (
					<p className="mt-3 text-muted-foreground text-sm">
						{selected.data.inDocTags.map((tag) => `#${tag.name}`).join(" ")}
					</p>
				) : null}
				<form className="mt-6 flex flex-col gap-3" onSubmit={onPlace}>
					<Field>
						<FieldLabel htmlFor="document-parent">
							{DOCUMENTS_COPY.parentDocument}
						</FieldLabel>
						<NativeSelect
							id="document-parent"
							onChange={onParentChange}
							value={parentId}
						>
							<NativeSelectOption value="">
								{DOCUMENTS_COPY.noParent}
							</NativeSelectOption>
							{parentChoices.map((item) => (
								<NativeSelectOption key={item.id} value={item.id}>
									{item.title}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="document-folder">
							{DOCUMENTS_COPY.folder}
						</FieldLabel>
						<NativeSelect
							id="document-folder"
							onChange={onFolderChange}
							value={folderId}
						>
							<NativeSelectOption value="">
								{DOCUMENTS_COPY.noFolder}
							</NativeSelectOption>
							{(folders.data ?? []).map((folder) => (
								<NativeSelectOption key={folder.id} value={folder.id}>
									{folder.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					{placementPreview.data?.status === "blocked" ? (
						<p role="alert">{placementError(placementPreview.data.reason)}</p>
					) : null}
					<Button type="submit">{DOCUMENTS_COPY.save}</Button>
				</form>
				<div className="mt-4 flex flex-col gap-2">
					{archivePreview.data?.status === "ok" &&
					archivePreview.data.childTitles.length > 0 ? (
						<p className="text-muted-foreground text-sm">
							{archivePreview.data.childTitles.join(", ")}
						</p>
					) : null}
					<Button onClick={onArchive} type="button">
						{selected.data.archived
							? DOCUMENTS_COPY.unarchive
							: DOCUMENTS_COPY.archive}
					</Button>
				</div>
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

function placementError(reason: string): string {
	if (reason === "depth-exceeded") {
		return DOCUMENTS_COPY.depthExceeded;
	}
	if (reason === "cross-scope-parent") {
		return DOCUMENTS_COPY.crossScopeParent;
	}
	return reason;
}
