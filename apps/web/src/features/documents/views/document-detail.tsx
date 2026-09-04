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
import { useCallback, useEffect, useRef, useState } from "react";

import FavoriteToggle from "@/features/favorites/views/favorite-toggle";
import PersonalReminderPanel from "@/features/personal-reminders/views/personal-reminder-panel";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";
import ConvertToTemplateForm from "../forms/convert-to-template-form";
import DocumentEditor from "../forms/document-editor";
import {
	clearDocumentEditorSession,
	getDocumentEditorSession,
	presentReconnectSave,
	rememberDocumentEditorSession,
} from "../forms/document-session";
import {
	DOCUMENT_TYPES,
	DOCUMENTS_COPY,
	type DocumentType,
	documentScopeFor,
	ORIGINAL_MERMAID_OUTCOMES,
	type OriginalMermaidOutcome,
} from "../forms/documents-copy";
import DocumentBodyView, { type DocumentBodyBlock } from "./document-body";
import DocumentConflictDraftPanel from "./document-conflict-draft";
import DocumentConvertPanel from "./document-convert-panel";
import DocumentPortabilityPanel from "./document-portability-panel";
import DocumentVersionHistory from "./document-version-history";

export default function DocumentDetail({
	archivedList,
	documentId,
	onMoved,
	onOpenSourceRecord,
	onSelect,
	projectId,
}: {
	archivedList?: boolean;
	documentId: string;
	onMoved?: () => void;
	onOpenSourceRecord?: (id: string) => void;
	onSelect?: (documentId: string) => void;
	projectId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave, shell } =
		useClientShell();
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [folderId, setFolderId] = useState<string>("");
	const [mermaidSource, setMermaidSource] = useState<string | null>(null);
	const [originalBlockOutcome, setOriginalBlockOutcome] =
		useState<OriginalMermaidOutcome>("independent");
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
		...orpc.documents.presentLive.queryOptions({
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

	const conflictDraft = useQuery(
		orpc.documents.conflictDraft.queryOptions({
			input: { documentId },
		})
	);
	const wasConnected = useRef(shell.connected);

	useEffect(() => {
		if (!selected.data) {
			return;
		}
		rememberDocumentEditorSession({
			baseRevision: selected.data.revision,
			body,
			documentId,
			lastSuccessfulSaveAt: shell.lastSuccessfulSaveAt,
			title,
			type,
		});
	}, [
		body,
		documentId,
		selected.data,
		shell.lastSuccessfulSaveAt,
		title,
		type,
	]);

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
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.conflictDraft.queryKey({
				input: { documentId },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.compareConflictDraft.queryKey({
				input: { documentId },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.versions.queryKey({
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
					await invalidateDocuments();
					setError(outcome.conflict);
				}
				clearDocumentEditorSession();
			},
		})
	);

	useEffect(() => {
		const justReconnected = !wasConnected.current && shell.connected;
		wasConnected.current = shell.connected;
		if (!(justReconnected && selected.data)) {
			return;
		}
		const attempt = presentReconnectSave({
			connected: true,
			session: getDocumentEditorSession(),
		});
		if (attempt.status !== "attempt") {
			return;
		}
		if (attempt.payload.documentId !== documentId) {
			return;
		}
		attemptOnlineWork("record-create", () =>
			save.mutateAsync({
				baseRevision: attempt.baseRevision,
				idempotencyKey: newIdempotencyKey(),
				payload: attempt.payload,
			})
		);
	}, [attemptOnlineWork, documentId, save, selected.data, shell.connected]);

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
	const onInsert = useCallback(
		(markdown: string) => {
			setBody((current) =>
				current.length === 0 ? markdown : `${current}\n\n${markdown}`
			);
			markUnsaved();
		},
		[markUnsaved]
	);
	const mermaidPreview = useQuery({
		...orpc.documents.previewConvertMermaid.queryOptions({
			input: {
				blockSource: mermaidSource ?? "",
				documentId,
				originalBlockOutcome,
				targetType: "Technical Architecture",
			},
		}),
		enabled: Boolean(selected.data && mermaidSource),
	});
	const convertMermaid = useMutation(
		orpc.documents.convertMermaid.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					if ("document" in outcome) {
						setBody(outcome.document.body);
					}
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.get.queryKey({
							input: { documentId },
						}),
					});
					recordSave();
					setError(null);
					setMermaidSource(null);
				}
			},
		})
	);
	const onConvertMermaid = useCallback((source: string) => {
		setOriginalBlockOutcome("independent");
		setMermaidSource(source);
	}, []);
	const onOriginalOutcomeChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setOriginalBlockOutcome(event.target.value as OriginalMermaidOutcome);
		},
		[]
	);
	const onApplyMermaid = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			const previewed = mermaidPreview.data;
			if (!(selected.data && mermaidSource && previewed?.status === "ok")) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				convertMermaid.mutateAsync({
					baseRevision: selected.data.revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						blockSource: mermaidSource,
						documentId,
						originalBlockOutcome,
						previewFingerprint: previewed.preview.fingerprint,
						targetType: "Technical Architecture",
					},
					previewAcknowledged: true,
				})
			);
		},
		[
			attemptOnlineWork,
			convertMermaid,
			documentId,
			markUnsaved,
			mermaidPreview.data,
			mermaidSource,
			originalBlockOutcome,
			selected.data,
		]
	);
	const onOpenLiveSource = useCallback(
		(id: string, kind: string) => {
			if (kind === "Work") {
				onOpenSourceRecord?.(id);
			}
		},
		[onOpenSourceRecord]
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
	const parentChoices = (listed.data ?? []).filter(
		(item) => item.id !== documentId
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
				<FavoriteToggle sourceId={selected.data.id} sourceType="Document" />
				<PersonalReminderPanel
					documentBody={selected.data.body}
					sourceId={selected.data.id}
					sourceType="Document"
				/>
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
							<DocumentEditor
								editable={shell.connected}
								onChange={setBody}
								value={body}
							/>
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
				{selected.data.childCards.length > 0 ? (
					<section aria-label={DOCUMENTS_COPY.card} className="mt-4">
						<h3 className="font-medium text-sm">{DOCUMENTS_COPY.card}</h3>
						<ul className="mt-2 flex flex-col gap-2">
							{selected.data.childCards.map((card) => (
								<li key={card.documentId}>
									<ChildCardButton card={card} onSelect={onSelect} />
								</li>
							))}
						</ul>
					</section>
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
				<div className="mt-4">
					<ConvertToTemplateForm
						documentId={documentId}
						projectId={projectId}
					/>
				</div>
				<DocumentPortabilityPanel
					documentId={documentId}
					onMoved={onMoved}
					projectId={projectId}
					revision={selected.data.revision}
				/>
				<div className="mt-6">
					<DocumentConvertPanel
						body={body}
						documentId={documentId}
						onInsert={onInsert}
						projectId={projectId}
						revision={selected.data.revision}
					/>
				</div>
				{mermaidPreview.data?.status === "ok" ? (
					<form
						className="mt-6 flex flex-col gap-2 border border-input p-3"
						onSubmit={onApplyMermaid}
					>
						<p>{mermaidPreview.data.preview.label}</p>
						<p>
							{DOCUMENTS_COPY.document} {mermaidPreview.data.preview.documentId}{" "}
							· {mermaidPreview.data.preview.documentRevision}
						</p>
						<p>{mermaidPreview.data.preview.blockLocation}</p>
						<p>
							{mermaidPreview.data.preview.targetType} ·{" "}
							{mermaidPreview.data.preview.origin} ·{" "}
							{mermaidPreview.data.preview.authorityMode}
						</p>
						{mermaidPreview.data.preview.unparseableItems.length > 0 ? (
							<ul>
								{mermaidPreview.data.preview.unparseableItems.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						) : null}
						<NativeSelect
							onChange={onOriginalOutcomeChange}
							value={originalBlockOutcome}
						>
							{ORIGINAL_MERMAID_OUTCOMES.map((outcome) => (
								<NativeSelectOption key={outcome} value={outcome}>
									{outcome}
								</NativeSelectOption>
							))}
						</NativeSelect>
						<Button type="submit">
							{DOCUMENTS_COPY.convertToTechnicalDiagram}
						</Button>
					</form>
				) : null}
				<div className="mt-6">
					<DocumentBodyView
						blocks={blocks}
						onBlockSourceChange={onBlockSourceChange}
						onConvertMermaid={onConvertMermaid}
						onOpenSourceRecord={onOpenLiveSource}
					/>
				</div>
				{conflictDraft.data ? (
					<DocumentConflictDraftPanel
						documentId={documentId}
						projectId={projectId}
						revision={selected.data.revision}
					/>
				) : null}
				<DocumentVersionHistory
					baseRevision={selected.data.revision}
					documentId={documentId}
					projectId={projectId}
				/>
			</CardContent>
		</Card>
	);
}

function ChildCardButton({
	card,
	onSelect,
}: {
	card: {
		documentId: string;
		imageUrl: string | null;
		preview: string;
		title: string;
	};
	onSelect?: (documentId: string) => void;
}) {
	const onClick = useCallback(() => {
		onSelect?.(card.documentId);
	}, [card.documentId, onSelect]);
	return (
		<button
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			{card.imageUrl ? (
				<img
					alt=""
					className="mb-1 max-h-24 w-full object-cover"
					height={96}
					src={card.imageUrl}
					width={320}
				/>
			) : null}
			<span className="font-medium">{card.title}</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">
				{card.preview}
			</span>
		</button>
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

function replaceFirst(haystack: string, needle: string, next: string): string {
	const index = haystack.indexOf(needle);
	if (index < 0) {
		return haystack;
	}
	return (
		haystack.slice(0, index) + next + haystack.slice(index + needle.length)
	);
}
