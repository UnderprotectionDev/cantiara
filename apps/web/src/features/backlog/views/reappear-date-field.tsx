import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useCallback } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { orpc } from "@/utils/orpc";

import { BACKLOG_COPY } from "./backlog-copy";

export default function ReappearDateField({
	projectId,
	reappearDate,
	workId,
}: {
	projectId: string;
	reappearDate?: string | null;
	workId: string;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const save = useMutation(orpc.backlog.setReappearDate.mutationOptions());
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const next = event.currentTarget.value;
			attemptOnlineWork("planning-change", () =>
				save
					.mutateAsync({
						projectId,
						reappearDate: next === "" ? null : next,
						workId,
					})
					.then(async (outcome) => {
						if (outcome.status === "committed") {
							await invalidateWork(projectId, workId);
							recordSave();
						}
						return outcome;
					})
			);
		},
		[attemptOnlineWork, projectId, recordSave, save, workId]
	);
	return (
		<Field>
			<FieldLabel htmlFor={`reappear-date-${workId}`}>
				{BACKLOG_COPY.reappearDate}
			</FieldLabel>
			<Input
				id={`reappear-date-${workId}`}
				onChange={onChange}
				type="date"
				value={reappearDate ?? ""}
			/>
		</Field>
	);
}
