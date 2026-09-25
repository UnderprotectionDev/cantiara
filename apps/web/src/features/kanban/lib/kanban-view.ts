import type { ProjectWorkSort } from "@cantiara/api/project-shell";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";

function compareNullableDates(
  left: string | null,
  right: string | null,
  direction: ProjectWorkSort["direction"],
) {
  if (left === null || right === null) {
    if (left === right) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    return -1;
  }
  const comparison = left.localeCompare(right);
  return direction === "ascending" ? comparison : -comparison;
}

export function sortKanbanWorks(
  works: readonly WorkProfile[],
  sort: ProjectWorkSort,
) {
  return [...works].sort((left, right) => {
    let comparison = 0;
    switch (sort.field) {
      case "number":
        comparison = left.number - right.number;
        break;
      case "title":
        comparison = left.title.localeCompare(right.title);
        break;
      case "createdAt":
        comparison = left.createdAt.localeCompare(right.createdAt);
        break;
      case "updatedAt":
        comparison = left.updatedAt.localeCompare(right.updatedAt);
        break;
      case "reappearDate":
        comparison = compareNullableDates(
          left.reappearDate ?? null,
          right.reappearDate ?? null,
          sort.direction,
        );
        break;
      default:
        return assertNever(sort.field);
    }

    if (sort.field !== "reappearDate" && sort.direction === "descending") {
      comparison = -comparison;
    }
    return (
      comparison ||
      left.number - right.number ||
      left.id.localeCompare(right.id)
    );
  });
}

export function filterReappearingWorks(
  works: readonly WorkProfile[],
  today: string,
) {
  return works.filter((work) => {
    const reappearDate = work.reappearDate ?? null;
    return reappearDate === null || reappearDate <= today;
  });
}

export function currentDateInTimeZone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function formatTimeInStatus(statusChangedAt: string, now = Date.now()) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(statusChangedAt).getTime()) / 60_000),
  );
  const days = Math.floor(elapsedMinutes / 1440);
  const hours = Math.floor((elapsedMinutes % 1440) / 60);
  const minutes = elapsedMinutes % 60;

  if (days > 0) {
    return `${days} ${days === 1 ? "day" : "days"}${hours ? `, ${hours} ${hours === 1 ? "hour" : "hours"}` : ""}`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}${minutes ? `, ${minutes} ${minutes === 1 ? "minute" : "minutes"}` : ""}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Work sort field: ${value}`);
}
