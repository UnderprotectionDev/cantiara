import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useState } from "react";

import { orpc } from "@/utils/orpc";

import type { WorkType } from "../../work-lifecycle/forms/work-lifecycle-copy";

import {
	openPriorityFoundationsCount,
	presentWorkContextCard,
	revealPreparedSection,
	WORK_CONTEXT_COPY,
	type WorkContextCardView,
} from "./work-context-copy";

function visibleFieldValue(
	field: WorkContextCardView["initiallyVisibleFields"][number],
	values: { planning: string; status: string; title: string; type: string }
) {
	if (field === WORK_CONTEXT_COPY.title) {
		return values.title;
	}
	if (field === WORK_CONTEXT_COPY.type) {
		return values.type;
	}
	if (field === WORK_CONTEXT_COPY.status) {
		return values.status;
	}
	return values.planning;
}

export default function WorkContextCard({
	onLink,
	onOpenSourceRecord,
	planning,
	status,
	title,
	type,
	workId,
}: {
	onLink?: () => void;
	onOpenSourceRecord?: (id: string) => void;
	planning?: string;
	status: string;
	title: string;
	type: WorkType;
	workId?: string;
}) {
	const [revealedSections, setRevealedSections] = useState<string[]>([]);
	const [openedCountId, setOpenedCountId] = useState<string | null>(null);
	const local = presentWorkContextCard({
		revealedSections,
		starterConfiguration: "Blank Project",
		workType: type,
	});
	const remote = useQuery({
		...orpc.workContext.get.queryOptions({
			input: { revealedSections, workId: workId ?? "" },
		}),
		enabled: Boolean(workId),
	});
	const card = remote.data ?? local;
	const foundations =
		openedCountId === null
			? card
			: openPriorityFoundationsCount(card, openedCountId);
	const values = {
		planning: planning ?? "",
		status,
		title,
		type,
	};
	const onAdd = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const section = new FormData(event.currentTarget).get("section");
			if (typeof section !== "string" || section.length === 0) {
				return;
			}
			setRevealedSections(
				revealPreparedSection(local, section).visiblePreparedSections
			);
		},
		[local]
	);
	const onToggleCount = useCallback((countId: string) => {
		setOpenedCountId((current) => (current === countId ? null : countId));
	}, []);
	return (
		<section className="flex flex-col gap-3">
			<dl className="grid gap-1 text-sm">
				{card.initiallyVisibleFields.map((field) => (
					<div className="flex gap-2" key={field}>
						<dt className="text-muted-foreground">{field}</dt>
						<dd>{visibleFieldValue(field, values)}</dd>
					</div>
				))}
			</dl>
			<section aria-label={card.whyChain.label} className="flex flex-col gap-1">
				<h3 className="font-medium text-sm">{card.whyChain.label}</h3>
				{card.whyChain.empty ? (
					<p className="text-muted-foreground text-sm">
						{card.whyChain.emptyState}
					</p>
				) : (
					<ol className="flex flex-wrap items-center gap-1 text-sm">
						{card.whyChain.steps.map((step, index) => (
							<li
								className="flex items-center gap-1"
								key={step.sourceId ?? step.reason ?? step.role}
							>
								{index > 0 ? <span aria-hidden="true">→</span> : null}
								<WhyStep onOpenSourceRecord={onOpenSourceRecord} step={step} />
							</li>
						))}
					</ol>
				)}
			</section>
			<section
				aria-label={foundations.priorityFoundations.label}
				className="flex flex-col gap-2"
			>
				<h3 className="font-medium text-sm">
					{foundations.priorityFoundations.label}
				</h3>
				{foundations.priorityFoundations.items.length > 0 ? (
					<ul className="flex flex-col gap-1 text-sm">
						{foundations.priorityFoundations.items.map((item) => (
							<li key={`${item.kind}:${item.sourceId}`}>
								<OpenSourceButton
									className="text-left"
									onOpenSourceRecord={onOpenSourceRecord}
									sourceId={item.sourceId}
								>
									{item.kind} · {item.visibleName}
									{item.archiveVisible ? ` · ${WORK_CONTEXT_COPY.archive}` : ""}
								</OpenSourceButton>
							</li>
						))}
					</ul>
				) : null}
				{foundations.priorityFoundations.counts.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{foundations.priorityFoundations.counts.map((count) => (
							<FoundationCountButton
								count={count}
								key={count.id}
								onToggle={onToggleCount}
								opened={
									foundations.priorityFoundations.openedCountId === count.id
								}
							/>
						))}
					</div>
				) : null}
				{foundations.priorityFoundations.openedSet ? (
					<ul className="flex flex-col gap-1 text-sm">
						{foundations.priorityFoundations.openedSet.map((item) => (
							<li key={`opened:${item.kind}:${item.sourceId}`}>
								<OpenSourceButton
									className="text-left"
									onOpenSourceRecord={onOpenSourceRecord}
									sourceId={item.sourceId}
								>
									<span className="sr-only">
										{WORK_CONTEXT_COPY.openSourceRecord}{" "}
									</span>
									{item.visibleName}
									{item.archiveVisible ? ` · ${WORK_CONTEXT_COPY.archive}` : ""}
								</OpenSourceButton>
							</li>
						))}
					</ul>
				) : null}
			</section>
			{card.visibleSections.map((section) => (
				<section className="flex flex-col gap-1" key={section.name}>
					<h3 className="font-medium text-sm">{section.name}</h3>
					{section.empty ? (
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-muted-foreground text-sm">
								{section.emptyState}
							</p>
							<Button
								onClick={section.action.kind === "link" ? onLink : undefined}
								size="sm"
								type="button"
								variant="ghost"
							>
								{section.action.label}
							</Button>
						</div>
					) : (
						<ul className="flex flex-col gap-1 text-sm">
							{section.items.map((item) => (
								<li
									key={
										item.status === "live"
											? item.sourceId
											: (item.reason ?? item.kind)
									}
								>
									<LiveItem
										item={item}
										onOpenSourceRecord={onOpenSourceRecord}
									/>
								</li>
							))}
						</ul>
					)}
				</section>
			))}
			{card.addContext.remainingSections.length > 0 ? (
				<form className="flex flex-wrap items-end gap-2" onSubmit={onAdd}>
					<Field className="w-64">
						<FieldLabel htmlFor="add-context-section">
							{WORK_CONTEXT_COPY.addContext}
						</FieldLabel>
						<NativeSelect
							className="w-full"
							defaultValue={card.addContext.remainingSections[0]}
							id="add-context-section"
							key={card.addContext.remainingSections.join("|")}
							name="section"
						>
							{card.addContext.remainingSections.map((section) => (
								<NativeSelectOption key={section} value={section}>
									{section}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Button size="sm" type="submit">
						{WORK_CONTEXT_COPY.addContext}
					</Button>
				</form>
			) : null}
		</section>
	);
}

function FoundationCountButton({
	count,
	onToggle,
	opened,
}: {
	count: WorkContextCardView["priorityFoundations"]["counts"][number];
	onToggle: (id: string) => void;
	opened: boolean;
}) {
	const onClick = useCallback(() => {
		onToggle(count.id);
	}, [count.id, onToggle]);
	return (
		<Button
			aria-pressed={opened}
			onClick={onClick}
			size="sm"
			type="button"
			variant={opened ? "default" : "outline"}
		>
			{count.label} {count.value}
		</Button>
	);
}

function WhyStep({
	onOpenSourceRecord,
	step,
}: {
	onOpenSourceRecord?: (id: string) => void;
	step: WorkContextCardView["whyChain"]["steps"][number];
}) {
	if (step.visibleName && step.sourceId && step.openSourceRecord) {
		return (
			<OpenSourceButton
				onOpenSourceRecord={onOpenSourceRecord}
				sourceId={step.sourceId}
			>
				{step.visibleName}
			</OpenSourceButton>
		);
	}
	return <span>{step.reason ?? step.visibleName}</span>;
}

function LiveItem({
	item,
	onOpenSourceRecord,
}: {
	item: WorkContextCardView["visibleSections"][number]["items"][number];
	onOpenSourceRecord?: (id: string) => void;
}) {
	if (item.status === "broken" || !item.sourceId) {
		return <span>{item.reason}</span>;
	}
	return (
		<OpenSourceButton
			className="text-left"
			onOpenSourceRecord={onOpenSourceRecord}
			sourceId={item.sourceId}
		>
			<span className="sr-only">{WORK_CONTEXT_COPY.openSourceRecord} </span>
			{item.visibleName} · {item.recordStatus}
		</OpenSourceButton>
	);
}

function OpenSourceButton({
	children,
	className,
	onOpenSourceRecord,
	sourceId,
}: {
	children: ReactNode;
	className?: string;
	onOpenSourceRecord?: (id: string) => void;
	sourceId: string;
}) {
	const onClick = useCallback(() => {
		onOpenSourceRecord?.(sourceId);
	}, [onOpenSourceRecord, sourceId]);
	return (
		<button
			className={`underline-offset-2 hover:underline ${className ?? ""}`}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	);
}
