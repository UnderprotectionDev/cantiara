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
	projectId,
	work,
}: {
	projectId: string;
	work: WorkRecord;
}) {
	return (
		<article className="mt-8 flex flex-col gap-4 border-t pt-6">
			<h2 className="font-medium text-lg">
				{work.key} {work.title}
			</h2>
			<p>
				{WORK_LIFECYCLE_COPY.key} {work.key}
			</p>
			<p>
				{WORK_LIFECYCLE_COPY.type} {work.type}
			</p>
			<p>
				{WORK_LIFECYCLE_COPY.status} {work.status}
			</p>
			<ChangeWorkTypeForm
				projectId={projectId}
				revision={work.revision}
				type={work.type}
				workId={work.id}
			/>
		</article>
	);
}
