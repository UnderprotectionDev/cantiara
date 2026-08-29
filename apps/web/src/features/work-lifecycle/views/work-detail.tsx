import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

import WorkBlockersPanel from "@/features/blockers/views/work-blockers-panel";
import CustomFieldValuesEditor from "@/features/custom-fields/forms/custom-field-values-editor";
import RelationsPanel from "@/features/relations/views/relations-panel";
import UsageLinksPanel from "@/features/relations/views/usage-links-panel";
import UsedInPanel from "@/features/relations/views/used-in-panel";
import WorkTagPicker from "@/features/tags/views/work-tag-picker";
import WorkChecklistPanel from "@/features/work-checklists/views/work-checklist-panel";
import WorkContextCard from "@/features/work-context/views/work-context-card";

import ArchiveWorkForm from "../forms/archive-work-form";
import ChangeWorkStatusForm from "../forms/change-work-status-form";
import ChangeWorkTypeForm from "../forms/change-work-type-form";
import FeatureInclusionPanel from "../forms/feature-inclusion-panel";
import MergeWorkForm, { MergeUndoButton } from "../forms/merge-work-form";
import RecreateWorkForm from "../forms/recreate-work-form";
import ReopenWorkForm from "../forms/reopen-work-form";
import {
	type ClosureResult,
	WORK_LIFECYCLE_COPY,
	type WorkStatus,
	type WorkType,
} from "../forms/work-lifecycle-copy";

export interface WorkRecord {
	archived: boolean;
	closureResult: ClosureResult | null;
	id: string;
	key: string;
	latestMergeEventId?: string | null;
	origin?: { id: string; key: string; projectId?: string } | null;
	retiredIdentities?: Array<{ id: string; key: string }>;
	revision: number;
	status: WorkStatus;
	title: string;
	type: WorkType;
	usageLinks?: Array<{
		hostRecordId: string;
		id: string;
		kindLabel: string;
		sourceRecordId: string;
	}>;
}

export default function WorkDetail({
	appliedTagIds,
	candidates,
	onClose,
	onMerged,
	onOpenSourceRecord,
	projectId,
	work,
	works,
}: {
	appliedTagIds: string[];
	candidates: Array<{ id: string; key: string; title: string }>;
	onClose: () => void;
	onMerged?: (survivorId: string) => void;
	onOpenSourceRecord?: (id: string) => void;
	projectId: string;
	work: WorkRecord;
	works: WorkRecord[];
}) {
	const onLink = useCallback(() => {
		document.getElementById("work-related")?.scrollIntoView();
	}, []);
	return (
		<article className="flex flex-col gap-4 border-t pt-4">
			<header className="flex items-start justify-between gap-3">
				<h2 className="min-w-0 font-medium text-sm tracking-tight">
					<span className="font-mono text-muted-foreground">{work.key}</span>{" "}
					{work.title}
				</h2>
				<Button onClick={onClose} size="sm" type="button" variant="ghost">
					{WORK_LIFECYCLE_COPY.close}
				</Button>
			</header>
			<WorkContextCard
				key={`${work.id}:${work.type}:${work.revision}`}
				onLink={onLink}
				onOpenSourceRecord={onOpenSourceRecord}
				status={work.status}
				title={work.title}
				type={work.type}
				workId={work.id}
			/>
			{work.retiredIdentities && work.retiredIdentities.length > 0 ? (
				<dl className="grid gap-1 text-sm">
					<div className="flex gap-2">
						<dt className="text-muted-foreground">
							{WORK_LIFECYCLE_COPY.origin}
						</dt>
						<dd>
							{work.retiredIdentities
								.map((identity) => identity.key)
								.join(", ")}
						</dd>
					</div>
				</dl>
			) : null}
			{work.origin ? (
				<dl className="grid gap-1 text-sm">
					<div className="flex gap-2">
						<dt className="text-muted-foreground">
							{WORK_LIFECYCLE_COPY.openSourceRecord}
						</dt>
						<dd className="font-mono">{work.origin.key}</dd>
					</div>
				</dl>
			) : null}
			{work.status === "Closed" ? (
				<ReopenWorkForm
					key={`${work.id}:reopen:${work.revision}`}
					projectId={projectId}
					revision={work.revision}
					workId={work.id}
				/>
			) : (
				<ChangeWorkStatusForm
					key={`${work.id}:status:${work.revision}`}
					projectId={projectId}
					revision={work.revision}
					status={work.status}
					workId={work.id}
				/>
			)}
			<FeatureInclusionPanel
				key={`${work.id}:inclusion:${work.revision}`}
				projectId={projectId}
				revision={work.revision}
				type={work.type}
				workId={work.id}
				works={works}
			/>
			<WorkChecklistPanel
				key={`${work.id}:checklist:${work.revision}`}
				onOpenSourceRecord={onOpenSourceRecord}
				projectId={projectId}
				revision={work.revision}
				workId={work.id}
			/>
			<WorkTagPicker
				appliedTagIds={appliedTagIds}
				key={`${work.id}:tags:${work.revision}`}
				projectId={projectId}
				revision={work.revision}
				workId={work.id}
			/>
			<UsageLinksPanel
				hostRecordId={work.id}
				key={`${work.id}:usage:${work.revision}`}
				projectId={projectId}
				usageLinks={work.usageLinks ?? []}
				works={works}
			/>
			<WorkBlockersPanel
				candidates={candidates}
				projectId={projectId}
				workId={work.id}
			/>
			<RelationsPanel
				candidates={candidates}
				onOpenSourceRecord={onOpenSourceRecord}
				projectId={projectId}
				workId={work.id}
			/>
			<UsedInPanel onOpenSourceRecord={onOpenSourceRecord} workId={work.id} />
			<ChangeWorkTypeForm
				key={`${work.id}:${work.type}:${work.revision}`}
				projectId={projectId}
				revision={work.revision}
				type={work.type}
				workId={work.id}
			/>
			<CustomFieldValuesEditor
				key={`${work.id}:custom-fields`}
				projectId={projectId}
				recordId={work.id}
				recordType="Work"
			/>
			<MergeWorkForm
				candidates={candidates}
				onMerged={onMerged}
				projectId={projectId}
				revision={work.revision}
				workId={work.id}
			/>
			<RecreateWorkForm
				key={`${work.id}:recreate`}
				projectId={projectId}
				workId={work.id}
			/>
			<ArchiveWorkForm
				archived={work.archived}
				key={`${work.id}:archive:${work.revision}`}
				projectId={projectId}
				revision={work.revision}
				workId={work.id}
			/>
			{work.latestMergeEventId ? (
				<MergeUndoButton
					mergeEventId={work.latestMergeEventId}
					projectId={projectId}
					revision={work.revision}
					workId={work.id}
				/>
			) : null}
		</article>
	);
}
