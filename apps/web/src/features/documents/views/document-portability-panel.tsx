import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
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
	descendantDocuments,
	documentScopeFor,
} from "../forms/documents-copy";

type DocumentScope =
	| { kind: "personal-wiki" }
	| { kind: "project"; projectId: string };

export default function DocumentPortabilityPanel({
	documentId,
	onMoved,
	projectId,
	revision,
}: {
	documentId: string;
	onMoved?: () => void;
	projectId: string | null;
	revision: number;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [cancelSurface, setCancelSurface] = useState(false);
	const [childIds, setChildIds] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [targetKey, setTargetKey] = useState("wiki");
	const projects = useQuery(orpc.projectShell.list.queryOptions());
	const listed = useQuery(
		orpc.documents.list.queryOptions({
			input: { scope: documentScopeFor(projectId) },
		})
	);
	const children = useMemo(
		() => descendantDocuments(listed.data ?? [], documentId),
		[documentId, listed.data]
	);
	const target = targetFromKey(targetKey);
	const preview = useQuery({
		...orpc.documents.previewMove.queryOptions({
			input: {
				childDocumentIds: childIds,
				documentId,
				target,
			},
		}),
		enabled: projectId !== null,
	});
	const onMoveSuccess = useCallback(
		async (outcome: { reason?: string; status: string }) => {
			if (outcome.status === "committed" || outcome.status === "replayed") {
				await queryClient.invalidateQueries();
				recordSave();
				setError(null);
				onMoved?.();
				return;
			}
			if (outcome.status === "rejected" && outcome.reason) {
				setError(outcome.reason);
			}
		},
		[onMoved, recordSave]
	);
	const move = useMutation(
		orpc.documents.move.mutationOptions({
			onSuccess: onMoveSuccess,
		})
	);
	const moveToWikiMutation = useMutation(
		orpc.personalWiki.move.mutationOptions({
			onSuccess: onMoveSuccess,
		})
	);
	const onCopySuccess = useCallback(
		async (outcome: { reason?: string; status: string }) => {
			if (outcome.status === "committed" || outcome.status === "replayed") {
				await queryClient.invalidateQueries();
				recordSave();
				setError(null);
				return;
			}
			if (outcome.status === "rejected" && outcome.reason) {
				setError(outcome.reason);
			}
		},
		[recordSave]
	);
	const copy = useMutation(
		orpc.documents.copy.mutationOptions({
			onSuccess: onCopySuccess,
		})
	);
	const copyIntoWiki = useMutation(
		orpc.personalWiki.copy.mutationOptions({
			onSuccess: onCopySuccess,
		})
	);
	const onTargetChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setTargetKey(event.target.value);
		},
		[]
	);
	const onCancelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setCancelSurface(event.target.checked);
	}, []);
	const onChildToggle = useCallback((childId: string, checked: boolean) => {
		setChildIds((current) =>
			checked ? [...current, childId] : current.filter((id) => id !== childId)
		);
	}, []);
	const onMove = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (projectId === null) {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				target.kind === "personal-wiki"
					? moveToWikiMutation.mutateAsync({
							baseRevision: revision,
							idempotencyKey: newIdempotencyKey(),
							payload: {
								cancelExternalSurfaces: cancelSurface,
								childDocumentIds: childIds,
								documentId,
							},
						})
					: move.mutateAsync({
							baseRevision: revision,
							idempotencyKey: newIdempotencyKey(),
							payload: {
								cancelExternalSurfaces: cancelSurface,
								childDocumentIds: childIds,
								documentId,
								target,
							},
						})
			);
		},
		[
			attemptOnlineWork,
			cancelSurface,
			childIds,
			documentId,
			markUnsaved,
			move,
			moveToWikiMutation,
			projectId,
			revision,
			target,
		]
	);
	const onCopy = useCallback(() => {
		setError(null);
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			projectId === null
				? copy.mutateAsync({
						idempotencyKey: newIdempotencyKey(),
						payload: { documentId },
					})
				: copyIntoWiki.mutateAsync({
						idempotencyKey: newIdempotencyKey(),
						payload: { documentId },
					})
		);
	}, [
		attemptOnlineWork,
		copy,
		copyIntoWiki,
		documentId,
		markUnsaved,
		projectId,
	]);
	const onExport = useCallback(
		async (format: "markdown" | "pdf") => {
			setError(null);
			const result = await queryClient.fetchQuery(
				orpc.documents.export.queryOptions({
					input: { documentId, format },
				})
			);
			if (result.status !== "ok") {
				setError(result.reason);
				return;
			}
			if (result.format === "markdown") {
				downloadFile(`${documentId}.md`, "text/markdown", result.markdown);
				return;
			}
			downloadFile(
				`${documentId}.pdf`,
				"application/pdf",
				bytesFromExport(result.pdf)
			);
		},
		[documentId]
	);
	const onExportMarkdown = useCallback(() => {
		onExport("markdown").catch(() => undefined);
	}, [onExport]);
	const onExportPdf = useCallback(() => {
		onExport("pdf").catch(() => undefined);
	}, [onExport]);

	return (
		<section className="mt-6 flex flex-col gap-3">
			{projectId ? (
				<form className="flex flex-col gap-3" onSubmit={onMove}>
					<Field>
						<FieldLabel htmlFor="document-move-target">
							{DOCUMENTS_COPY.move}
						</FieldLabel>
						<NativeSelect
							id="document-move-target"
							onChange={onTargetChange}
							value={targetKey}
						>
							<NativeSelectOption value="wiki">
								{DOCUMENTS_COPY.personalWiki}
							</NativeSelectOption>
							{(projects.data ?? [])
								.filter((item) => item.id !== projectId)
								.map((item) => (
									<NativeSelectOption key={item.id} value={item.id}>
										{item.name}
									</NativeSelectOption>
								))}
						</NativeSelect>
					</Field>
					{children.map((child) => (
						<MoveChildChoice
							checked={childIds.includes(child.id)}
							id={child.id}
							key={child.id}
							onToggle={onChildToggle}
							title={child.title}
						/>
					))}
					{preview.data?.status === "ok" ? (
						<p className="text-muted-foreground text-sm">
							{[
								`${DOCUMENTS_COPY.preview}: ${String(preview.data.selectedDocumentIds.length)} ${DOCUMENTS_COPY.document}`,
								preview.data.brokenReferences
									.map((item) => item.title)
									.join(", "),
								preview.data.publishEffect.cancelRequired
									? DOCUMENTS_COPY.cancelExternalSurface
									: "",
							]
								.filter((part) => String(part).length > 0)
								.join(" · ")}
						</p>
					) : null}
					{preview.data?.status === "ok" &&
					preview.data.publishEffect.cancelRequired ? (
						<label className="flex items-center gap-2 text-sm">
							<input
								checked={cancelSurface}
								onChange={onCancelChange}
								type="checkbox"
							/>
							{DOCUMENTS_COPY.cancelExternalSurface}
						</label>
					) : null}
					<Button type="submit">{DOCUMENTS_COPY.move}</Button>
				</form>
			) : null}
			<Button onClick={onCopy} type="button">
				{DOCUMENTS_COPY.copy}
			</Button>
			<div className="flex flex-wrap gap-2">
				<Button onClick={onExportMarkdown} type="button">
					{`${DOCUMENTS_COPY.export} ${DOCUMENTS_COPY.markdown}`}
				</Button>
				<Button onClick={onExportPdf} type="button">
					{`${DOCUMENTS_COPY.export} ${DOCUMENTS_COPY.pdf}`}
				</Button>
			</div>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function MoveChildChoice({
	checked,
	id,
	onToggle,
	title,
}: {
	checked: boolean;
	id: string;
	onToggle: (childId: string, checked: boolean) => void;
	title: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onToggle(id, event.target.checked);
		},
		[id, onToggle]
	);
	return (
		<label className="flex items-center gap-2 text-sm">
			<input checked={checked} onChange={onChange} type="checkbox" />
			{title}
		</label>
	);
}

function targetFromKey(key: string): DocumentScope {
	if (key === "wiki") {
		return { kind: "personal-wiki" };
	}
	return { kind: "project", projectId: key };
}

function bytesFromExport(
	pdf: Uint8Array | number[] | { data?: number[] }
): Uint8Array {
	if (pdf instanceof Uint8Array) {
		return new Uint8Array(pdf);
	}
	if (Array.isArray(pdf)) {
		return Uint8Array.from(pdf);
	}
	return Uint8Array.from(pdf.data ?? []);
}

function downloadFile(
	filename: string,
	type: string,
	body: string | Uint8Array
): void {
	const blob = new Blob([body as BlobPart], { type });
	const href = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.download = filename;
	link.href = href;
	link.click();
	URL.revokeObjectURL(href);
}
