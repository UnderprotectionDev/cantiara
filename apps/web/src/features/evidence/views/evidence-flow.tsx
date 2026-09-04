import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useId, useState } from "react";

import {
	EVIDENCE_COPY,
	EVIDENCE_SOURCE_KINDS,
	type EvidenceFlowTargetKind,
	type EvidenceSourceKind,
} from "@/features/evidence/forms/evidence-copy";
import { orpc } from "@/utils/orpc";

export default function EvidenceFlow({
	projectId,
	targetId,
	targetKind,
}: {
	projectId: string;
	targetId: string;
	targetKind: EvidenceFlowTargetKind;
}) {
	const headingId = useId();
	const filterId = useId();
	const [sourceKind, setSourceKind] = useState<EvidenceSourceKind | "">("");
	const flow = useQuery(
		orpc.evidence.listFlow.queryOptions({
			input: {
				targetId,
				targetKind,
				...(sourceKind ? { sourceKind } : {}),
			},
		})
	);
	const onFilter = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		const { value } = event.target;
		setSourceKind(value === "" ? "" : (value as EvidenceSourceKind));
	}, []);
	const rows = flow.data?.rows ?? [];
	if (rows.length === 0 && sourceKind === "" && !flow.isFetching) {
		return null;
	}
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<h3 className="font-medium text-sm" id={headingId}>
				{EVIDENCE_COPY.evidenceFlow}
			</h3>
			<NativeSelect
				aria-labelledby={headingId}
				id={filterId}
				onChange={onFilter}
				value={sourceKind}
			>
				<NativeSelectOption value="">—</NativeSelectOption>
				{EVIDENCE_SOURCE_KINDS.map((kind) => (
					<NativeSelectOption key={kind} value={kind}>
						{kind}
					</NativeSelectOption>
				))}
			</NativeSelect>
			<ol className="flex flex-col gap-3">
				{rows.map((row) => (
					<li className="flex flex-col gap-1" key={row.pinId}>
						<p className="text-muted-foreground text-sm">
							{row.sourceKind}{" "}
							<time dateTime={toStamp(row.eventTime)}>
								{toStamp(row.eventTime)}
							</time>
						</p>
						{row.presentation === "broken" ? (
							<p className="text-muted-foreground text-sm">
								{row.brokenReason}
							</p>
						) : (
							<>
								{row.rangeText ? (
									<p className="text-sm">{row.rangeText}</p>
								) : null}
								{row.sourceStatusLabel ? (
									<p className="text-muted-foreground text-sm">
										{row.sourceStatusLabel}
									</p>
								) : null}
								<OpenSourceRecordLink
									label={row.openSourceRecord}
									projectId={projectId}
									sourceId={row.sourceId}
									sourceKind={row.sourceKind}
								/>
							</>
						)}
						<p className="text-muted-foreground text-sm">
							<time dateTime={toStamp(row.relationTime)}>
								{toStamp(row.relationTime)}
							</time>
						</p>
						<p className="text-muted-foreground text-sm">
							{EVIDENCE_COPY.evidenceRole}: {row.role}
						</p>
						{row.founderInterpretation ? (
							<p className="text-sm">
								{EVIDENCE_COPY.founderInterpretation}:{" "}
								{row.founderInterpretation}
							</p>
						) : null}
						{row.originLocation?.missingLabel ? (
							<p className="text-muted-foreground text-sm">
								{EVIDENCE_COPY.originLocation}:{" "}
								{row.originLocation.missingLabel}
							</p>
						) : null}
					</li>
				))}
			</ol>
		</section>
	);
}

function OpenSourceRecordLink({
	label,
	projectId,
	sourceId,
	sourceKind,
}: {
	label: string | null;
	projectId: string;
	sourceId: string;
	sourceKind: string;
}) {
	if (!label) {
		return null;
	}
	if (sourceKind !== "Source") {
		return <p className="text-muted-foreground text-sm">{label}</p>;
	}
	return (
		<p className="text-muted-foreground text-sm">
			<a
				href={`/projects/${projectId}?source=${encodeURIComponent(sourceId)}#source`}
			>
				{label}
			</a>
		</p>
	);
}

function toStamp(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value);
	}
	return date.toISOString();
}
