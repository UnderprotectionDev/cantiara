import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useCallback, useEffect } from "react";

import { FounderSection } from "@/features/personal-shell/components/founder-surface";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { RETURN_TO_WORK_COPY } from "./return-to-work-copy";

const WORK_SOURCE_HREF = /\/projects\/([^/?]+)\?work=([^#]+)/;
const PROJECT_SOURCE_HREF = /\/projects\/([^/?#]+)/;

interface ReturnCardView {
	href: string;
	id: string;
	key: string;
	openSourceRecord: string;
	title: string;
	whyShown: string;
}

export default function ReturnToWorkPanel({
	projectId,
	workId,
}: {
	projectId: string;
	workId?: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const summaryInput = workId ? { projectId, workId } : { projectId };
	const catalog = useQuery(orpc.returnToWork.catalog.queryOptions());
	const summary = useQuery(
		orpc.returnToWork.summary.queryOptions({ input: summaryInput })
	);
	const copy = catalog.data?.copy ?? RETURN_TO_WORK_COPY;
	const { mutate: noteVisibleOpen } = useMutation(
		orpc.returnToWork.noteVisibleOpen.mutationOptions()
	);
	useEffect(() => {
		noteVisibleOpen(workId ? { projectId, workId } : { projectId });
	}, [noteVisibleOpen, projectId, workId]);
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.returnToWork.summary.queryKey({
				input: workId ? { projectId, workId } : { projectId },
			}),
		});
	}, [projectId, workId]);
	const save = useMutation(
		orpc.returnToWork.setNextConcreteStep.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed") {
					await invalidate();
					recordSave();
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const form = new FormData(event.currentTarget);
			const text = String(form.get("nextConcreteStep") ?? "");
			const result = attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					projectId: workId ? undefined : projectId,
					text,
					workId: workId ?? undefined,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, projectId, save, workId]
	);
	if (summary.isPending) {
		return (
			<FounderSection title={copy.returnToWork} titleId="return-to-work">
				<p>{copy.returnToWork}</p>
			</FounderSection>
		);
	}
	if (summary.isError || !summary.data) {
		return null;
	}
	const view = summary.data;
	return (
		<FounderSection title={view.copy.returnToWork} titleId="return-to-work">
			<form className="mb-6 flex flex-col gap-3" onSubmit={onSubmit}>
				<Field>
					<FieldLabel htmlFor="next-concrete-step">
						{view.copy.nextConcreteStep}
					</FieldLabel>
					<Input
						defaultValue={view.nextConcreteStep?.text ?? ""}
						id="next-concrete-step"
						key={`${view.nextConcreteStep?.text ?? ""}:${view.nextConcreteStep?.updatedAt ?? "empty"}`}
						name="nextConcreteStep"
					/>
				</Field>
				{view.nextConcreteStep ? (
					<p className="text-muted-foreground text-sm">
						{view.copy.lastUpdated} {view.nextConcreteStep.updatedAtDisplay}{" "}
						<SourceLink
							href={view.nextConcreteStep.sourceHref}
							label={view.copy.openSourceRecord}
						/>
					</p>
				) : null}
				<Button size="sm" type="submit">
					{view.copy.save}
				</Button>
			</form>
			{view.cards.length === 0 ? (
				<p className="text-muted-foreground text-sm">{view.copy.empty}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{view.cards.map((card) => (
						<ReturnCardItem
							card={card}
							key={card.id}
							openSourceRecord={view.copy.openSourceRecord}
						/>
					))}
				</ul>
			)}
		</FounderSection>
	);
}

function ReturnCardItem({
	card,
	openSourceRecord,
}: {
	card: ReturnCardView;
	openSourceRecord: string;
}) {
	return (
		<li className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
			<p className="font-medium text-sm">
				<span className="font-mono text-muted-foreground">{card.key}</span>{" "}
				{card.title}
			</p>
			<p className="text-muted-foreground text-sm">{card.whyShown}</p>
			<SourceLink href={card.href} label={openSourceRecord} />
		</li>
	);
}

function SourceLink({ href, label }: { href: string; label: string }) {
	const workMatch = href.match(WORK_SOURCE_HREF);
	if (workMatch) {
		return (
			<Link
				className="text-sm underline-offset-4 hover:underline"
				hash="work"
				params={{ projectId: workMatch[1] ?? "" }}
				search={{ work: decodeURIComponent(workMatch[2] ?? "") }}
				to="/projects/$projectId"
			>
				{label}
			</Link>
		);
	}
	const projectMatch = href.match(PROJECT_SOURCE_HREF);
	if (projectMatch) {
		return (
			<Link
				className="text-sm underline-offset-4 hover:underline"
				params={{ projectId: projectMatch[1] ?? "" }}
				to="/projects/$projectId"
			>
				{label}
			</Link>
		);
	}
	return (
		<a className="text-sm underline-offset-4 hover:underline" href={href}>
			{label}
		</a>
	);
}
