import { expect, test } from "vitest";

import {
	DEFAULT_CARD_VISIBLE_FIELDS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	openSourceRecord,
	presentKanbanBoard,
} from "./present-board";

const SPRINT_RELEASE_ARCHIVE_PATTERN =
	/sprint|velocity|release commitment|Archive/i;

test("English Board copy uses Kanban and the four protected statuses", () => {
	expect(KANBAN_COPY).toEqual({
		blocked: "Blocked",
		board: "Board",
		closed: "Closed",
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
	expect(board.columns[0]?.cards).toEqual([
		expect.objectContaining({
			id: "work_intake",
			workId: "work_intake",
		}),
	]);
	expect(
		openSourceRecord(board.columns[0]?.cards[0] ?? { workId: "" })
	).toEqual({
		workId: "work_intake",
	});
});
