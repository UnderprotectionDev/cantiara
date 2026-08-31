import { expect, test } from "vitest";

import {
	DEFAULT_CARD_VISIBLE_FIELDS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	presentKanbanBoard,
	presentKanbanList,
	sortKanbanList,
} from "./present-board";

const SPRINT_RELEASE_ARCHIVE_PATTERN =
	/sprint|velocity|release commitment|Archive/i;
const LIST_NOT_OTHER_SURFACE_PATTERN =
	/Table View|Smart Collection|manualOrder|backlogRank/;

test("English Board copy uses Kanban and the four protected statuses", () => {
	expect(KANBAN_COPY).toEqual({
		blocked: "Blocked",
		board: "Board",
		closed: "Closed",
		inProgress: "In Progress",
		kanban: "Kanban",
		list: "List",
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
	expect(board.columns[0]?.cards[0]?.id).toBe("work_intake");
	expect(board.columns[0]?.cards[0]?.workId).toBe("work_intake");
});

test("List is the same Work scan including unplanned Work and is not Table View", () => {
	const records = [
		{
			id: "work_intake",
			key: "PAY-1",
			revision: 1,
			status: "Not Started" as const,
			title: "Intake checkout",
			type: "Task",
		},
		{
			id: "work_pay",
			key: "PAY-2",
			revision: 2,
			status: "In Progress" as const,
			title: "Charge card",
			type: "Feature",
		},
		{
			id: "work_unplanned",
			key: "PAY-4",
			revision: 1,
			status: "Not Started" as const,
			title: "Unplanned capture",
			type: "Task",
			unplanned: true,
		},
	];
	const board = presentKanbanBoard(records);
	const list = presentKanbanList(records);
	expect(list.layout).toBe("list");
	expect(list.copy.list).toBe("List");
	expect(list.rows.map((row) => row.workId)).toEqual(
		board.columns.flatMap((column) => column.cards.map((card) => card.workId))
	);
	expect(list.rows.map((row) => row.id)).toEqual(
		list.rows.map((row) => row.workId)
	);
	expect(JSON.stringify(list)).not.toMatch(LIST_NOT_OTHER_SURFACE_PATTERN);
	const sorted = sortKanbanList(list, "Key");
	expect(sorted.rows.map((row) => row.key)).toEqual([
		"PAY-1",
		"PAY-2",
		"PAY-4",
	]);
	expect(sorted.rows.find((row) => row.workId === "work_pay")?.status).toBe(
		"In Progress"
	);
});
