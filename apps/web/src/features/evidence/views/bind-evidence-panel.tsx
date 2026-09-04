import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import {
	CONVERT_RECORD_KINDS,
	type ConvertRecordKind,
	convertKindToEvidenceTargetKind,
	EVIDENCE_COPY,
} from "@/features/evidence/forms/evidence-copy";
import { EvidenceRoleFields } from "@/features/evidence/views/evidence-role-fields";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function BindEvidencePanel({
	projectId,
	sourceId,
	sourceKind,
	sourceVersionId,
	sourceText,
}: {
	projectId: string;
	sourceId: string;
	sourceKind: "Source" | "Document";
	sourceText: string;
	sourceVersionId: string;
}) {
	const [selectedText, setSelectedText] = useState("");
	const [rangeStart, setRangeStart] = useState<number | undefined>(undefined);
	const [rangeEnd, setRangeEnd] = useState<number | undefined>(undefined);
	const [targetId, setTargetId] = useState("");
	const [targetKind, setTargetKind] = useState<ConvertRecordKind>("Work");
	const [recordKind, setRecordKind] = useState<ConvertRecordKind>("Work");
	const [error, setError] = useState<string | null>(null);
	const works = useQuery(
		orpc.workLifecycle.list.queryOptions({ input: { projectId } })
	);
	const decisions = useQuery(
		orpc.decisions.list.queryOptions({ input: { projectId } })
	);
	const risks = useQuery(
		orpc.risks.list.queryOptions({ input: { projectId } })
	);
	const assumptions = useQuery(
		orpc.uncertaintyRecords.listAssumptions.queryOptions({
			input: { projectId },
		})
	);
	const questions = useQuery(
		orpc.uncertaintyRecords.listOpenQuestions.queryOptions({
			input: { projectId },
		})
	);
	const pins = useQuery(
		orpc.evidence.listOnSource.queryOptions({
			input: { sourceId, sourceKind },
		})
	);
	const bindTargets = useMemo(() => {
		const rows: Array<{
			id: string;
			kind: ConvertRecordKind;
			label: string;
		}> = [];
		for (const work of works.data ?? []) {
			rows.push({
				id: work.id,
				kind: "Work",
				label: `${work.key} ${work.title}`,
			});
		}
		for (const decision of decisions.data ?? []) {
			rows.push({
				id: decision.id,
				kind: "Decision",
				label: decision.title,
			});
		}
		for (const risk of risks.data ?? []) {
			rows.push({ id: risk.id, kind: "Risk", label: risk.title });
		}
		for (const assumption of assumptions.data ?? []) {
			rows.push({
				id: assumption.id,
				kind: "Assumption",
				label: assumption.statement,
			});
		}
		for (const question of questions.data ?? []) {
			rows.push({
				id: question.id,
				kind: "Open Question",
				label: question.title,
			});
		}
		return rows;
	}, [
		assumptions.data,
		decisions.data,
		questions.data,
		risks.data,
		works.data,
	]);
	const versionHighlights = useMemo(
		() =>
			(pins.data ?? [])
				.filter(
					(pin) =>
						pin.contentAccess === "open" &&
						pin.sourceVersionId === sourceVersionId
				)
				.map((pin) => pin.highlight),
		[pins.data, sourceVersionId]
	);
	const previewBind = useQuery({
		...orpc.evidence.previewBind.queryOptions({
			input: {
				rangeEnd,
				rangeStart,
				selectedText,
				sourceId,
				sourceKind,
				sourceVersionId,
				targetId,
				targetKind: convertKindToEvidenceTargetKind(targetKind),
			},
		}),
		enabled: Boolean(selectedText && targetId),
	});
	const bind = useMutation(
		orpc.evidence.bind.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.evidence.listOnSource.queryKey({
							input: { sourceId, sourceKind },
						}),
					});
					setError(null);
					return;
				}
				setError(
					outcome.status === "rejected" ? outcome.reason : outcome.conflict
				);
			},
		})
	);
	const previewConvert = useQuery({
		...orpc.evidence.previewConvert.queryOptions({
			input: {
				projectId,
				rangeEnd,
				rangeStart,
				recordKind,
				selectedText,
				sourceId,
				sourceKind,
				sourceVersionId,
			},
		}),
		enabled: Boolean(selectedText),
	});
	const convert = useMutation(
		orpc.evidence.convert.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.workLifecycle.list.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.evidence.listOnSource.queryKey({
							input: { sourceId, sourceKind },
						}),
					});
					setError(null);
					return;
				}
				setError(
					outcome.status === "rejected" ? outcome.reason : outcome.conflict
				);
			},
		})
	);
	const onSelectRange = useCallback(
		(event: MouseEvent<HTMLParagraphElement>) => {
			const range = selectedRangeInElement(event.currentTarget);
			if (!range) {
				return;
			}
			setSelectedText(range.text);
			setRangeStart(range.start);
			setRangeEnd(range.end);
		},
		[]
	);
	const onTarget = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		const [kind, id] = event.target.value.split("::");
		if (!(kind && id)) {
			setTargetId("");
			return;
		}
		setTargetKind(kind as ConvertRecordKind);
		setTargetId(id);
	}, []);
	const onKind = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRecordKind(event.target.value as ConvertRecordKind);
	}, []);
	const onBind = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			const previewed = previewBind.data;
			if (previewed?.status !== "ok") {
				return;
			}
			bind.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					previewFingerprint: previewed.preview.fingerprint,
					rangeEnd,
					rangeStart,
					selectedText,
					sourceId,
					sourceKind,
					sourceVersionId,
					targetId,
					targetKind: convertKindToEvidenceTargetKind(targetKind),
				},
				previewAcknowledged: true,
			});
		},
		[
			bind,
			previewBind.data,
			rangeEnd,
			rangeStart,
			selectedText,
			sourceId,
			sourceKind,
			sourceVersionId,
			targetId,
			targetKind,
		]
	);
	const onConvert = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			const previewed = previewConvert.data;
			if (previewed?.status !== "ok") {
				return;
			}
			convert.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					previewFingerprint: previewed.preview.fingerprint,
					projectId,
					rangeEnd,
					rangeStart,
					recordKind,
					selectedText,
					sourceId,
					sourceKind,
					sourceVersionId,
				},
				previewAcknowledged: true,
			});
		},
		[
			convert,
			previewConvert.data,
			projectId,
			rangeEnd,
			rangeStart,
			recordKind,
			selectedText,
			sourceId,
			sourceKind,
			sourceVersionId,
		]
	);

	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">
				{EVIDENCE_COPY.versionPinnedEvidence}
			</h3>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="evidence-source-body">
						{EVIDENCE_COPY.versionPinnedEvidence}
					</FieldLabel>
					<HighlightedText
						body={sourceText}
						id="evidence-source-body"
						onMouseUp={onSelectRange}
						ranges={versionHighlights}
					/>
				</Field>
			</FieldGroup>
			{selectedText ? (
				<p className="text-muted-foreground text-sm">{selectedText}</p>
			) : null}
			{(pins.data ?? []).map((pin) => (
				<div className="flex flex-col gap-1" key={pin.id}>
					<p className="text-muted-foreground text-sm">
						{pin.role} · {pin.rangeText} · {pin.openSourceRecord} ·{" "}
						{pin.backlinks.map((link) => link.targetTitle).join(", ")}
						{pin.originLocation?.missing
							? ` · ${EVIDENCE_COPY.originLocation} ${EVIDENCE_COPY.sourceElementNoLongerExists}`
							: null}
						{pin.newerVersionExists
							? ` · ${EVIDENCE_COPY.newerVersionExists}`
							: null}
					</p>
					{pin.newerVersionExists ? (
						<RebindForm
							pinId={pin.id}
							sourceId={sourceId}
							sourceKind={sourceKind}
						/>
					) : null}
					<EvidenceRoleFields
						founderInterpretation={pin.founderInterpretation}
						pinId={pin.id}
						role={pin.role}
						sourceId={sourceId}
						sourceKind={sourceKind}
						targetId={pin.targetId}
						targetKind={pin.targetKind}
					/>
				</div>
			))}
			<form className="flex flex-col gap-2" onSubmit={onBind}>
				<Field>
					<FieldLabel htmlFor="evidence-target">
						{EVIDENCE_COPY.bindAsEvidenceToExistingRecord}
					</FieldLabel>
					<NativeSelect
						id="evidence-target"
						onChange={onTarget}
						value={targetId ? `${targetKind}::${targetId}` : ""}
					>
						<NativeSelectOption value="">—</NativeSelectOption>
						{bindTargets.map((target) => (
							<NativeSelectOption
								key={`${target.kind}::${target.id}`}
								value={`${target.kind}::${target.id}`}
							>
								{target.kind} · {target.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				{previewBind.data?.status === "ok" ? (
					<p>
						{previewBind.data.preview.label}:{" "}
						{previewBind.data.preview.targetTitle} ·{" "}
						{previewBind.data.preview.versionPinnedEvidence} · v
						{previewBind.data.preview.sourceVersionNumber} ·{" "}
						{previewBind.data.preview.textRange.start}–
						{previewBind.data.preview.textRange.end}
					</p>
				) : null}
				<Button type="submit">
					{EVIDENCE_COPY.bindAsEvidenceToExistingRecord}
				</Button>
			</form>
			<form className="flex flex-col gap-2" onSubmit={onConvert}>
				<Field>
					<FieldLabel htmlFor="evidence-convert-kind">
						{EVIDENCE_COPY.convertToNewRecordAndBind}
					</FieldLabel>
					<NativeSelect
						id="evidence-convert-kind"
						onChange={onKind}
						value={recordKind}
					>
						{CONVERT_RECORD_KINDS.map((kind) => (
							<NativeSelectOption key={kind} value={kind}>
								{kind}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				{previewConvert.data?.status === "ok" ? (
					<p>
						{previewConvert.data.preview.label}:{" "}
						{previewConvert.data.preview.title} ·{" "}
						{previewConvert.data.preview.recordKind}
					</p>
				) : null}
				<Button type="submit">{EVIDENCE_COPY.convertToNewRecordAndBind}</Button>
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function RebindForm({
	pinId,
	sourceId,
	sourceKind,
}: {
	pinId: string;
	sourceId: string;
	sourceKind: "Source" | "Document";
}) {
	const previewRebind = useQuery({
		...orpc.evidence.previewRebind.queryOptions({
			input: { pinId },
		}),
		enabled: Boolean(pinId),
	});
	const rebind = useMutation(
		orpc.evidence.rebind.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.evidence.listOnSource.queryKey({
						input: { sourceId, sourceKind },
					}),
				});
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			if (previewRebind.data?.status !== "ok") {
				return;
			}
			rebind.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					pinId,
					previewFingerprint: previewRebind.data.preview.fingerprint,
				},
				previewAcknowledged: true,
			});
		},
		[pinId, previewRebind.data, rebind]
	);
	if (previewRebind.data?.status !== "ok") {
		return null;
	}
	return (
		<form className="flex flex-col gap-2" onSubmit={onSubmit}>
			<p>{previewRebind.data.preview.label}</p>
			<Button type="submit">{EVIDENCE_COPY.newerVersionExists}</Button>
		</form>
	);
}

function HighlightedText({
	body,
	id,
	onMouseUp,
	ranges,
}: {
	body: string;
	id: string;
	onMouseUp: (event: MouseEvent<HTMLParagraphElement>) => void;
	ranges: Array<{ end: number; start: number }>;
}) {
	const parts: ReactNode[] = [];
	let cursor = 0;
	const marks = [...ranges]
		.filter(
			(range) =>
				range.start >= 0 && range.end <= body.length && range.end > range.start
		)
		.sort((left, right) => left.start - right.start);
	for (const mark of marks) {
		if (mark.start < cursor) {
			continue;
		}
		if (mark.start > cursor) {
			parts.push(body.slice(cursor, mark.start));
		}
		parts.push(
			<mark key={`${mark.start}-${mark.end}`}>
				{body.slice(mark.start, mark.end)}
			</mark>
		);
		cursor = mark.end;
	}
	if (cursor < body.length) {
		parts.push(body.slice(cursor));
	}
	return (
		// Selecting a text range in the source body is the bind control.
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: range selection is not a click target
		<p className="whitespace-pre-wrap text-sm" id={id} onMouseUp={onMouseUp}>
			{parts}
		</p>
	);
}

function selectedRangeInElement(element: HTMLElement): {
	end: number;
	start: number;
	text: string;
} | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
		return null;
	}
	const range = selection.getRangeAt(0);
	if (!element.contains(range.commonAncestorContainer)) {
		return null;
	}
	const before = document.createRange();
	before.selectNodeContents(element);
	before.setEnd(range.startContainer, range.startOffset);
	const start = before.toString().length;
	const text = range.toString();
	if (text.length === 0) {
		return null;
	}
	return { end: start + text.length, start, text };
}
