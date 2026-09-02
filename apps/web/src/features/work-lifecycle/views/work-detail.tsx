import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

import WorkBlockersPanel from "@/features/blockers/views/work-blockers-panel";
import { CompletionEffectsLayer } from "@/features/completion-effects/components/completion-effects-layer";
import CustomFieldValuesEditor from "@/features/custom-fields/forms/custom-field-values-editor";
import WorkExternalHandoffsPanel from "@/features/external-handoffs/views/work-external-handoffs-panel";
import WorkPriorityValues from "@/features/priority/forms/work-priority-values";
import {
	PROJECT_SHELL_COPY,
	projectShellAnchor,
} from "@/features/project-shell/forms/project-shell-copy";
import RecordActionRun from "@/features/record-actions/views/record-action-run";
import RelationsPanel from "@/features/relations/views/relations-panel";
import UsageLinksPanel from "@/features/relations/views/usage-links-panel";
import UsedInPanel from "@/features/relations/views/used-in-panel";
import WorkHorizonForm from "@/features/roadmap-horizon/forms/work-horizon-form";
import WorkMilestoneForm from "@/features/roadmap-horizon/forms/work-milestone-form";
import WorkTagPicker from "@/features/tags/views/work-tag-picker";
import WorkChecklistPanel from "@/features/work-checklists/views/work-checklist-panel";
import WorkContextCard from "@/features/work-context/views/work-context-card";
import DuplicateWorkForm from "@/features/work-templates/forms/duplicate-work-form";

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
import WorkPlanningDatesForm from "../forms/work-planning-dates-form";

export interface WorkRecord {
	archived: boolean;
	closureResult: ClosureResult | null;
	id: string;
	key: string;
	latestMergeEventId?: string | null;
	origin?: { id: string; key: string; projectId?: string } | null;
	plannedStart?: string | null;
	reappearDate?: string | null;
	retiredIdentities?: Array<{ id: string; key: string }>;
	revision: number;
	status: WorkStatus;
	targetDate?: string | null;
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
	onDuplicated,
	onMerged,
	onOpenSourceRecord,
	projectId,
	readOnly = false,
	work,
	works,
}: {
	appliedTagIds: string[];
	candidates: Array<{ id: string; key: string; title: string }>;
	onClose: () => void;
	onDuplicated?: (workId: string) => void;
	onMerged?: (survivorId: string) => void;
	onOpenSourceRecord?: (id: string) => void;
	projectId: string;
	readOnly?: boolean;
	work: WorkRecord;
	works: WorkRecord[];
}) {
	const onLink = useCallback(() => {
		document.getElementById("work-related")?.scrollIntoView();
	}, []);
	return (
		<article
			className="flex flex-col gap-4 border-t pt-4"
			id={projectShellAnchor(PROJECT_SHELL_COPY.edit)}
		>
			<div className="relative flex min-h-64 flex-col gap-4 overflow-hidden">
				<CompletionEffectsLayer key={work.id} />
				<header className="flex items-start justify-between gap-3">
					<h2 className="min-w-0 font-medium text-sm tracking-tight">
						<span className="font-mono text-muted-foreground">{work.key}</span>{" "}
						{work.title}
					</h2>
					<Button onClick={onClose} size="sm" type="button" variant="ghost">
						{WORK_LIFECYCLE_COPY.close}
					</Button>
				</header>
				{readOnly ? (
					<dl className="grid gap-1 text-sm">
						<div className="flex gap-2">
							<dt className="text-muted-foreground">
								{WORK_LIFECYCLE_COPY.status}
							</dt>
							<dd>{work.status}</dd>
						</div>
						<div className="flex gap-2">
							<dt className="text-muted-foreground">
								{WORK_LIFECYCLE_COPY.plannedStart}
							</dt>
							<dd>{work.plannedStart ?? "—"}</dd>
						</div>
						<div className="flex gap-2">
							<dt className="text-muted-foreground">
								{WORK_LIFECYCLE_COPY.targetDate}
							</dt>
							<dd>{work.targetDate ?? "—"}</dd>
						</div>
					</dl>
				) : (
					<>
						<WorkContextCard
							key={`${work.id}:${work.type}:${work.revision}`}
							onLink={onLink}
							onOpenSourceRecord={onOpenSourceRecord}
							status={work.status}
							title={work.title}
							type={work.type}
							workId={work.id}
						/>
						<WorkExternalHandoffsPanel
							key={`${work.id}:handoff:${work.revision}`}
							projectId={projectId}
							revision={work.revision}
							workId={work.id}
							workKey={work.key}
							workTitle={work.title}
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
						<div id={projectShellAnchor(PROJECT_SHELL_COPY.status)}>
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
						</div>
						<WorkPlanningDatesForm
							key={`${work.id}:dates:${work.revision}`}
							plannedStart={work.plannedStart ?? null}
							projectId={projectId}
							reappearDate={work.reappearDate ?? null}
							revision={work.revision}
							targetDate={work.targetDate ?? null}
							workId={work.id}
						/>
						<WorkHorizonForm
							key={`${work.id}:horizon:${work.revision}`}
							projectId={projectId}
							workId={work.id}
						/>
						<WorkMilestoneForm
							key={`${work.id}:milestone:${work.revision}`}
							projectId={projectId}
							workId={work.id}
						/>
					</>
				)}
			</div>
			{readOnly ? null : (
				<>
					<RecordActionRun
						projectId={projectId}
						revision={work.revision}
						workId={work.id}
					/>
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
					<UsedInPanel
						onOpenSourceRecord={onOpenSourceRecord}
						workId={work.id}
					/>
					<ChangeWorkTypeForm
						key={`${work.id}:${work.type}:${work.revision}`}
						projectId={projectId}
						revision={work.revision}
						type={work.type}
						workId={work.id}
					/>
					<WorkPriorityValues
						key={`${work.id}:priority`}
						projectId={projectId}
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
					<DuplicateWorkForm
						key={`${work.id}:duplicate`}
						onDuplicated={onDuplicated}
						projectId={projectId}
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
				</>
			)}
		</article>
	);
}
