export const RESEARCH_SESSIONS_COPY = {
	allowed: "Allowed",
	attachFile: "Attach File Attachment",
	cancelled: "Cancelled",
	channel: "Channel",
	completed: "Completed",
	confirmConvert: "Confirm",
	consent: "Consent",
	consentIsNotLegalJudgment: "Consent is not a legal compliance judgment.",
	consentNote: "Consent note",
	contact: "Contact",
	convertToNewRecordAndBind: "Convert to new record and bind",
	createResearchSession: "Create Research Session",
	duration: "Duration",
	facilitator: "Facilitator",
	founderInterpretation: "Founder interpretation",
	noResearchSessions: "No Research Sessions yet.",
	notAllowed: "Not allowed",
	notApplicable: "Not applicable",
	notAsked: "Not asked",
	observation: "Observation",
	optionalContact: "Contact (optional)",
	participantQuote: "Participant quote",
	planned: "Planned",
	purpose: "Purpose",
	questionGuide: "Question guide",
	recordedBy: "Recorded by",
	researchSession: "Research Session",
	scheduledAt: "Time",
	scopeNote: "Scope note",
	speakerLabel: "Speaker label",
	status: "Status",
	targetProject: "Project",
	targetType: "Target type",
	title: "Title",
	versionPinnedEvidence: "Version-pinned evidence",
	youRemainResponsible: "You remain responsible for your obligations.",
} as const;

export const RESEARCH_SESSION_STATUSES = [
	RESEARCH_SESSIONS_COPY.planned,
	RESEARCH_SESSIONS_COPY.completed,
	RESEARCH_SESSIONS_COPY.cancelled,
] as const;

export const CONSENT_VALUES = [
	RESEARCH_SESSIONS_COPY.notAsked,
	RESEARCH_SESSIONS_COPY.allowed,
	RESEARCH_SESSIONS_COPY.notAllowed,
	RESEARCH_SESSIONS_COPY.notApplicable,
] as const;

export const CONVERT_TARGET_KINDS = [
	"Feedback",
	"Assumption",
	"Open Question",
	"Work",
	"Feature",
	"Decision",
] as const;

export type ConvertTargetKind = (typeof CONVERT_TARGET_KINDS)[number];
