import { Button } from "@cantiara/ui/components/button";

import ArchiveWorkForm from "../forms/archive-work-form";
import ChangeWorkStatusForm from "../forms/change-work-status-form";
import ChangeWorkTypeForm from "../forms/change-work-type-form";
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
	revision: number;
	status: WorkStatus;
	title: string;
	type: WorkType;
}

export default function WorkDetail({
	onClose,
	projectId,
	work,
}: {
	onClose: () => void;
	projectId: string;
	work: WorkRecord;
}) {
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
			<dl className="grid gap-1 text-sm">
				<div className="flex gap-2">
					<dt className="text-muted-foreground">{WORK_LIFECYCLE_COPY.type}</dt>
					<dd>{work.type}</dd>
				</div>
				<div className="flex gap-2">
					<dt className="text-muted-foreground">
						{WORK_LIFECYCLE_COPY.status}
					</dt>
					<dd>
						{work.status}
						{work.closureResult ? ` · ${work.closureResult}` : ""}
					</dd>
				</div>
			</dl>
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
			<ChangeWorkTypeForm
				key={`${work.id}:${work.type}:${work.revision}`}
				projectId={projectId}
				revision={work.revision}
				type={work.type}
				workId={work.id}
			/>
			<ArchiveWorkForm
				archived={work.archived}
				key={`${work.id}:archive:${work.revision}`}
				projectId={projectId}
				revision={work.revision}
				workId={work.id}
			/>
		</article>
	);
}
