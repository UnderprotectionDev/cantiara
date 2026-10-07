import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { ReturnCard, ReturnSource } from "@cantiara/api/return-to-work";
import { Link } from "@tanstack/react-router";
import { formatAccountDateTime } from "../../account-preferences/lib/account-preferences-format";

export default function ReturnCards({
  cards,
  preferences = DEFAULT_ACCOUNT_PREFERENCES,
}: {
  cards: ReturnCard[];
  preferences?: AccountPreferences;
}) {
  return (
    <ul className="grid list-none gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <li
          className="space-y-3 rounded-lg border p-4"
          key={`${card.recordType}:${card.id}`}
        >
          <h3 className="break-words font-medium">{card.title}</h3>
          <p className="text-muted-foreground text-sm">
            {card.reasons.join(" · ")}
          </p>
          {Boolean(card.nextConcreteStep) && (
            <div className="space-y-1">
              <p className="font-medium text-sm">Next concrete step</p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {card.nextConcreteStep}
              </p>
              {card.nextConcreteStepUpdatedAt !== null && (
                <time
                  className="text-muted-foreground text-xs"
                  dateTime={card.nextConcreteStepUpdatedAt}
                >
                  {formatAccountDateTime(
                    card.nextConcreteStepUpdatedAt,
                    preferences,
                  )}
                </time>
              )}
            </div>
          )}
          <ReturnSourceLink source={card} />
        </li>
      ))}
    </ul>
  );
}

export function ReturnSourceLink({
  source,
}: {
  source: Pick<ReturnSource, "projectId" | "sourcePath" | "title">;
}) {
  return (
    <Link
      className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
      hash={source.sourcePath.split("#")[1] ?? ""}
      params={{ projectId: source.projectId }}
      to="/projects/$projectId"
    >
      Open source record<span className="sr-only">: {source.title}</span>
    </Link>
  );
}
