import { expect, test } from "vitest";

import {
	DEFAULT_CARD_VISIBLE_FIELDS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	presentKanbanBoard,
	presentKanbanClosureStep,
} from "./present-board";

const SPRINT_RELEASE_ARCHIVE_PATTERN =
	/sprint|velocity|release commitment|Archive/i;
const CLOSURE_CHECK_PATTERN =
	/Closure check|Keep lasting context|Close anyway|Bitiriş/i;

test("English Board copy uses Kanban and the four protected statuses", () => {
	expect(KANBAN_COPY).toMatchObject({
		abandoned: "Abandoned",
		blocked: "Blocked",
		board: "Board",
		closed: "Closed",
		completed: "Completed",
		inProgress: "In Progress",
		kanban: "Kanban",
		notStarted: "Not Started",
		openSourceRecord: "Open source record",
	});
	expect(KANBAN_COLUMNS).toEqual([
		"Not Started",
		"In Progress",
		"Blocked",
		"Closed",
	]);
	expect(JSON.stringify(KANBAN_COPY)).not.toMatch(
		SPRINT_RELEASE_ARCHIVE_PATTERN
	);
	expect(JSON.stringify(presentKanbanClosureStep())).not.toMatch(
		CLOSURE_CHECK_PATTERN
	);
});

test("Board columns are the source Work and Open source record keeps the same id", () => {
	const board = presentKanbanBoard([
		{
			id: "work_intake",
			key: "PAY-1",
			revision: 1,
			status: "Not Started",
			title: "Intake checkout",
			type: "Task",
		},
		{
			archived: true,
			id: "work_old",
			key: "PAY-3",
			revision: 1,
			status: "Not Started",
			title: "Retired intake",
			type: "Task",
		},
	]);
	expect(board.visibleFields).toEqual([...DEFAULT_CARD_VISIBLE_FIELDS]);
	expect(board.columns[0]?.cards[0]?.id).toBe("work_intake");
	expect(board.columns[0]?.cards[0]?.workId).toBe("work_intake");
});

test("Closed cards distinguish Completed from Abandoned in the same terminal status", () => {
	const board = presentKanbanBoard([
		{
			closureResult: "Completed",
			id: "work_done",
			key: "PAY-4",
			revision: 3,
			status: "Closed",
			title: "Shipped checkout",
			type: "Task",
		},
		{
			closureResult: "Abandoned",
			id: "work_drop",
			key: "PAY-5",
			revision: 2,
			status: "Closed",
			title: "Dropped intake",
			type: "Task",
		},
	]);
	const closed = board.columns.find((column) => column.status === "Closed");
	expect(closed?.cards[0]?.closureResult).toBe("Completed");
	expect(closed?.cards[1]?.closureResult).toBe("Abandoned");
	expect(closed?.cards[0]?.summary).toContainEqual({
		field: "Status",
		value: "Closed · Completed",
	});
	expect(closed?.cards[1]?.summary).toContainEqual({
		field: "Status",
		value: "Closed · Abandoned",
	});
});
