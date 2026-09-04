import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import CreateResearchSessionForm from "@/features/research-sessions/forms/create-research-session-form";
import {
	CONSENT_VALUES,
	RESEARCH_SESSION_STATUSES,
	RESEARCH_SESSIONS_COPY,
} from "@/features/research-sessions/forms/research-sessions-copy";
import { orpc } from "@/utils/orpc";

import ResearchSessionDetail from "./research-session-detail";

export default function ResearchSessionArea({
	onSessionId,
	projectId,
	sessionId,
}: {
	onSessionId?: (sessionId: string | null) => void;
	projectId: string;
	sessionId?: string | null;
}) {
	const [consent, setConsent] = useState<string>("");
	const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
	const [status, setStatus] = useState<string>("");
	const selectedId = sessionId ?? localSelectedId;
	const sessions = useQuery(
		orpc.researchSessions.list.queryOptions({
			input: {
				projectId,
				...(CONSENT_VALUES.includes(consent as (typeof CONSENT_VALUES)[number])
					? { consent: consent as (typeof CONSENT_VALUES)[number] }
					: {}),
				...(RESEARCH_SESSION_STATUSES.includes(
					status as (typeof RESEARCH_SESSION_STATUSES)[number]
				)
					? { status: status as (typeof RESEARCH_SESSION_STATUSES)[number] }
					: {}),
			},
		})
	);
	const onCreated = useCallback(
		(createdId: string) => {
			setLocalSelectedId(createdId);
			onSessionId?.(createdId);
		},
		[onSessionId]
	);
	const onSelect = useCallback(
		(id: string) => {
			setLocalSelectedId(id);
			onSessionId?.(id);
		},
		[onSessionId]
	);
	const onStatusFilterChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setStatus(event.target.value);
		},
		[]
	);
	const onConsentFilterChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setConsent(event.target.value);
		},
		[]
	);
	const onListChanged = useCallback(() => {
		sessions.refetch().catch(() => undefined);
	}, [sessions]);

	if (sessions.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (sessions.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateResearchSessionForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="research-session-status-filter">
						{RESEARCH_SESSIONS_COPY.status}
					</FieldLabel>
					<NativeSelect
						id="research-session-status-filter"
						onChange={onStatusFilterChange}
						value={status}
					>
						<NativeSelectOption value="">
							{RECORD_DISCOVERY_COPY.anyScope}
						</NativeSelectOption>
						{RESEARCH_SESSION_STATUSES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-consent-filter">
						{RESEARCH_SESSIONS_COPY.consent}
					</FieldLabel>
					<NativeSelect
						id="research-session-consent-filter"
						onChange={onConsentFilterChange}
						value={consent}
					>
						<NativeSelectOption value="">
							{RECORD_DISCOVERY_COPY.anyScope}
						</NativeSelectOption>
						{CONSENT_VALUES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{sessions.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>
								{RESEARCH_SESSIONS_COPY.noResearchSessions}
							</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{sessions.data.map((item) => (
							<li key={item.id}>
								<SessionRow
									consent={item.consent}
									id={item.id}
									onSelect={onSelect}
									selected={item.id === selectedId}
									status={item.status}
									title={item.title}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<ResearchSessionDetail
						onChanged={onListChanged}
						sessionId={selectedId}
					/>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{RESEARCH_SESSIONS_COPY.researchSession}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function SessionRow({
	consent,
	id,
	onSelect,
	selected,
	status,
	title,
}: {
	consent: string;
	id: string;
	onSelect: (id: string) => void;
	selected: boolean;
	status: string;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			<span className="font-medium">{title}</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">
				{status} · {consent}
			</span>
		</button>
	);
}
