import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import {
	FEEDBACK_COPY,
	FEEDBACK_EVIDENCE_ROLES,
	FEEDBACK_FOLLOW_UP_STATUSES,
} from "@/features/feedback/forms/feedback-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function FeedbackEvidenceForm({
	feedbackId,
	originalMessage,
	projectId,
}: {
	feedbackId: string;
	originalMessage: string;
	projectId: string;
}) {
	const [workId, setWorkId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const works = useQuery(
		orpc.workLifecycle.list.queryOptions({
			input: { projectId },
		})
	);
	const links = useQuery(
		orpc.feedback.listEvidence.queryOptions({
			input: { feedbackId },
		})
	);
	const bind = useMutation(
		orpc.feedback.bindEvidence.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				setWorkId("");
				await queryClient.invalidateQueries({
					queryKey: orpc.feedback.listEvidence.queryKey({
						input: { feedbackId },
					}),
				});
			},
		})
	);
	const onWorkChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setWorkId(event.target.value);
	}, []);
	const onBind = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (workId.trim() === "") {
				return;
			}
			bind.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { feedbackId, workId },
			});
		},
		[bind, feedbackId, workId]
	);
	const workRows = works.data ?? [];

	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">{FEEDBACK_COPY.evidenceQuality}</h3>
			<p className="whitespace-pre-wrap text-muted-foreground text-sm">
				{FEEDBACK_COPY.originalMessage}: {originalMessage}
			</p>
			<form
				aria-label={FEEDBACK_COPY.bindAsEvidenceToExistingRecord}
				className="flex flex-col gap-2 border border-input p-2"
				onSubmit={onBind}
			>
				<Field>
					<FieldLabel htmlFor={`feedback-evidence-work-${feedbackId}`}>
						{FEEDBACK_COPY.work}
					</FieldLabel>
					<NativeSelect
						id={`feedback-evidence-work-${feedbackId}`}
						onChange={onWorkChange}
						value={workId}
					>
						<NativeSelectOption value="">
							{FEEDBACK_COPY.work}
						</NativeSelectOption>
						{workRows.map((work) => (
							<NativeSelectOption key={work.id} value={work.id}>
								{work.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button disabled={workId.trim() === ""} type="submit">
					{FEEDBACK_COPY.bindAsEvidenceToExistingRecord}
				</Button>
				{error ? <p role="alert">{error}</p> : null}
			</form>
			{(links.data ?? []).map((link) => (
				<EvidenceLinkFields feedbackId={feedbackId} key={link.id} link={link} />
			))}
		</section>
	);
}

function EvidenceLinkFields({
	feedbackId,
	link,
}: {
	feedbackId: string;
	link: {
		audienceFit: string;
		currentWorkaround: string;
		evidenceRole: string;
		followUp: string | null;
		id: string;
		impactSeverity: string;
		independence: string;
		interpretationActorId: string | null;
		interpretationSetAt: string | null;
		originalMessage: string;
		reportedProblem: string;
		suggestedSolution: string;
		usageFrequency: string;
		workId: string;
	};
}) {
	const [reportedProblem, setReportedProblem] = useState(link.reportedProblem);
	const [suggestedSolution, setSuggestedSolution] = useState(
		link.suggestedSolution
	);
	const [currentWorkaround, setCurrentWorkaround] = useState(
		link.currentWorkaround
	);
	const [impactSeverity, setImpactSeverity] = useState(link.impactSeverity);
	const [usageFrequency, setUsageFrequency] = useState(link.usageFrequency);
	const [independence, setIndependence] = useState(link.independence);
	const [audienceFit, setAudienceFit] = useState(link.audienceFit);
	const [role, setRole] = useState(link.evidenceRole);
	const [followUp, setFollowUp] = useState(link.followUp ?? "");
	const [error, setError] = useState<string | null>(null);
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.feedback.listEvidence.queryKey({
				input: { feedbackId },
			}),
		});
	}, [feedbackId]);
	const saveQuality = useMutation(
		orpc.feedback.setEvidenceQuality.mutationOptions({
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
	const saveRole = useMutation(
		orpc.feedback.setEvidenceRole.mutationOptions({
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
	const saveFollowUp = useMutation(
		orpc.feedback.setEvidenceFollowUp.mutationOptions({
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
	const onQuality = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			saveQuality.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					audienceFit,
					currentWorkaround,
					feedbackId,
					impactSeverity,
					independence,
					reportedProblem,
					suggestedSolution,
					usageFrequency,
					workId: link.workId,
				},
			});
		},
		[
			audienceFit,
			currentWorkaround,
			feedbackId,
			impactSeverity,
			independence,
			link.workId,
			reportedProblem,
			saveQuality,
			suggestedSolution,
			usageFrequency,
		]
	);
	const onRole = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			saveRole.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					evidenceRole: role as (typeof FEEDBACK_EVIDENCE_ROLES)[number],
					feedbackId,
					workId: link.workId,
				},
			});
		},
		[feedbackId, link.workId, role, saveRole]
	);
	const onFollowUp = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			saveFollowUp.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					feedbackId,
					followUp:
						followUp === ""
							? null
							: (followUp as (typeof FEEDBACK_FOLLOW_UP_STATUSES)[number]),
					workId: link.workId,
				},
			});
		},
		[feedbackId, followUp, link.workId, saveFollowUp]
	);
	const onRoleChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRole(event.target.value);
	}, []);
	const onFollowUpChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setFollowUp(event.target.value);
		},
		[]
	);

	return (
		<div className="flex flex-col gap-3 border border-input p-2">
			<p className="whitespace-pre-wrap text-sm">
				{FEEDBACK_COPY.originalMessage}: {link.originalMessage}
			</p>
			<form aria-label={FEEDBACK_COPY.evidenceQuality} onSubmit={onQuality}>
				<FieldGroup>
					<QualityField
						id={`${link.id}-reported`}
						label={FEEDBACK_COPY.reportedProblem}
						onChange={setReportedProblem}
						value={reportedProblem}
					/>
					<QualityField
						id={`${link.id}-solution`}
						label={FEEDBACK_COPY.suggestedSolution}
						onChange={setSuggestedSolution}
						value={suggestedSolution}
					/>
					<QualityField
						id={`${link.id}-workaround`}
						label={FEEDBACK_COPY.currentWorkaround}
						onChange={setCurrentWorkaround}
						value={currentWorkaround}
					/>
					<QualityField
						id={`${link.id}-impact`}
						label={FEEDBACK_COPY.impactSeverity}
						onChange={setImpactSeverity}
						value={impactSeverity}
					/>
					<QualityField
						id={`${link.id}-frequency`}
						label={FEEDBACK_COPY.usageFrequency}
						onChange={setUsageFrequency}
						value={usageFrequency}
					/>
					<QualityField
						id={`${link.id}-independence`}
						label={FEEDBACK_COPY.independence}
						onChange={setIndependence}
						value={independence}
					/>
					<QualityField
						id={`${link.id}-audience`}
						label={FEEDBACK_COPY.audienceFit}
						onChange={setAudienceFit}
						value={audienceFit}
					/>
				</FieldGroup>
				{link.interpretationSetAt ? (
					<p className="mt-2 text-muted-foreground text-sm">
						{FEEDBACK_COPY.founderInterpretation} (
						{FEEDBACK_COPY.impactSeverity}, {FEEDBACK_COPY.usageFrequency},{" "}
						{FEEDBACK_COPY.independence}, {FEEDBACK_COPY.audienceFit}):{" "}
						{link.interpretationActorId} {link.interpretationSetAt}
					</p>
				) : null}
				<Button className="mt-2" type="submit">
					{FEEDBACK_COPY.evidenceQuality}
				</Button>
			</form>
			<form aria-label={FEEDBACK_COPY.evidenceRole} onSubmit={onRole}>
				<Field>
					<FieldLabel htmlFor={`${link.id}-role`}>
						{FEEDBACK_COPY.evidenceRole}
					</FieldLabel>
					<NativeSelect
						id={`${link.id}-role`}
						onChange={onRoleChange}
						value={role}
					>
						{FEEDBACK_EVIDENCE_ROLES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button className="mt-2" type="submit">
					{FEEDBACK_COPY.evidenceRole}
				</Button>
			</form>
			<form aria-label={FEEDBACK_COPY.followUp} onSubmit={onFollowUp}>
				<Field>
					<FieldLabel htmlFor={`${link.id}-follow-up`}>
						{FEEDBACK_COPY.followUp}
					</FieldLabel>
					<NativeSelect
						id={`${link.id}-follow-up`}
						onChange={onFollowUpChange}
						value={followUp}
					>
						<NativeSelectOption value="" />
						{FEEDBACK_FOLLOW_UP_STATUSES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button className="mt-2" type="submit">
					{FEEDBACK_COPY.followUp}
				</Button>
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}

function QualityField({
	id,
	label,
	onChange,
	value,
}: {
	id: string;
	label: string;
	onChange: (value: string) => void;
	value: string;
}) {
	const onFieldChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onChange(event.target.value);
		},
		[onChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea id={id} onChange={onFieldChange} value={value} />
		</Field>
	);
}
