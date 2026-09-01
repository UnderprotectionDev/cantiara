import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent, MouseEvent } from "react";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc } from "@/utils/orpc";

import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";
import { calendarListPresentation } from "./unified-calendar-list-presentation";
import {
	type CalendarDaySection,
	calendarDaySections,
} from "./unified-calendar-rows";

type CalendarViewName = "Day" | "Week" | "Month" | "Agenda";
type CalendarDateKind = "Planned start" | "Target date" | "Reappear date";

const DATE_KINDS: readonly CalendarDateKind[] = [
	UNIFIED_CALENDAR_COPY.plannedStart,
	UNIFIED_CALENDAR_COPY.targetDate,
	UNIFIED_CALENDAR_COPY.reappearDate,
];

export default function UnifiedCalendarArea() {
	const catalog = useQuery(orpc.unifiedCalendar.catalog.queryOptions());
	const [calendarDay, setCalendarDay] = useState<string | undefined>();
	const [view, setView] = useState<CalendarViewName | undefined>();
	const [projectId, setProjectId] = useState<string>("");
	const [dateKinds, setDateKinds] = useState<CalendarDateKind[] | undefined>();
	const copy = catalog.data?.copy ?? UNIFIED_CALENDAR_COPY;
	const selectedKinds = dateKinds ?? DATE_KINDS;
	const viewInput = {
		...(calendarDay ? { calendarDay } : {}),
		...(view ? { view } : {}),
		...(projectId ? { projectId } : {}),
		...(dateKinds ? { dateKinds } : {}),
	};
	const query = useQuery(
		orpc.unifiedCalendar.view.queryOptions({
			input: viewInput,
		})
	);
	const selectedDay = calendarDay ?? query.data?.calendarDay ?? "";
	const selectedView = view ?? query.data?.view ?? copy.week;
	const onChangeDay = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setCalendarDay(event.target.value);
	}, []);
	const onPickView = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		setView(event.currentTarget.value as CalendarViewName);
	}, []);
	const onToggleKind = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		const kind = event.currentTarget.value as CalendarDateKind;
		setDateKinds((current) => {
			const selected = current ?? [...DATE_KINDS];
			if (selected.includes(kind)) {
				return selected.filter((item) => item !== kind);
			}
			return DATE_KINDS.filter(
				(item) => selected.includes(item) || item === kind
			);
		});
	}, []);
	const onChangeProject = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setProjectId(event.target.value);
		},
		[]
	);
	const sections = query.data
		? calendarDaySections(query.data.days)
		: undefined;
	const presentation = calendarListPresentation({
		data: sections,
		isError: query.isError,
		isPending: query.isPending,
	});
	const views = query.data?.views ?? [
		copy.day,
		copy.week,
		copy.month,
		copy.agenda,
	];

	return (
		<FounderPage title={copy.calendar} wide>
			<div className="mb-8 flex flex-wrap items-end gap-3">
				<Field>
					<FieldLabel htmlFor="calendar-day">{copy.selectedDay}</FieldLabel>
					<Input
						id="calendar-day"
						onChange={onChangeDay}
						type="date"
						value={selectedDay}
					/>
				</Field>
				<fieldset className="flex flex-wrap items-end gap-2 border-0 p-0">
					<legend className="sr-only">{copy.calendar}</legend>
					{views.map((name) => (
						<Button
							aria-pressed={selectedView === name}
							key={name}
							onClick={onPickView}
							type="button"
							value={name}
							variant={selectedView === name ? "default" : "outline"}
						>
							{name}
						</Button>
					))}
				</fieldset>
				<fieldset className="flex flex-wrap items-end gap-2 border-0 p-0">
					{DATE_KINDS.map((kind) => (
						<Button
							aria-pressed={selectedKinds.includes(kind)}
							key={kind}
							onClick={onToggleKind}
							type="button"
							value={kind}
							variant={selectedKinds.includes(kind) ? "default" : "outline"}
						>
							{kind}
						</Button>
					))}
				</fieldset>
				<Field className="min-w-56">
					<FieldLabel htmlFor="calendar-project">{copy.project}</FieldLabel>
					<NativeSelect
						id="calendar-project"
						onChange={onChangeProject}
						value={projectId}
					>
						<NativeSelectOption value="">{copy.allProjects}</NativeSelectOption>
						{(query.data?.projects ?? []).map((project) => (
							<NativeSelectOption key={project.id} value={project.id}>
								{project.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</div>
			<CalendarItems
				copy={copy}
				presentation={presentation}
				selectedView={selectedView}
			/>
		</FounderPage>
	);
}

function CalendarItems({
	copy,
	presentation,
	selectedView,
}: {
	copy: typeof UNIFIED_CALENDAR_COPY;
	presentation: ReturnType<typeof calendarListPresentation<CalendarDaySection>>;
	selectedView: string;
}) {
	if (presentation.kind === "failed") {
		return <p>{MAIN_FLOW_COPY.failed}</p>;
	}
	if (presentation.kind === "loading") {
		return <p>{copy.loading}</p>;
	}
	if (presentation.kind === "empty") {
		return <p>{copy.empty}</p>;
	}
	return (
		<section aria-label={selectedView}>
			{presentation.items.map((section) => (
				<section className="mb-6" key={section.date}>
					<h2 className="mb-1 font-medium text-muted-foreground text-sm">
						{section.date}
					</h2>
					<ul aria-label={section.date}>
						{section.rows.map((item) => (
							<li
								className="flex items-center justify-between gap-3 border-border border-b py-3"
								key={item.id}
							>
								<div className="min-w-0">
									<p className="truncate text-sm">
										<span className="font-medium">{item.title}</span>
										<span className="text-muted-foreground">{` · ${item.projectName}`}</span>
									</p>
									<p className="text-muted-foreground text-sm">
										{item.kinds
											.map((mark) => `${mark.kind} ${mark.date}`)
											.join(" · ")}
									</p>
								</div>
								{item.openSourceRecord ? (
									<a
										className="shrink-0 text-sm underline-offset-4 hover:underline"
										href={item.href}
									>
										{copy.openSourceRecord}
									</a>
								) : null}
							</li>
						))}
					</ul>
				</section>
			))}
		</section>
	);
}
