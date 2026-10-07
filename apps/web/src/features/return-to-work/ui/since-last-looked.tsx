import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { SinceLastLooked as ReturnChanges } from "@cantiara/api/return-to-work";
import { formatAccountDateTime } from "../../account-preferences/lib/account-preferences-format";
import { ReturnSourceLink } from "./return-cards";

export default function SinceLastLooked({
  changes,
  preferences = DEFAULT_ACCOUNT_PREFERENCES,
}: {
  changes: ReturnChanges;
  preferences?: AccountPreferences;
}) {
  return (
    <section aria-label="Since you last looked" className="space-y-4">
      <h3 className="font-medium">Since you last looked</h3>
      {changes.lastViewedAt === null && (
        <p className="text-muted-foreground text-sm">
          Changes will appear after your next visit.
        </p>
      )}
      {changes.lastViewedAt !== null && changes.groups.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No changes since your last visit.
        </p>
      )}
      {changes.lastViewedAt !== null &&
        changes.groups.map((group) => (
          <section
            aria-label={group.name}
            className="space-y-2"
            key={group.name}
          >
            <h4 className="font-medium text-sm">{group.name}</h4>
            <ul className="list-none space-y-3">
              {group.events.map((event) => (
                <li className="space-y-1 rounded-lg border p-3" key={event.id}>
                  <p className="break-words text-sm">{event.source.title}</p>
                  <p className="text-muted-foreground text-xs">{event.kind}</p>
                  <time
                    className="block text-muted-foreground text-xs"
                    dateTime={event.occurredAt}
                  >
                    {formatAccountDateTime(event.occurredAt, preferences)}
                  </time>
                  <ReturnSourceLink source={event.source} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </section>
  );
}
