import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { dailyFocusCloseGroups } from "./daily-focus-close-groups";
import { DAILY_FOCUS_COPY } from "./daily-focus-copy";
import { dailyFocusListPresentation } from "./daily-focus-list-presentation";

interface DailyFocusWork {
	id: string;
	key: string;
	projectId: string;
	projectName: string;
	title: string;
}

interface WhatHappenedTodayRow {
	id: string;
	kindLabel: string;
	occurredAt: string;
	occurredAtDisplay: string;
	openSourceRecord: string;
	projectName: string;
	sourceHref: string;
	sourceKey: string;
	sourceTitle: string;
}

interface DailyFocusCandidate extends DailyFocusWork {
	reason: string;
}

function workHref(work: DailyFocusWork): string {
	return `/projects/${work.projectId}?work=${encodeURIComponent(work.id)}#work`;
}

export default function DailyFocusArea() {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const catalog = useQuery(orpc.dailyFocus.catalog.queryOptions());
	const [calendarDay, setCalendarDay] = useState<string | undefined>();
	const [closeFocusOpen, setCloseFocusOpen] = useState(false);
	const viewInput = calendarDay ? { calendarDay } : {};
	const view = useQuery(
		orpc.dailyFocus.view.queryOptions({
			input: viewInput,
		})
	);
	const closeView = useQuery(
		orpc.dailyFocus.closeView.queryOptions({
			input: viewInput,
		})
	);
	const copy = catalog.data?.copy ?? DAILY_FOCUS_COPY;
	const selectedDay = calendarDay ?? view.data?.calendarDay ?? "";
	const invalidateView = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.dailyFocus.view.queryKey({
					input: calendarDay ? { calendarDay } : {},
				}),
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.dailyFocus.closeView.queryKey({
					input: calendarDay ? { calendarDay } : {},
				}),
			}),
		]);
	}, [calendarDay]);
	const openCloseFocus = useCallback(() => {
		setCloseFocusOpen(true);
	}, []);
	const returnToDailyFocus = useCallback(() => {
		setCloseFocusOpen(false);
	}, []);
	const add = useMutation(
		orpc.dailyFocus.add.mutationOptions({
			onSuccess: invalidateView,
		})
	);
	const remove = useMutation(
		orpc.dailyFocus.remove.mutationOptions({
			onSuccess: invalidateView,
		})
	);
	const accept = useMutation(
		orpc.dailyFocus.accept.mutationOptions({
			onSuccess: invalidateView,
		})
	);
	const reject = useMutation(
		orpc.dailyFocus.reject.mutationOptions({
			onSuccess: invalidateView,
		})
	);
	const onChangeDay = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setCalendarDay(event.target.value);
	}, []);
	const onAdd = useCallback(
		(workId: string) => {
			if (!selectedDay) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				add.mutateAsync({
					calendarDay: selectedDay,
					idempotencyKey: newIdempotencyKey(),
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[add, attemptOnlineWork, markUnsaved, selectedDay]
	);
	const onRemove = useCallback(
		(workId: string) => {
			if (!selectedDay) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				remove.mutateAsync({
					calendarDay: selectedDay,
					idempotencyKey: newIdempotencyKey(),
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, remove, selectedDay]
	);
	const onAccept = useCallback(
		(workId: string) => {
			if (!selectedDay) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				accept.mutateAsync({
					calendarDay: selectedDay,
					idempotencyKey: newIdempotencyKey(),
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[accept, attemptOnlineWork, markUnsaved, selectedDay]
	);
	const onReject = useCallback(
		(workId: string) => {
			if (!selectedDay) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				reject.mutateAsync({
					calendarDay: selectedDay,
					idempotencyKey: newIdempotencyKey(),
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, reject, selectedDay]
	);

	return (
		<FounderPage
			actions={
				<Button
					onClick={closeFocusOpen ? returnToDailyFocus : openCloseFocus}
					type="button"
					variant="outline"
				>
					{closeFocusOpen ? copy.dailyFocus : copy.closeFocus}
				</Button>
			}
			title={closeFocusOpen ? copy.closeFocus : copy.dailyFocus}
			wide
		>
			<Field>
				<FieldLabel htmlFor="daily-focus-day">{copy.selectedDay}</FieldLabel>
				<Input
					id="daily-focus-day"
					onChange={onChangeDay}
					type="date"
					value={selectedDay}
				/>
			</Field>
			{closeFocusOpen ? (
				<CloseFocusGroups copy={copy} query={closeView} />
			) : (
				<>
					<EligibleWork
						copy={copy}
						eligible={view.data?.eligibleWork ?? []}
						onAdd={onAdd}
					/>
					<CandidatesList
						candidates={view.data?.candidates ?? []}
						copy={copy}
						onAccept={onAccept}
						onReject={onReject}
					/>
					<MembersList
						copy={copy}
						members={view.data?.members}
						onRemove={onRemove}
						query={view}
					/>
					<WhatHappenedToday
						copy={copy}
						query={view}
						rows={view.data?.whatHappenedToday?.rows}
					/>
				</>
			)}
		</FounderPage>
	);
}

function CloseFocusGroups({
	copy,
	query,
}: {
	copy: typeof DAILY_FOCUS_COPY;
	query: {
		data?: {
			groups: {
				abandoned: readonly DailyFocusWork[];
				completed: readonly DailyFocusWork[];
				reappearDeferred: readonly DailyFocusWork[];
				stillOpen: readonly DailyFocusWork[];
			};
		};
		isError: boolean;
		isPending: boolean;
	};
}) {
	if (query.isError) {
		return <p>{MAIN_FLOW_COPY.failed}</p>;
	}
	if (query.isPending && query.data === undefined) {
		return <p>{copy.loading}</p>;
	}
	if (!query.data) {
		return <p>{copy.empty}</p>;
	}
	const { groups } = query.data;
	const listed = dailyFocusCloseGroups(copy).flatMap((group) => {
		const members = groups[group.key];
		if (members.length === 0) {
			return [];
		}
		return [{ heading: group.heading, members }];
	});
	if (listed.length === 0) {
		return <p>{copy.empty}</p>;
	}
	return (
		<div className="flex flex-col gap-8">
			{listed.map((group) => (
				<section key={group.heading}>
					<h2 className="mb-2 font-medium text-sm">{group.heading}</h2>
					<ul aria-label={group.heading}>
						{group.members.map((work) => (
							<li
								className="flex items-center justify-between gap-3 border-border border-b py-3"
								key={work.id}
							>
								<a
									aria-label={`${copy.openSourceRecord}: ${work.key} ${work.title}`}
									className="min-w-0 truncate text-sm underline-offset-4 hover:underline"
									href={workHref(work)}
								>
									<span className="font-medium">{work.key}</span>
									<span>{` ${work.title}`}</span>
									<span className="text-muted-foreground">{` · ${work.projectName}`}</span>
								</a>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function EligibleWork({
	copy,
	eligible,
	onAdd,
}: {
	copy: typeof DAILY_FOCUS_COPY;
	eligible: readonly DailyFocusWork[];
	onAdd: (workId: string) => void;
}) {
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const selected = new FormData(event.currentTarget).get("workId");
			if (typeof selected === "string" && selected.length > 0) {
				onAdd(selected);
			}
		},
		[onAdd]
	);
	if (eligible.length === 0) {
		return null;
	}
	return (
		<form className="mb-8 flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
			<Field className="min-w-56">
				<FieldLabel htmlFor="daily-focus-work">{copy.work}</FieldLabel>
				<NativeSelect defaultValue="" id="daily-focus-work" name="workId">
					<NativeSelectOption disabled value="">
						{copy.work}
					</NativeSelectOption>
					{eligible.map((work) => (
						<NativeSelectOption key={work.id} value={work.id}>
							{`${work.key} ${work.title} · ${work.projectName}`}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<Button type="submit">{copy.add}</Button>
		</form>
	);
}

function CandidatesList({
	candidates,
	copy,
	onAccept,
	onReject,
}: {
	candidates: readonly DailyFocusCandidate[];
	copy: typeof DAILY_FOCUS_COPY;
	onAccept: (workId: string) => void;
	onReject: (workId: string) => void;
}) {
	if (candidates.length === 0) {
		return (
			<section aria-labelledby="daily-focus-candidates" className="mb-8">
				<h2 className="mb-3 font-medium text-sm" id="daily-focus-candidates">
					{copy.candidates}
				</h2>
				<p>{copy.candidatesEmpty}</p>
				<p className="mt-1 text-muted-foreground text-sm">
					{copy.candidatesRule}
				</p>
			</section>
		);
	}
	return (
		<section aria-labelledby="daily-focus-candidates" className="mb-8">
			<h2 className="mb-3 font-medium text-sm" id="daily-focus-candidates">
				{copy.candidates}
			</h2>
			<ul aria-label={copy.candidates}>
				{candidates.map((work) => (
					<CandidateRow
						copy={copy}
						key={work.id}
						onAccept={onAccept}
						onReject={onReject}
						work={work}
					/>
				))}
			</ul>
		</section>
	);
}

function CandidateRow({
	copy,
	onAccept,
	onReject,
	work,
}: {
	copy: typeof DAILY_FOCUS_COPY;
	onAccept: (workId: string) => void;
	onReject: (workId: string) => void;
	work: DailyFocusCandidate;
}) {
	const accept = useCallback(() => {
		onAccept(work.id);
	}, [onAccept, work.id]);
	const reject = useCallback(() => {
		onReject(work.id);
	}, [onReject, work.id]);
	return (
		<li className="flex items-center justify-between gap-3 border-border border-b py-3">
			<div className="min-w-0">
				<a
					className="block truncate text-sm underline-offset-4 hover:underline"
					href={workHref(work)}
				>
					<span className="font-medium">{work.key}</span>
					<span>{` ${work.title}`}</span>
					<span className="text-muted-foreground">{` · ${work.projectName}`}</span>
				</a>
				<p className="text-muted-foreground text-sm">{work.reason}</p>
			</div>
			<div className="flex shrink-0 gap-2">
				<Button onClick={accept} size="sm" type="button">
					{copy.accept}
				</Button>
				<Button onClick={reject} size="sm" type="button" variant="outline">
					{copy.reject}
				</Button>
			</div>
		</li>
	);
}

function MembersList({
	copy,
	members,
	onRemove,
	query,
}: {
	copy: typeof DAILY_FOCUS_COPY;
	members: readonly DailyFocusWork[] | undefined;
	onRemove: (workId: string) => void;
	query: { isError: boolean; isPending: boolean };
}) {
	const presentation = dailyFocusListPresentation({
		data: members,
		isError: query.isError,
		isPending: query.isPending,
	});
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
		<ul aria-label={copy.dailyFocus}>
			{presentation.members.map((work) => (
				<MemberRow copy={copy} key={work.id} onRemove={onRemove} work={work} />
			))}
		</ul>
	);
}

function MemberRow({
	copy,
	onRemove,
	work,
}: {
	copy: typeof DAILY_FOCUS_COPY;
	onRemove: (workId: string) => void;
	work: DailyFocusWork;
}) {
	const remove = useCallback(() => {
		onRemove(work.id);
	}, [onRemove, work.id]);
	return (
		<li className="flex items-center justify-between gap-3 border-border border-b py-3">
			<a
				className="min-w-0 truncate text-sm underline-offset-4 hover:underline"
				href={workHref(work)}
			>
				<span className="font-medium">{work.key}</span>
				<span>{` ${work.title}`}</span>
				<span className="text-muted-foreground">{` · ${work.projectName}`}</span>
			</a>
			<Button onClick={remove} size="sm" type="button" variant="outline">
				{copy.remove}
			</Button>
		</li>
	);
}

function WhatHappenedToday({
	copy,
	query,
	rows,
}: {
	copy: typeof DAILY_FOCUS_COPY;
	query: { isError: boolean; isPending: boolean };
	rows: readonly WhatHappenedTodayRow[] | undefined;
}) {
	const presentation = dailyFocusListPresentation({
		data: rows,
		isError: query.isError,
		isPending: query.isPending,
	});
	return (
		<section aria-labelledby="what-happened-today" className="mt-10">
			<h2 className="mb-3 font-medium text-lg" id="what-happened-today">
				{copy.whatHappenedToday}
			</h2>
			{presentation.kind === "failed" ? <p>{MAIN_FLOW_COPY.failed}</p> : null}
			{presentation.kind === "loading" ? <p>{copy.loading}</p> : null}
			{presentation.kind === "list" ? (
				<ul aria-label={copy.whatHappenedToday}>
					{presentation.members.map((row) => (
						<WhatHappenedRow key={row.id} row={row} />
					))}
				</ul>
			) : null}
		</section>
	);
}

function WhatHappenedRow({ row }: { row: WhatHappenedTodayRow }) {
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 border-border border-b py-3">
			<div className="min-w-0">
				<time
					className="text-muted-foreground text-sm"
					dateTime={row.occurredAt}
				>
					{row.occurredAtDisplay}
				</time>
				<p className="truncate text-sm">
					<span className="font-medium">{row.kindLabel}</span>
					<span className="text-muted-foreground">{` · ${row.projectName}`}</span>
				</p>
				<p className="truncate text-sm">
					<span className="font-medium">{row.sourceKey}</span>
					<span>{` ${row.sourceTitle}`}</span>
				</p>
			</div>
			<a
				className="text-sm underline-offset-4 hover:underline"
				href={row.sourceHref}
			>
				{row.openSourceRecord}
			</a>
		</li>
	);
}
