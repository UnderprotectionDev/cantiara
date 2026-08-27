import { Button } from "@cantiara/ui/components/button";

import ChangeWorkTypeForm from "../forms/change-work-type-form";
import {
	WORK_LIFECYCLE_COPY,
	type WorkType,
} from "../forms/work-lifecycle-copy";

export interface WorkRecord {
	id: string;
	key: string;
	revision: number;
	status: string;
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
					<dd>{work.status}</dd>
				</div>
			</dl>
			<ChangeWorkTypeForm
				key={`${work.id}:${work.type}:${work.revision}`}
				projectId={projectId}
				revision={work.revision}
				type={work.type}
				workId={work.id}
			/>
		</article>
	);
}
