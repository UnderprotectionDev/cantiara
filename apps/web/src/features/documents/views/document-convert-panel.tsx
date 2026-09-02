import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DOCUMENTS_COPY } from "../forms/documents-copy";

const LIVE_SECTION_SOURCE_SPLIT = /\s+/;

export default function DocumentConvertPanel({
	body,
	documentId,
	onInsert,
	projectId,
	revision,
}: {
	body: string;
	documentId: string;
	onInsert: (markdown: string) => void;
	projectId: string | null;
	revision: number;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [selection, setSelection] = useState("");
	const [workId, setWorkId] = useState("");
	const [sectionRef, setSectionRef] = useState("");
	const works = useQuery({
		...orpc.workLifecycle.list.queryOptions({
			input: { projectId: projectId ?? "" },
		}),
		enabled: Boolean(projectId),
	});

	const onSelectionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setSelection(event.target.value);
		},
		[]
	);
	const onWorkChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setWorkId(event.target.value);
	}, []);
	const onSectionChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setSectionRef(event.target.value);
		},
		[]
	);
	const insertWork = useCallback(() => {
		if (!workId) {
			return;
		}
		onInsert(`\`\`\`live-work\n${workId}\n\`\`\``);
	}, [onInsert, workId]);
	const insertSection = useCallback(() => {
		const [sourceDocumentId, sectionId] = sectionRef
			.trim()
			.split(LIVE_SECTION_SOURCE_SPLIT, 2);
		if (!(sourceDocumentId && sectionId)) {
			return;
		}
		onInsert(`\`\`\`live-section\n${sourceDocumentId} ${sectionId}\n\`\`\``);
	}, [onInsert, sectionRef]);

	const previewSelection = useQuery({
		...orpc.documents.previewConvertSelection.queryOptions({
			input: {
				documentId,
				projectId: projectId ?? "",
				recordKind: "Work",
				selectedText: selection,
			},
		}),
		enabled: Boolean(projectId && selection.trim()),
	});
	const convertSelection = useMutation(
		orpc.documents.convertSelection.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.workLifecycle.list.queryKey({
							input: { projectId: projectId ?? "" },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				setError(
					outcome.status === "rejected" ? outcome.reason : outcome.conflict
				);
			},
		})
	);
	const previewList = useQuery({
		...orpc.documents.previewConvertList.queryOptions({
			input: {
				documentId,
				projectId: projectId ?? "",
				selectedText: selection,
			},
		}),
		enabled: Boolean(projectId && selection.trim().startsWith("-")),
	});
	const convertList = useMutation(
		orpc.documents.convertList.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.workLifecycle.list.queryKey({
							input: { projectId: projectId ?? "" },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				setError(
					outcome.status === "rejected" ? outcome.reason : outcome.conflict
				);
			},
		})
	);
	const pin = useMutation(
		orpc.documents.pinVersionPinnedEvidence.mutationOptions({
			onSuccess: (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					recordSave();
					setError(null);
					return;
				}
				setError(
					outcome.status === "rejected" ? outcome.reason : outcome.conflict
				);
			},
		})
	);

	const onConvertRecord = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			const previewed = previewSelection.data;
			if (previewed?.status !== "ok" || !projectId) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				convertSelection.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						documentId,
						previewFingerprint: previewed.preview.fingerprint,
						projectId,
						recordKind: "Work",
						selectedText: selection,
					},
					previewAcknowledged: true,
				})
			);
		},
		[
			attemptOnlineWork,
			convertSelection,
			documentId,
			markUnsaved,
			previewSelection.data,
			projectId,
			revision,
			selection,
		]
	);
	const onConvertBulk = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			const previewed = previewList.data;
			if (previewed?.status !== "ok" || !projectId) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				convertList.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						candidates: previewed.preview.candidates,
						documentId,
						previewFingerprint: previewed.preview.fingerprint,
						projectId,
						selectedText: selection,
					},
					previewAcknowledged: true,
				})
			);
		},
		[
			attemptOnlineWork,
			convertList,
			documentId,
			markUnsaved,
			previewList.data,
			projectId,
			revision,
			selection,
		]
	);
	const onPin = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			if (!workId) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				pin.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						documentId,
						selectedText: selection,
						targetId: workId,
						targetKind: "Work",
					},
					previewAcknowledged: true,
				})
			);
		},
		[
			attemptOnlineWork,
			documentId,
			markUnsaved,
			pin,
			revision,
			selection,
			workId,
		]
	);

	return (
		<div className="flex flex-col gap-4 border border-input p-3">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="document-selection">
						{DOCUMENTS_COPY.body}
					</FieldLabel>
					<Textarea
						id="document-selection"
						onChange={onSelectionChange}
						value={selection}
					/>
				</Field>
			</FieldGroup>
			{previewSelection.data?.status === "ok" ? (
				<form className="flex flex-col gap-2" onSubmit={onConvertRecord}>
					<p>
						{previewSelection.data.preview.label}:{" "}
						{previewSelection.data.preview.title} ·{" "}
						{previewSelection.data.preview.recordKind}
					</p>
					<Button type="submit">{DOCUMENTS_COPY.convertToRecord}</Button>
				</form>
			) : null}
			{previewList.data?.status === "ok" ? (
				<form className="flex flex-col gap-2" onSubmit={onConvertBulk}>
					<p>{previewList.data.preview.label}</p>
					<ul>
						{previewList.data.preview.candidates.map((candidate) => (
							<li key={candidate.title}>
								{candidate.title} · {candidate.type}
							</li>
						))}
					</ul>
					<Button type="submit">{DOCUMENTS_COPY.convertInBulk}</Button>
				</form>
			) : null}
			<form className="flex flex-col gap-2" onSubmit={onPin}>
				<p>{DOCUMENTS_COPY.pinEvidence}</p>
				<WorkPicker
					onChange={onWorkChange}
					value={workId}
					works={works.data ?? []}
				/>
				<Button type="submit">{DOCUMENTS_COPY.pinEvidence}</Button>
			</form>
			<div className="flex flex-col gap-2">
				<p>{DOCUMENTS_COPY.liveWorkBlock}</p>
				<WorkPicker
					onChange={onWorkChange}
					value={workId}
					works={works.data ?? []}
				/>
				<Button onClick={insertWork} type="button" variant="outline">
					{DOCUMENTS_COPY.liveWorkBlock}
				</Button>
			</div>
			<div className="flex flex-col gap-2">
				<p>{DOCUMENTS_COPY.readOnlyLiveSection}</p>
				<Input onChange={onSectionChange} value={sectionRef} />
				<Button onClick={insertSection} type="button" variant="outline">
					{DOCUMENTS_COPY.readOnlyLiveSection}
				</Button>
			</div>
			{error ? <p role="alert">{error}</p> : null}
			<p className="sr-only">{body}</p>
		</div>
	);
}

function WorkPicker({
	onChange,
	value,
	works,
}: {
	onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
	value: string;
	works: Array<{ id: string; key: string; title: string }>;
}) {
	return (
		<NativeSelect onChange={onChange} value={value}>
			<NativeSelectOption value="">—</NativeSelectOption>
			{works.map((work) => (
				<NativeSelectOption key={work.id} value={work.id}>
					{work.key} {work.title}
				</NativeSelectOption>
			))}
		</NativeSelect>
	);
}
