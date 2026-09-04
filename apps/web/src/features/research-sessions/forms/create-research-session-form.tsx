import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	CONSENT_VALUES,
	RESEARCH_SESSION_STATUSES,
	RESEARCH_SESSIONS_COPY,
} from "./research-sessions-copy";

export default function CreateResearchSessionForm({
	onCreated,
	projectId,
}: {
	onCreated?: (sessionId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [channel, setChannel] = useState("");
	const [consent, setConsent] = useState<string>(
		RESEARCH_SESSIONS_COPY.notAsked
	);
	const [contactId, setContactId] = useState("");
	const [duration, setDuration] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [facilitator, setFacilitator] = useState("");
	const [purpose, setPurpose] = useState("");
	const [questionGuide, setQuestionGuide] = useState("");
	const [consentNote, setConsentNote] = useState("");
	const [scheduledAt, setScheduledAt] = useState("");
	const [scopeNote, setScopeNote] = useState("");
	const [status, setStatus] = useState<string>(RESEARCH_SESSIONS_COPY.planned);
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.researchSessions.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.researchSessions.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.session.id);
					recordSave();
					setChannel("");
					setConsent(RESEARCH_SESSIONS_COPY.notAsked);
					setContactId("");
					setDuration("");
					setError(null);
					setFacilitator("");
					setPurpose("");
					setQuestionGuide("");
					setConsentNote("");
					setScopeNote("");
					setScheduledAt("");
					setStatus(RESEARCH_SESSIONS_COPY.planned);
					setTitle("");
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			const durationMinutes = Number.parseInt(duration, 10);
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						channel,
						consent:
							consent === RESEARCH_SESSIONS_COPY.allowed ||
							consent === RESEARCH_SESSIONS_COPY.notAllowed ||
							consent === RESEARCH_SESSIONS_COPY.notApplicable ||
							consent === RESEARCH_SESSIONS_COPY.notAsked
								? consent
								: RESEARCH_SESSIONS_COPY.notAsked,
						consentNote,
						contactId: contactId.trim() === "" ? null : contactId.trim(),
						durationMinutes:
							Number.isFinite(durationMinutes) && durationMinutes > 0
								? durationMinutes
								: null,
						facilitator,
						projectId,
						purpose,
						questionGuide,
						scheduledAt:
							scheduledAt.trim() === ""
								? null
								: new Date(scheduledAt).toISOString(),
						scopeNote,
						status:
							status === RESEARCH_SESSIONS_COPY.completed ||
							status === RESEARCH_SESSIONS_COPY.cancelled ||
							status === RESEARCH_SESSIONS_COPY.planned
								? status
								: RESEARCH_SESSIONS_COPY.planned,
						title,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			channel,
			consent,
			consentNote,
			contactId,
			create,
			duration,
			facilitator,
			markUnsaved,
			projectId,
			purpose,
			questionGuide,
			scheduledAt,
			scopeNote,
			status,
			title,
		]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onPurposeChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setPurpose(event.target.value);
		},
		[]
	);
	const onGuideChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setQuestionGuide(event.target.value);
		},
		[]
	);
	const onScheduledAtChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setScheduledAt(event.target.value);
		},
		[]
	);
	const onConsentNoteChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setConsentNote(event.target.value);
		},
		[]
	);
	const onChannelChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setChannel(event.target.value);
		},
		[]
	);
	const onFacilitatorChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setFacilitator(event.target.value);
		},
		[]
	);
	const onScopeChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setScopeNote(event.target.value);
		},
		[]
	);
	const onDurationChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setDuration(event.target.value);
		},
		[]
	);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setStatus(event.target.value);
		},
		[]
	);
	const onConsentChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setConsent(event.target.value);
		},
		[]
	);
	const onContactChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setContactId(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="research-session-title">
						{RESEARCH_SESSIONS_COPY.title}
					</FieldLabel>
					<Input
						id="research-session-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-purpose">
						{RESEARCH_SESSIONS_COPY.purpose}
					</FieldLabel>
					<Textarea
						id="research-session-purpose"
						onChange={onPurposeChange}
						required
						value={purpose}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-guide">
						{RESEARCH_SESSIONS_COPY.questionGuide}
					</FieldLabel>
					<Textarea
						id="research-session-guide"
						onChange={onGuideChange}
						required
						value={questionGuide}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-time">
						{RESEARCH_SESSIONS_COPY.scheduledAt}
					</FieldLabel>
					<Input
						id="research-session-time"
						onChange={onScheduledAtChange}
						type="datetime-local"
						value={scheduledAt}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-consent-note">
						{RESEARCH_SESSIONS_COPY.consentNote}
					</FieldLabel>
					<Textarea
						id="research-session-consent-note"
						onChange={onConsentNoteChange}
						value={consentNote}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-channel">
						{RESEARCH_SESSIONS_COPY.channel}
					</FieldLabel>
					<Input
						id="research-session-channel"
						onChange={onChannelChange}
						value={channel}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-facilitator">
						{RESEARCH_SESSIONS_COPY.facilitator}
					</FieldLabel>
					<Input
						id="research-session-facilitator"
						onChange={onFacilitatorChange}
						value={facilitator}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-scope">
						{RESEARCH_SESSIONS_COPY.scopeNote}
					</FieldLabel>
					<Textarea
						id="research-session-scope"
						onChange={onScopeChange}
						value={scopeNote}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-duration">
						{RESEARCH_SESSIONS_COPY.duration}
					</FieldLabel>
					<Input
						id="research-session-duration"
						inputMode="numeric"
						onChange={onDurationChange}
						value={duration}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-status">
						{RESEARCH_SESSIONS_COPY.status}
					</FieldLabel>
					<NativeSelect
						id="research-session-status"
						onChange={onStatusChange}
						value={status}
					>
						{RESEARCH_SESSION_STATUSES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-consent">
						{RESEARCH_SESSIONS_COPY.consent}
					</FieldLabel>
					<NativeSelect
						id="research-session-consent"
						onChange={onConsentChange}
						value={consent}
					>
						{CONSENT_VALUES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="research-session-contact">
						{RESEARCH_SESSIONS_COPY.optionalContact}
					</FieldLabel>
					<Input
						id="research-session-contact"
						onChange={onContactChange}
						value={contactId}
					/>
				</Field>
			</FieldGroup>
			<p className="text-muted-foreground text-sm">
				{RESEARCH_SESSIONS_COPY.consentIsNotLegalJudgment}{" "}
				{RESEARCH_SESSIONS_COPY.youRemainResponsible}
			</p>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">
				{RESEARCH_SESSIONS_COPY.createResearchSession}
			</Button>
		</form>
	);
}
