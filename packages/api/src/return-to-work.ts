import { addDays, formatISO, parseISO } from "date-fns";
import { z } from "zod";

const identifier = z.string().trim().min(1).max(255);
export const returnContextInputSchema = z
  .object({
    projectId: identifier,
    workId: identifier.optional(),
  })
  .strict();
export const nextConcreteStepSchema = z.string().trim().max(4000).nullable();
export const saveNextConcreteStepInputSchema = returnContextInputSchema
  .extend({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifier,
    nextConcreteStep: nextConcreteStepSchema.transform(
      (value) => value || null,
    ),
  })
  .strict();
export type ReturnContext = z.infer<typeof returnContextInputSchema>;
export type SaveNextConcreteStepInput = z.input<
  typeof saveNextConcreteStepInputSchema
>;
export const RETURN_CARD_REASONS = [
  "Recently edited",
  "Recently viewed",
  "Upcoming date",
  "Open risk",
  "Pending GitHub development signal",
] as const;
export interface ReturnSource {
  id: string;
  lastViewedAt: string | null;
  nextConcreteStep: string | null;
  nextConcreteStepUpdatedAt: string | null;
  openRisk: boolean;
  pendingGitHubSignal: boolean;
  projectId: string;
  recordType: "Project" | "Work" | "Risk";
  revision: number;
  sourcePath: string;
  targetDate: string | null;
  title: string;
  updatedAt: string;
}
export type ReturnCard = Omit<
  ReturnSource,
  "openRisk" | "pendingGitHubSignal" | "lastViewedAt"
> & {
  reasons: (typeof RETURN_CARD_REASONS)[number][];
};
export interface ReturnToWorkSummary {
  cards: ReturnCard[];
  source: ReturnSource | null;
}
export interface ReturnToWorkAccess {
  markViewed: (accountId: string, context: ReturnContext) => Promise<void>;
  read: (
    accountId: string,
    context: ReturnContext,
  ) => Promise<ReturnToWorkSummary>;
  saveNextStep: (
    accountId: string,
    input: SaveNextConcreteStepInput,
  ) => Promise<void>;
}

export function cardsForSources(
  sources: ReturnSource[],
  now: Date,
  timeZone: string,
): ReturnCard[] {
  const recent = addDays(now, -7).getTime();
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const today = `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
  const upcoming = formatISO(addDays(parseISO(today), 7), {
    representation: "date",
  });
  const cards = sources
    .map(({ lastViewedAt, openRisk, pendingGitHubSignal, ...source }) => {
      const reasons: ReturnCard["reasons"] = [];
      if (
        Date.parse(source.updatedAt) >= recent &&
        Date.parse(source.updatedAt) <= now.getTime()
      ) {
        reasons.push("Recently edited");
      }
      if (
        lastViewedAt &&
        Date.parse(lastViewedAt) >= recent &&
        Date.parse(lastViewedAt) <= now.getTime()
      ) {
        reasons.push("Recently viewed");
      }
      if (
        source.targetDate &&
        source.targetDate >= today &&
        source.targetDate <= upcoming
      ) {
        reasons.push("Upcoming date");
      }
      if (openRisk) {
        reasons.push("Open risk");
      }
      if (pendingGitHubSignal) {
        reasons.push("Pending GitHub development signal");
      }
      return { ...source, reasons };
    })
    .filter((card) => card.reasons.length > 0);
  cards.sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
  );
  // Reserve a place for each available reason before filling from recent edits.
  const visits = new Map(
    sources.map((source) => [source.id, source.lastViewedAt ?? ""]),
  );
  const selected = new Set<ReturnCard>();
  for (const reason of RETURN_CARD_REASONS) {
    const candidates = cards.filter(
      (candidate) =>
        candidate.reasons.includes(reason) && !selected.has(candidate),
    );
    if (reason === "Recently viewed") {
      candidates.sort(
        (a, b) =>
          (visits.get(b.id) ?? "").localeCompare(visits.get(a.id) ?? "") ||
          a.id.localeCompare(b.id),
      );
    }
    if (reason === "Upcoming date") {
      candidates.sort(
        (a, b) =>
          (a.targetDate ?? "").localeCompare(b.targetDate ?? "") ||
          a.id.localeCompare(b.id),
      );
    }
    const [card] = candidates;
    if (card) {
      selected.add(card);
    }
  }
  for (const card of cards) {
    if (selected.size === 5) {
      break;
    }
    selected.add(card);
  }
  return [...selected];
}
