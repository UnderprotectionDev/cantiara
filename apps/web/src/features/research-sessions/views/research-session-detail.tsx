import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Spinner } from "@cantiara/ui/components/spinner";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import {
	CONSENT_VALUES,
	RESEARCH_SESSION_STATUSES,
	RESEARCH_SESSIONS_COPY,
} from "@/features/research-sessions/forms/research-sessions-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function ResearchSessionDetail({
	onChanged,
	sessionId,
}: {
	onChanged?: () => void;
	sessionId: string;
}) {
	const session = useQuery(
		orpc.researchSessions.get.queryOptions({ input: { sessionId } })
	);
	const [quote, setQuote] = useState("");
	const [speaker, setSpeaker] = useState("");
	const [observation, setObservation] = useState("");
	const [interpretation, setInterpretation] = useState("");
	const [fileAttachmentId, setFileAttachmentId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.researchSessions.get.queryKey({ input: { sessionId } }),
		});
		onChanged?.();
	}, [onChanged, sessionId]);
	const setConsent = useMutation(
		orpc.researchSessions.setConsent.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				await invalidate();
			},
		})
	);
	const setStatus = useMutation(
		orpc.researchSessions.setStatus.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				await invalidate();
			},
		})
	);
	const writeQuote = useMutation(
		orpc.researchSessions.writeQuote.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				setQuote("");
				setSpeaker("");
				await invalidate();
			},
		})
	);
	const writeObservation = useMutation(
		orpc.researchSessions.writeObservation.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				setObservation("");
				await invalidate();
			},
		})
	);
	const writeInterpretation = useMutation(
		orpc.researchSessions.writeFounderInterpretation.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				setInterpretation("");
				await invalidate();
			},
		})
	);
	const attachFile = useMutation(
		orpc.researchSessions.attachFile.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				setFileAttachmentId("");
				await invalidate();
			},
		})
	);
	const onQuoteSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!session.data) {
				return;
			}
			writeQuote.mutate({
				baseRevision: session.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					body: quote,
					sessionId,
					speakerLabel: speaker.trim() === "" ? null : speaker.trim(),
				},
			});
		},
		[quote, session.data, sessionId, speaker, writeQuote]
	);
	const onObservationSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!session.data) {
				return;
			}
			writeObservation.mutate({
				baseRevision: session.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					body: observation,
					sessionId,
				},
			});
		},
		[observation, session.data, sessionId, writeObservation]
	);
	const onInterpretationSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!session.data) {
				return;
			}
			writeInterpretation.mutate({
				baseRevision: session.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					body: interpretation,
					sessionId,
				},
			});
		},
		[interpretation, session.data, sessionId, writeInterpretation]
	);
	const onAttachFileSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!session.data) {
				return;
			}
			attachFile.mutate({
				baseRevision: session.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					fileAttachmentId: fileAttachmentId.trim(),
					sessionId,
				},
			});
		},
		[attachFile, fileAttachmentId, session.data, sessionId]
	);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			if (!session.data) {
				return;
			}
			const next = event.target.value;
			if (
				next !== RESEARCH_SESSIONS_COPY.planned &&
				next !== RESEARCH_SESSIONS_COPY.completed &&
				next !== RESEARCH_SESSIONS_COPY.cancelled
			) {
				return;
			}
			setStatus.mutate({
				baseRevision: session.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { sessionId, status: next },
			});
		},
		[session.data, sessionId, setStatus]
	);
	const onConsentChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			if (!session.data) {
				return;
			}
			const next = event.target.value;
			if (
				next !== RESEARCH_SESSIONS_COPY.notAsked &&
				next !== RESEARCH_SESSIONS_COPY.allowed &&
				next !== RESEARCH_SESSIONS_COPY.notAllowed &&
				next !== RESEARCH_SESSIONS_COPY.notApplicable
			) {
				return;
			}
			setConsent.mutate({
				baseRevision: session.data.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { consent: next, sessionId },
			});
		},
		[session.data, sessionId, setConsent]
	);
	const onQuoteChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setQuote(event.target.value);
		},
		[]
	);
	const onSpeakerChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setSpeaker(event.target.value);
		},
		[]
	);
	const onObservationChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setObservation(event.target.value);
		},
		[]
	);
	const onInterpretationChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setInterpretation(event.target.value);
		},
		[]
	);
	const onFileAttachmentIdChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setFileAttachmentId(event.target.value);
		},
		[]
	);

	if (session.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (session.isError || !session.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<article className="flex flex-col gap-4">
			<header>
				<h2 className="font-medium text-base">{session.data.title}</h2>
				<p className="text-muted-foreground text-sm">
					{session.data.status} · {session.data.consent}
				</p>
			</header>
			<p className="text-muted-foreground text-sm">
				{session.data.consentIsNotLegalJudgment}{" "}
				{session.data.youRemainResponsible}
			</p>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{RESEARCH_SESSIONS_COPY.purpose}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{session.data.purpose}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{RESEARCH_SESSIONS_COPY.questionGuide}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{session.data.questionGuide}
				</p>
			</section>
			{session.data.scheduledAt ? (
				<p className="text-sm">
					{RESEARCH_SESSIONS_COPY.scheduledAt}: {session.data.scheduledAt}
				</p>
			) : null}
			{session.data.consentNote ? (
				<p className="text-sm">
					{RESEARCH_SESSIONS_COPY.consentNote}: {session.data.consentNote}
				</p>
			) : null}
			<p className="text-sm">
				{RESEARCH_SESSIONS_COPY.recordedBy}:{" "}
				{session.data.consentRecordedByUserId}
			</p>
			<Field>
				<FieldLabel htmlFor="research-session-detail-status">
					{RESEARCH_SESSIONS_COPY.status}
				</FieldLabel>
				<NativeSelect
					id="research-session-detail-status"
					onChange={onStatusChange}
					value={session.data.status}
				>
					{RESEARCH_SESSION_STATUSES.map((item) => (
						<NativeSelectOption key={item} value={item}>
							{item}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<Field>
				<FieldLabel htmlFor="research-session-detail-consent">
					{RESEARCH_SESSIONS_COPY.consent}
				</FieldLabel>
				<NativeSelect
					id="research-session-detail-consent"
					onChange={onConsentChange}
					value={session.data.consent}
				>
					{CONSENT_VALUES.map((item) => (
						<NativeSelectOption key={item} value={item}>
							{item}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			{session.data.contactId ? (
				<p className="text-sm">
					{RESEARCH_SESSIONS_COPY.contact}: {session.data.contactId}
				</p>
			) : null}
			<form
				className="flex flex-col gap-3 border-foreground/70 border-l-2 pl-3"
				onSubmit={onQuoteSubmit}
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="research-session-quote">
							{RESEARCH_SESSIONS_COPY.participantQuote}
						</FieldLabel>
						<Textarea
							disabled={!session.data.consentGatesOpen}
							id="research-session-quote"
							onChange={onQuoteChange}
							value={quote}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="research-session-speaker">
							{RESEARCH_SESSIONS_COPY.speakerLabel}
						</FieldLabel>
						<Input
							disabled={!session.data.consentGatesOpen}
							id="research-session-speaker"
							onChange={onSpeakerChange}
							value={speaker}
						/>
					</Field>
				</FieldGroup>
				<Button disabled={!session.data.consentGatesOpen} type="submit">
					{RESEARCH_SESSIONS_COPY.participantQuote}
				</Button>
			</form>
			<form
				className="flex flex-col gap-3 border-muted-foreground/50 border-l-2 pl-3"
				onSubmit={onObservationSubmit}
			>
				<Field>
					<FieldLabel htmlFor="research-session-observation">
						{RESEARCH_SESSIONS_COPY.observation}
					</FieldLabel>
					<Textarea
						disabled={!session.data.consentGatesOpen}
						id="research-session-observation"
						onChange={onObservationChange}
						value={observation}
					/>
				</Field>
				<Button disabled={!session.data.consentGatesOpen} type="submit">
					{RESEARCH_SESSIONS_COPY.observation}
				</Button>
			</form>
			<form
				className="flex flex-col gap-3 border-muted-foreground border-l-2 border-dashed pl-3"
				onSubmit={onInterpretationSubmit}
			>
				<Field>
					<FieldLabel htmlFor="research-session-interpretation">
						{RESEARCH_SESSIONS_COPY.founderInterpretation}
					</FieldLabel>
					<Textarea
						disabled={!session.data.consentGatesOpen}
						id="research-session-interpretation"
						onChange={onInterpretationChange}
						value={interpretation}
					/>
				</Field>
				<Button disabled={!session.data.consentGatesOpen} type="submit">
					{RESEARCH_SESSIONS_COPY.founderInterpretation}
				</Button>
			</form>
			<form className="flex flex-col gap-3" onSubmit={onAttachFileSubmit}>
				<Field>
					<FieldLabel htmlFor="research-session-file-attachment">
						{RESEARCH_SESSIONS_COPY.attachFile}
					</FieldLabel>
					<Input
						disabled={!session.data.consentGatesOpen}
						id="research-session-file-attachment"
						onChange={onFileAttachmentIdChange}
						value={fileAttachmentId}
					/>
				</Field>
				<Button disabled={!session.data.consentGatesOpen} type="submit">
					{RESEARCH_SESSIONS_COPY.attachFile}
				</Button>
			</form>
			{session.data.notes.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{session.data.notes.map((note) => (
						<li
							className={noteListClass(note.kind)}
							data-note-kind={note.kind}
							key={note.id}
						>
							{note.kind}
							{speakerSuffix(note.kind, note.speakerLabel)}: {note.body}
						</li>
					))}
				</ul>
			) : null}
			{session.data.files.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{session.data.files.map((file) => (
						<li className="text-sm" key={file.id}>
							{RESEARCH_SESSIONS_COPY.attachFile}: {file.fileAttachmentId}
						</li>
					))}
				</ul>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
		</article>
	);
}

function noteListClass(kind: string): string {
	if (kind === RESEARCH_SESSIONS_COPY.participantQuote) {
		return "border-l-2 border-foreground/70 pl-3 text-sm";
	}
	if (kind === RESEARCH_SESSIONS_COPY.founderInterpretation) {
		return "border-l-2 border-dashed border-muted-foreground pl-3 text-sm italic";
	}
	return "border-l-2 border-muted-foreground/50 pl-3 text-sm";
}

function speakerSuffix(kind: string, speakerLabel: string | null): string {
	if (kind !== RESEARCH_SESSIONS_COPY.participantQuote || !speakerLabel) {
		return "";
	}
	return ` · ${speakerLabel}`;
}
