import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type CanvasViewportApi,
	startVisualTour,
	type VisualTourSession,
	type VisualTourStepView,
} from "server/return-to-work-visual-tour";

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
	const tourSession = useRef<VisualTourSession | null>(null);
	const [tourStep, setTourStep] = useState<VisualTourStepView | null>(null);
	const panelCanvas = useMemo<CanvasViewportApi>(
		() => ({
			captureStartViewport: () => ({ id: "return-to-work" }),
			fitVisibleContent: () => undefined,
			highlightAndPanTo: () => undefined,
			resolveTarget: (target) => ({
				placementId: target.objectId,
				status: "placed",
			}),
			restoreViewport: () => undefined,
			startViewportStillMeaningful: () => true,
		}),
		[]
	);
	const summaryInput = workId ? { projectId, workId } : { projectId };
	const catalog = useQuery(orpc.returnToWork.catalog.queryOptions());
	const summary = useQuery(
		orpc.returnToWork.summary.queryOptions({ input: summaryInput })
	);
	const copy = catalog.data?.copy ?? RETURN_TO_WORK_COPY;
	const { mutate: noteVisibleOpen } = useMutation(
		orpc.returnToWork.noteVisibleOpen.mutationOptions()
	);
	const notedOpenKey = useRef<string | null>(null);
	useEffect(() => {
		if (!summary.data) {
			return;
		}
		const openKey = workId ? `${projectId}:${workId}` : projectId;
		if (notedOpenKey.current === openKey) {
			return;
		}
		notedOpenKey.current = openKey;
		noteVisibleOpen(workId ? { projectId, workId } : { projectId });
	}, [noteVisibleOpen, projectId, summary.data, workId]);
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
	const saveThreshold = useMutation(
		orpc.returnToWork.setStatusAgeThresholdDays.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.smartCollections.list.queryKey(),
					});
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
	const onSaveThreshold = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const form = new FormData(event.currentTarget);
			const raw = String(form.get("statusAgeThresholdDays") ?? "").trim();
			const parsed = raw === "" ? null : Number(raw);
			const thresholdDays =
				parsed === null || !Number.isInteger(parsed) || parsed < 1
					? null
					: parsed;
			const result = attemptOnlineWork("record-create", () =>
				saveThreshold.mutateAsync({
					projectId,
					thresholdDays,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, projectId, saveThreshold]
	);
	const startTour = useCallback(() => {
		const steps = summary.data?.visualTour.steps ?? [];
		const session = startVisualTour({
			canvas: panelCanvas,
			events: steps.map((step) => ({
				group: "work",
				href: step.href,
				id: step.eventId,
				occurredAt: step.occurredAt,
				sourceKey: step.sourceKey,
				sourceTitle: step.sourceTitle,
				visualTarget: step.target,
			})),
			formatOccurredAt: (occurredAt) =>
				steps.find((step) => step.occurredAt === occurredAt)
					?.occurredAtDisplay ?? occurredAt,
		});
		tourSession.current = session;
		setTourStep(session.current);
	}, [panelCanvas, summary.data?.visualTour.steps]);
	const skipTour = useCallback(() => {
		const session = tourSession.current;
		if (!session) {
			return;
		}
		session.skip();
		setTourStep(session.current);
	}, []);
	const closeTour = useCallback(() => {
		tourSession.current?.close();
		tourSession.current = null;
		setTourStep(null);
	}, []);
	const openRemainder = useCallback(() => {
		document.getElementById("since-you-last-looked")?.focus();
	}, []);
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
	const tourOpen = tourStep !== null;
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
			<form className="mb-6 flex flex-col gap-3" onSubmit={onSaveThreshold}>
				<Field>
					<FieldLabel htmlFor="status-age-threshold-days">
						{view.copy.longInTheSameStatus}
					</FieldLabel>
					<Input
						defaultValue={
							view.statusAgeThresholdDays === null
								? ""
								: String(view.statusAgeThresholdDays)
						}
						id="status-age-threshold-days"
						inputMode="numeric"
						key={String(view.statusAgeThresholdDays ?? "empty")}
						name="statusAgeThresholdDays"
					/>
				</Field>
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
			<section
				aria-labelledby="since-you-last-looked"
				className="mt-8 flex flex-col gap-4"
			>
				<h3
					className="font-medium text-sm"
					id="since-you-last-looked"
					tabIndex={-1}
				>
					{view.sinceYouLastLooked.title}
				</h3>
				{view.visualTour.available ? (
					<VisualTourControls
						copy={view.visualTour.copy}
						onClose={closeTour}
						onOpenRemainder={openRemainder}
						onSkip={skipTour}
						onStart={startTour}
						open={tourOpen}
						remainderCount={view.visualTour.remainderCount}
						step={tourStep}
					/>
				) : null}
				{view.sinceYouLastLooked.groups.map((group) => (
					<div key={group.id}>
						<h4 className="text-muted-foreground text-sm">{group.label}</h4>
						{group.items.length === 0 ? null : (
							<ul className="mt-2 flex flex-col gap-3">
								{group.items.map((item) => (
									<li
										className="flex flex-col gap-1 border-b pb-3 last:border-b-0"
										key={item.id}
									>
										<p className="font-medium text-sm">
											<span className="font-mono text-muted-foreground">
												{item.sourceKey}
											</span>{" "}
											{item.sourceTitle}
										</p>
										<p className="text-muted-foreground text-sm">
											{item.occurredAtDisplay}
										</p>
										<SourceLink
											href={item.href}
											label={item.openSourceRecord}
										/>
									</li>
								))}
							</ul>
						)}
					</div>
				))}
			</section>
		</FounderSection>
	);
}

function VisualTourControls({
	copy,
	onClose,
	onOpenRemainder,
	onSkip,
	onStart,
	open,
	remainderCount,
	step,
}: {
	copy: {
		closeTour: string;
		openRemainderInTheList: string;
		skip: string;
		tourShowsFirstVisualChanges: string;
		tourTheVisualChanges: string;
	};
	onClose: () => void;
	onOpenRemainder: () => void;
	onSkip: () => void;
	onStart: () => void;
	open: boolean;
	remainderCount: number;
	step: VisualTourStepView | null;
}) {
	return (
		<div className="flex flex-col gap-3">
			{open ? null : (
				<Button onClick={onStart} size="sm" type="button">
					{copy.tourTheVisualChanges}
				</Button>
			)}
			<p className="text-muted-foreground text-sm">
				{copy.tourShowsFirstVisualChanges}
			</p>
			{step ? (
				<div className="flex flex-col gap-2" role="status">
					{step.kind === "shown" ? (
						<>
							<p className="font-medium text-sm">{step.surfaceLabel}</p>
							<p className="font-medium text-sm">
								<span className="font-mono text-muted-foreground">
									{step.sourceKey}
								</span>{" "}
								{step.sourceTitle}
							</p>
							<p className="text-muted-foreground text-sm">
								{step.occurredAtDisplay}
							</p>
							<p className="text-muted-foreground text-sm">{step.whyShown}</p>
						</>
					) : (
						<p className="text-muted-foreground text-sm">{step.reasonLabel}</p>
					)}
					<div className="flex flex-wrap gap-2">
						<Button onClick={onSkip} size="sm" type="button">
							{copy.skip}
						</Button>
						<Button onClick={onClose} size="sm" type="button">
							{copy.closeTour}
						</Button>
						{remainderCount > 0 ? (
							<Button
								onClick={onOpenRemainder}
								size="sm"
								type="button"
								variant="outline"
							>
								{copy.openRemainderInTheList}
							</Button>
						) : null}
					</div>
				</div>
			) : null}
		</div>
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
		const hash = href.includes("#")
			? (href.split("#")[1] ?? undefined)
			: undefined;
		return (
			<Link
				className="text-sm underline-offset-4 hover:underline"
				hash={hash}
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
