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
	createMemoryWorkStatusPort,
	moveKanbanCard,
	openSourceRecord,
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
		expect(openSourceRecord(card ?? { workId: "" })).toEqual({
			workId: "work_pay",
		});
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
});
