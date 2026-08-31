/**
 * Kanban seam — Board columns are the four protected workflow
 * statuses; a non-terminal column move writes that status on the
 * source Work; planning membership does not write status; the board
 * does not mint a second Work list; a column move does not write
 * GitHub status or fire silent automation; cards follow the saved view
 * explicit sort with no independent Kanban rank; Backlog and Prioritization
 * session ranks stay untouched; a future Reappear date sits in the
 * background without writing status; archived Work is absent. Work-status
 * test double for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: planning-surface–status separation).
 */
import { describe, expect, it } from "vitest";

import {
	applyKanbanPlanningMembership,
	createMemoryWorkStatusPort,
	moveKanbanCard,
	presentKanbanBoard,
} from "./kanban";
import {
	DEFAULT_CARD_VISIBLE_FIELDS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	PLANNING_MEMBERSHIP_SURFACES,
} from "./kanban-model";

const SPRINT_RELEASE_ARCHIVE_PATTERN =
	/sprint|velocity|release commitment|Archive|Completed|Abandoned/i;
const FIFTH_COLUMN_PATTERN = /Deferred|Review|Archive|Sprint/i;
const KANBAN_RANK_PATTERN = /kanbanRank/;
const ARCHIVE_COLUMN_PATTERN = /Archive/i;

function seedPort() {
	return createMemoryWorkStatusPort([
		{
			id: "work_intake",
			key: "PAY-1",
			revision: 1,
			status: "Not Started",
			title: "Intake checkout",
			type: "Task",
		},
		{
			blocker: "Active",
			checklistCompleted: 1,
			checklistTotal: 3,
			id: "work_pay",
			key: "PAY-2",
			priority: "Must",
			revision: 2,
			status: "In Progress",
			title: "Charge card",
			type: "Feature",
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
}

describe("Kanban", () => {
	it("presents exactly the four protected workflow-status columns", () => {
		const board = presentKanbanBoard(seedPort().list());
		expect(board.columns.map((column) => column.status)).toEqual([
			"Not Started",
			"In Progress",
			"Blocked",
			"Closed",
		]);
		expect(KANBAN_COLUMNS).toEqual([
			KANBAN_COPY.notStarted,
			KANBAN_COPY.inProgress,
			KANBAN_COPY.blocked,
			KANBAN_COPY.closed,
		]);
		expect(
			JSON.stringify(board.columns.map((column) => column.status))
		).not.toMatch(FIFTH_COLUMN_PATTERN);
		expect(JSON.stringify(board.copy)).not.toMatch(
			SPRINT_RELEASE_ARCHIVE_PATTERN
		);
		expect(board.copy).toEqual({
			blocked: "Blocked",
			board: "Board",
			closed: "Closed",
			inProgress: "In Progress",
			kanban: "Kanban",
			notStarted: "Not Started",
			openSourceRecord: "Open source record",
		});
	});

	it("moves a card between non-terminal columns by writing workflow status on the source Work", () => {
		const port = seedPort();
		const before = presentKanbanBoard(port.list());
		const sourceIds = before.columns.flatMap((column) =>
			column.cards.map((card) => card.workId)
		);
		const moved = moveKanbanCard(port, {
			targetStatus: "In Progress",
			workId: "work_intake",
		});
		expect(moved).toEqual({
			status: "committed",
			workflowStatus: "In Progress",
			workId: "work_intake",
		});
		expect(port.get("work_intake")?.status).toBe("In Progress");
		const after = presentKanbanBoard(port.list());
		expect(
			after.columns
				.find((column) => column.status === "In Progress")
				?.cards.map((card) => card.workId)
		).toEqual(["work_intake", "work_pay"]);
		expect(
			after.columns
				.flatMap((column) => column.cards.map((card) => card.workId))
				.sort()
		).toEqual(sourceIds.sort());
		expect(
			after.columns
				.flatMap((column) => column.cards.map((card) => card.id))
				.sort()
		).toEqual(sourceIds.sort());
	});

	it("keeps Closed as a column without applying a Closed drop as a silent close", () => {
		const port = seedPort();
		expect(
			moveKanbanCard(port, { targetStatus: "Closed", workId: "work_intake" })
		).toEqual({
			reason: "close-step-required",
			status: "rejected",
		});
		expect(port.get("work_intake")?.status).toBe("Not Started");
	});

	it("does not write workflow status from Backlog, Daily Focus, Calendar, Roadmap, Favorites, or Focus Period membership", () => {
		const port = seedPort();
		for (const surface of PLANNING_MEMBERSHIP_SURFACES) {
			expect(
				applyKanbanPlanningMembership(port, {
					desiredStatus: "In Progress",
					surface,
					workId: "work_intake",
				})
			).toMatchObject({
				membership: { surface },
				status: "committed",
				workId: "work_intake",
			});
			expect(port.get("work_intake")?.status).toBe("Not Started");
			expect(port.memberships("work_intake")).toContain(surface);
		}
	});

	it("summarizes the saved view visible fields and opens the source Work", () => {
		const board = presentKanbanBoard(seedPort().list());
		expect(board.visibleFields).toEqual([...DEFAULT_CARD_VISIBLE_FIELDS]);
		const card = board.columns
			.find((column) => column.status === "In Progress")
			?.cards.find((item) => item.workId === "work_pay");
		expect(card?.summary).toEqual([
			{ field: "Key", value: "PAY-2" },
			{ field: "Type", value: "Feature" },
			{ field: "Status", value: "In Progress" },
			{ field: "Priority", value: "Must" },
			{ field: "Blocker", value: "Active" },
			{ field: "Checklist", value: "1/3" },
		]);
		expect(card?.id).toBe("work_pay");
		expect(card?.workId).toBe("work_pay");
		expect(
			board.columns.flatMap((column) => column.cards.map((item) => item.workId))
		).not.toContain("work_old");
	});

	it("does not write GitHub status or fire silent automation when a column moves", () => {
		const port = seedPort();
		moveKanbanCard(port, {
			targetStatus: "Blocked",
			workId: "work_intake",
		});
		expect(port.get("work_intake")?.status).toBe("Blocked");
		expect(port.githubWrites).toEqual([]);
		expect(port.automations).toEqual([]);
	});

	it("orders cards by the saved view explicit sort and does not mint a Kanban rank on drop", () => {
		const port = createMemoryWorkStatusPort([
			{
				id: "work_zulu",
				key: "PAY-9",
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
		]);
		const board = presentKanbanBoard(port.list(), {
			sort: { direction: "asc", field: "Title" },
		});
		expect(board.sort).toEqual({ direction: "asc", field: "Title" });
		expect(
			board.columns
				.find((column) => column.status === "Not Started")
				?.cards.map((card) => card.workId)
		).toEqual(["work_alpha", "work_zulu"]);
		expect(JSON.stringify(board)).not.toMatch(KANBAN_RANK_PATTERN);
		moveKanbanCard(port, {
			targetStatus: "In Progress",
			workId: "work_zulu",
		});
		moveKanbanCard(port, {
			targetStatus: "In Progress",
			workId: "work_alpha",
		});
		const after = presentKanbanBoard(port.list(), {
			sort: { direction: "asc", field: "Title" },
		});
		expect(
			after.columns
				.find((column) => column.status === "In Progress")
				?.cards.map((card) => card.workId)
		).toEqual(["work_alpha", "work_zulu"]);
		expect(port.kanbanRanks()).toEqual({});
	});

	it("does not write Backlog order or Prioritization session rank when a column moves", () => {
		const port = seedPort();
		const before = {
			backlog: port.backlogOrder(),
			session: port.sessionOrder(),
		};
		expect(before.backlog).toEqual(["work_intake", "work_pay", "work_old"]);
		expect(before.session).toEqual(["work_old", "work_pay", "work_intake"]);
		moveKanbanCard(port, {
			targetStatus: "Blocked",
			workId: "work_intake",
		});
		expect(port.get("work_intake")?.status).toBe("Blocked");
		expect(port.backlogOrder()).toEqual(before.backlog);
		expect(port.sessionOrder()).toEqual(before.session);
		expect(port.kanbanRanks()).toEqual({});
	});

	it("keeps a future Reappear date in the background of the default set without writing status", () => {
		const port = createMemoryWorkStatusPort([
			{
				id: "work_later",
				key: "PAY-4",
				reappearDate: "2026-12-01",
				revision: 1,
				status: "Not Started",
				title: "Snoozed intake",
				type: "Task",
			},
			{
				id: "work_today",
				key: "PAY-5",
				reappearDate: "2026-08-31",
				revision: 1,
				status: "Not Started",
				title: "Due intake",
				type: "Task",
			},
		]);
		const board = presentKanbanBoard(port.list(), { asOf: "2026-08-31" });
		const later = board.columns
			.find((column) => column.status === "Not Started")
			?.cards.find((card) => card.workId === "work_later");
		const due = board.columns
			.find((column) => column.status === "Not Started")
			?.cards.find((card) => card.workId === "work_today");
		expect(later?.background).toBe(true);
		expect(later?.status).toBe("Not Started");
		expect(due?.background).toBe(false);
		expect(port.get("work_later")?.status).toBe("Not Started");
		expect(board.columns.map((column) => column.status)).not.toContain(
			"Deferred"
		);
	});

	it("omits archived Work from the default board and does not open an Archive column", () => {
		const board = presentKanbanBoard(seedPort().list());
		expect(board.columns.map((column) => column.status)).toEqual([
			"Not Started",
			"In Progress",
			"Blocked",
			"Closed",
		]);
		expect(
			board.columns.flatMap((column) => column.cards.map((card) => card.workId))
		).not.toContain("work_old");
		expect(
			JSON.stringify(board.columns.map((column) => column.status))
		).not.toMatch(ARCHIVE_COLUMN_PATTERN);
	});
});
