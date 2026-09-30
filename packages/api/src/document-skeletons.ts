export const DOCUMENT_STARTER_SKELETONS = [
  {
    emptyHeadings: [
      "Context",
      "Goals",
      "Behaviors",
      "Pain Points",
      "Constraints",
      "Evidence",
      "Open Questions",
    ],
    skeleton: "Persona",
    surface: "Document",
  },
  {
    emptyHeadings: [
      "Period",
      "What worked?",
      "What did not?",
      "What did we learn?",
      "Decisions",
      "Next changes",
      "Related records",
    ],
    skeleton: "Retrospective",
    surface: "Document",
  },
  {
    emptyHeadings: [
      "Release",
      "Audience",
      "Scope",
      "Readiness",
      "Communication",
      "Launch steps",
      "Risks",
      "Observation plan",
      "Related records",
    ],
    skeleton: "Launch Plan",
    surface: "Document",
  },
] as const;

export const DOCUMENT_STARTER_SKELETON_OPTIONS = DOCUMENT_STARTER_SKELETONS.map(
  ({ skeleton }) => skeleton,
);
