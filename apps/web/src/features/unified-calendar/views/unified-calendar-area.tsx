import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc } from "@/utils/orpc";

import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";
import { calendarListPresentation } from "./unified-calendar-list-presentation";

type CalendarViewName = "Day" | "Week" | "Month";

function workHref(projectId: string, workId: string): string {
	return `/projects/${projectId}?work=${encodeURIComponent(workId)}#work`;
}

export default function UnifiedCalendarArea() {
	const catalog = useQuery(orpc.unifiedCalendar.catalog.queryOptions());
	const [calendarDay, setCalendarDay] = useState<string | undefined>();
	const [view, setView] = useState<CalendarViewName | undefined>();
	const [projectId, setProjectId] = useState<string>("");
	const viewInput = {
		...(calendarDay ? { calendarDay } : {}),
		...(view ? { view } : {}),
		...(projectId ? { projectId } : {}),
	};
	const query = useQuery(
		orpc.unifiedCalendar.view.queryOptions({
			input: viewInput,
		})
	);
	const copy = catalog.data?.copy ?? UNIFIED_CALENDAR_COPY;
	const selectedDay = calendarDay ?? query.data?.calendarDay ?? "";
	const selectedView = view ?? query.data?.view ?? copy.week;
	const onChangeDay = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setCalendarDay(event.target.value);
	}, []);
	const onChangeView = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setView(event.target.value as CalendarViewName);
	}, []);
	const onChangeProject = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setProjectId(event.target.value);
		},
		[]
	);
	const items = [
		...(query.data?.ranges ?? []).map((row) => ({
			href: workHref(row.projectId, row.id),
			id: `${row.id}-range`,
			kind: `${row.start.kind}–${row.end.kind}`,
			label: `${row.start.date} → ${row.end.date}`,
			projectName: row.projectName,
			title: `${row.key} ${row.title}`,
		})),
		...(query.data?.positions ?? []).map((row) => ({
			href: workHref(row.projectId, row.id),
			id: `${row.id}-${row.kind}`,
			kind: row.kind,
			label: row.date,
			projectName: row.projectName,
			title: `${row.key} ${row.title}`,
		})),
	];
	const presentation = calendarListPresentation({
		data: query.data ? items : undefined,
		isError: query.isError,
		isPending: query.isPending,
	});

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
				<Field>
					<FieldLabel htmlFor="calendar-view">{copy.calendar}</FieldLabel>
					<NativeSelect
						id="calendar-view"
						onChange={onChangeView}
						value={selectedView}
					>
						{(query.data?.views ?? [copy.day, copy.week, copy.month]).map(
							(name) => (
								<NativeSelectOption key={name} value={name}>
									{name}
								</NativeSelectOption>
							)
						)}
					</NativeSelect>
				</Field>
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
	presentation: ReturnType<
		typeof calendarListPresentation<{
			href: string;
			id: string;
			kind: string;
			label: string;
			projectName: string;
			title: string;
		}>
	>;
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
		<ul aria-label={selectedView}>
			{presentation.items.map((item) => (
				<li
					className="flex items-center justify-between gap-3 border-border border-b py-3"
					key={item.id}
				>
					<a
						className="min-w-0 truncate text-sm underline-offset-4 hover:underline"
						href={item.href}
					>
						<span className="font-medium">{item.title}</span>
						<span className="text-muted-foreground">{` · ${item.projectName}`}</span>
					</a>
					<span className="shrink-0 text-muted-foreground text-sm">
						{`${item.kind} · ${item.label}`}
					</span>
				</li>
			))}
		</ul>
	);
}
