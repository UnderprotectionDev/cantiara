import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import {
	CONVERT_RECORD_KINDS,
	type ConvertRecordKind,
	EVIDENCE_COPY,
} from "@/features/evidence/forms/evidence-copy";
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
	const [targetId, setTargetId] = useState("");
	const [recordKind, setRecordKind] = useState<ConvertRecordKind>("Work");
	const [error, setError] = useState<string | null>(null);
	const works = useQuery(
		orpc.workLifecycle.list.queryOptions({ input: { projectId } })
	);
	const pins = useQuery(
		orpc.evidence.listOnSource.queryOptions({
			input: { sourceId, sourceKind },
		})
	);
	const highlight = useMemo(() => {
		const pin = pins.data?.[0];
		if (!pin || pin.contentAccess === "redacted") {
			return sourceText;
		}
		const { start, end } = pin.highlight;
		if (start < 0 || end > sourceText.length || end <= start) {
			return sourceText;
		}
		return (
			sourceText.slice(0, start) +
			sourceText.slice(start, end) +
			sourceText.slice(end)
		);
	}, [pins.data, sourceText]);
	const previewBind = useQuery({
		...orpc.evidence.previewBind.queryOptions({
			input: {
				selectedText,
				sourceId,
				sourceKind,
				sourceVersionId,
				targetId,
				targetKind: "Work",
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
	const previewRebind = useQuery({
		...orpc.evidence.previewRebind.queryOptions({
			input: { pinId: pins.data?.[0]?.id ?? "" },
		}),
		enabled: Boolean(pins.data?.[0]?.newerVersionExists),
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
	const onSelection = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
		setSelectedText(event.target.value);
	}, []);
	const onTarget = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setTargetId(event.target.value);
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
					selectedText,
					sourceId,
					sourceKind,
					sourceVersionId,
					targetId,
					targetKind: "Work",
				},
				previewAcknowledged: true,
			});
		},
		[
			bind,
			previewBind.data,
			selectedText,
			sourceId,
			sourceKind,
			sourceVersionId,
			targetId,
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
			recordKind,
			selectedText,
			sourceId,
			sourceKind,
			sourceVersionId,
		]
	);
	const onRebind = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			const previewed = previewRebind.data;
			const pinId = pins.data?.[0]?.id;
			if (previewed?.status !== "ok" || !pinId) {
				return;
			}
			rebind.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					pinId,
					previewFingerprint: previewed.preview.fingerprint,
				},
				previewAcknowledged: true,
			});
		},
		[pins.data, previewRebind.data, rebind]
	);

	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">
				{EVIDENCE_COPY.versionPinnedEvidence}
			</h3>
			<p className="whitespace-pre-wrap text-sm">
				{pins.data?.[0] && pins.data[0].contentAccess === "open" ? (
					<>
						{sourceText.slice(0, pins.data[0].highlight.start)}
						<mark>
							{sourceText.slice(
								pins.data[0].highlight.start,
								pins.data[0].highlight.end
							)}
						</mark>
						{sourceText.slice(pins.data[0].highlight.end)}
					</>
				) : (
					highlight
				)}
			</p>
			{pins.data?.map((pin) => (
				<p className="text-muted-foreground text-sm" key={pin.id}>
					{pin.openSourceRecord} ·{" "}
					{pin.backlinks.map((link) => link.targetTitle).join(", ")}
					{pin.originLocation?.missing
						? ` · ${EVIDENCE_COPY.originLocation} ${EVIDENCE_COPY.sourceElementNoLongerExists}`
						: null}
					{pin.newerVersionExists
						? ` · ${EVIDENCE_COPY.newerVersionExists}`
						: null}
				</p>
			))}
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="evidence-selection">
						{EVIDENCE_COPY.versionPinnedEvidence}
					</FieldLabel>
					<Textarea
						id="evidence-selection"
						onChange={onSelection}
						value={selectedText}
					/>
				</Field>
			</FieldGroup>
			<form className="flex flex-col gap-2" onSubmit={onBind}>
				<Field>
					<FieldLabel htmlFor="evidence-target">
						{EVIDENCE_COPY.target}
					</FieldLabel>
					<NativeSelect
						id="evidence-target"
						onChange={onTarget}
						value={targetId}
					>
						<NativeSelectOption value="">—</NativeSelectOption>
						{(works.data ?? []).map((work) => (
							<NativeSelectOption key={work.id} value={work.id}>
								{work.key} {work.title}
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
			{previewRebind.data?.status === "ok" ? (
				<form className="flex flex-col gap-2" onSubmit={onRebind}>
					<p>{previewRebind.data.preview.label}</p>
					<Button type="submit">{EVIDENCE_COPY.newerVersionExists}</Button>
				</form>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}
