export const researchSessionErrors = {
  RESEARCH_SESSION_CHANGED: {
    status: 409,
    message: "Research Session changed. Reload before saving.",
    writeOutcome: "not-written" as const,
  },
  RESEARCH_SESSION_CONSENT_REQUIRED: {
    status: 403,
    message: "Consent does not allow this Research Session operation.",
    writeOutcome: "not-written" as const,
  },
  RESEARCH_SESSION_BINDING_CONSENT_REQUIRED: {
    status: 403,
    message: "Consent does not allow this Research Session operation.",
  },
};
