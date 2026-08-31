/**
 * Kanban seam — Board columns are the four protected workflow
 * statuses; a non-terminal column move writes that status on the
 * source Work; planning membership does not write status; the board
 * does not mint a second Work list; a column move does not write
 * GitHub status or fire silent automation. Work-status test double
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: column move writes status).
 */
import { describe, expect, it } from "vitest";

import {
	applyKanbanPlanningMembership,
	collapseKanbanColumn,
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

function seedPort() {
	return createMemoryWorkStatusPort([
		{
			id: "work_intake",
			key: "PAY-1",
			revision: 1,
			status: "Not Started",
			statusEnteredAt: "2026-08-31T12:00:00.000Z",
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
			statusEnteredAt: "2026-08-30T14:00:00.000Z",
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
			collapse: "Collapse",
			expand: "Expand",
			focusThreshold: "Focus threshold",
			inProgress: "In Progress",
			inProgressCount: "In Progress count",
			kanban: "Kanban",
			notStarted: "Not Started",
			openBlocker: "Open blocker",
			openSourceRecord: "Open source record",
			overLimit: "Over limit",
			softWip: "Soft WIP",
			timeInStatus: "Time in status",
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

	it("shows In Progress count and time in current status on active cards", () => {
		const board = presentKanbanBoard(seedPort().list(), {
			now: new Date("2026-08-31T14:00:00.000Z"),
		});
		expect(board.inProgressCount).toBe(1);
		expect(board.copy.inProgressCount).toBe("In Progress count");
		expect(board.copy.timeInStatus).toBe("Time in status");
		const inProgress = board.columns
			.find((column) => column.status === "In Progress")
			?.cards.find((card) => card.workId === "work_pay");
		expect(inProgress?.timeInCurrentStatus).toBe("1d");
		const intake = board.columns
			.find((column) => column.status === "Not Started")
			?.cards.find((card) => card.workId === "work_intake");
		expect(intake?.timeInCurrentStatus).toBe("2h");
	});

	it("marks Soft WIP and Focus threshold overflow without blocking a move or minting a verdict", () => {
		const port = seedPort();
		const before = presentKanbanBoard(port.list(), {
			focusThreshold: 1,
			softWipLimits: { "In Progress": 1 },
		});
		expect(before.focus).toEqual({
			count: 1,
			exceeded: false,
			mark: null,
			threshold: 1,
		});
		expect(
			before.columns.find((column) => column.status === "In Progress")?.softWip
		).toEqual({
			count: 1,
			exceeded: false,
			limit: 1,
			mark: null,
		});
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
		const after = presentKanbanBoard(port.list(), {
			focusThreshold: 1,
			softWipLimits: { "In Progress": 1 },
		});
		expect(after.inProgressCount).toBe(2);
		expect(after.focus).toEqual({
			count: 2,
			exceeded: true,
			mark: "Over limit",
			threshold: 1,
		});
		expect(
			after.columns.find((column) => column.status === "In Progress")?.softWip
		).toEqual({
			count: 2,
			exceeded: true,
			limit: 1,
			mark: "Over limit",
		});
		expect(port.notifications).toEqual([]);
		expect(port.healthVerdicts).toEqual([]);
		expect(port.automaticWorkWrites).toEqual([]);
		expect(port.get("work_intake")?.title).toBe("Intake checkout");
		expect(port.get("work_pay")?.title).toBe("Charge card");
	});

	it("collapses a column as layout compression without filtering Work or writing status", () => {
		const port = seedPort();
		const open = presentKanbanBoard(port.list());
		const membershipIds = open.columns.flatMap((column) =>
			column.cards.map((card) => card.workId)
		);
		const collapsed = collapseKanbanColumn(open, "In Progress");
		const inProgress = collapsed.columns.find(
			(column) => column.status === "In Progress"
		);
		expect(inProgress?.collapsed).toBe(true);
		expect(inProgress?.count).toBe(1);
		expect(inProgress?.openBlockerCount).toBe(1);
		expect(inProgress?.cards.map((card) => card.workId)).toEqual(["work_pay"]);
		expect(
			collapsed.columns.flatMap((column) =>
				column.cards.map((card) => card.workId)
			)
		).toEqual(membershipIds);
		expect(port.get("work_pay")?.status).toBe("In Progress");
		expect(port.memberships("work_pay")).toEqual([]);
	});
});
