import { expect, test } from "vitest";

import {
	DEFAULT_CARD_VISIBLE_FIELDS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	presentKanbanBoard,
} from "./present-board";

const SPRINT_RELEASE_ARCHIVE_PATTERN =
	/sprint|velocity|release commitment|Archive/i;
const ARCHIVE_COLUMN_PATTERN = /Archive/i;
const KANBAN_RANK_PATTERN = /kanbanRank/;

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
	expect(board.sort).toEqual({ direction: "asc", field: "Key" });
	expect(board.columns[0]?.cards[0]?.id).toBe("work_intake");
	expect(board.columns[0]?.cards[0]?.workId).toBe("work_intake");
	expect(
		board.columns.flatMap((column) => column.cards.map((card) => card.workId))
	).not.toContain("work_old");
	expect(
		JSON.stringify(board.columns.map((column) => column.status))
	).not.toMatch(ARCHIVE_COLUMN_PATTERN);
});

test("Board uses saved view Title sort and backgrounds a future Reappear date", () => {
	const board = presentKanbanBoard(
		[
			{
				id: "work_zulu",
				key: "PAY-9",
				reappearDate: "2026-12-01",
				revision: 1,
				status: "Not Started",
				title: "Zulu checkout",
				type: "Task",
			},
			{
				id: "work_alpha",
				key: "PAY-8",
				revision: 1,
				status: "Not Started",
				title: "Alpha intake",
				type: "Task",
			},
		],
		{ asOf: "2026-08-31", sort: { direction: "asc", field: "Title" } }
	);
	expect(board.columns[0].cards.map((card) => card.workId)).toEqual([
		"work_alpha",
		"work_zulu",
	]);
	expect(board.columns[0].cards[1]?.background).toBe(true);
	expect(board.columns[0].cards[0]?.background).toBe(false);
	expect(JSON.stringify(board)).not.toMatch(KANBAN_RANK_PATTERN);
});
