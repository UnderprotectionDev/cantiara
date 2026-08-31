/**
 * Kanban seam — Board columns are the four protected workflow
 * statuses; a non-terminal column move writes that status on the
 * source Work; Closed drop requires the closure step; Completed and
 * Abandoned stay distinct; reopen needs confirm and a non-terminal
 * target. Planning membership does not write status; cards follow the
 * saved view explicit sort with no independent Kanban rank; Backlog and
 * Prioritization session ranks stay untouched; List is the same scan
 * including unplanned Work and does not write status or closure; a
 * future Reappear date sits in the background without writing status;
 * archived Work is absent. Work-status test double for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: planning-surface–status separation; list is the
 * same Work).
 */
import { describe, expect, it } from "vitest";

import {
	applyKanbanPlanningMembership,
	closeKanbanCard,
	collapseKanbanColumn,
	createMemoryWorkStatusPort,
	moveKanbanCard,
	presentKanbanBoard,
	presentKanbanList,
	reopenKanbanCard,
	scanKanbanList,
} from "./kanban";
import {
	DEFAULT_CARD_VISIBLE_FIELDS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	PLANNING_MEMBERSHIP_SURFACES,
	presentKanbanClosureStep,
} from "./kanban-model";

const SPRINT_RELEASE_ARCHIVE_PATTERN =
	/sprint|velocity|release commitment|Archive/i;
const CLOSURE_CHECK_PATTERN =
	/Closure check|Keep lasting context|Close anyway|Bitiriş/i;
const FIFTH_COLUMN_PATTERN = /Deferred|Review|Archive|Sprint/i;
const LIST_NOT_OTHER_SURFACE_PATTERN =
	/Table View|Smart Collection|manualOrder|backlogRank|cell/;
const KANBAN_RANK_PATTERN = /kanbanRank/;
const ARCHIVE_COLUMN_PATTERN = /Archive/i;

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
		{
			id: "work_unplanned",
			key: "PAY-4",
			revision: 1,
			status: "Not Started",
			title: "Unplanned capture",
			type: "Task",
			unplanned: true,
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
		expect(board.copy).toMatchObject({
			blocked: "Blocked",
			board: "Board",
			closed: "Closed",
			collapse: "Collapse",
			expand: "Expand",
			focusThreshold: "Focus threshold",
			inProgress: "In Progress",
			inProgressCount: "In Progress count",
			kanban: "Kanban",
			list: "List",
			notStarted: "Not Started",
			openBlocker: "Open blocker",
			openSourceRecord: "Open source record",
			overLimit: "Over limit",
			softWip: "Soft WIP",
			timeInStatus: "Time in status",
		});
		expect(JSON.stringify(board.copy)).not.toMatch(CLOSURE_CHECK_PATTERN);
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
		expect(closeKanbanCard(port, { workId: "work_intake" })).toEqual({
			reason: "unknown-closure-result",
			status: "rejected",
		});
		expect(port.get("work_intake")?.status).toBe("Not Started");
	});

	it("applies Closed only after Completed or Abandoned is chosen and keeps those outcomes distinct on the card", () => {
		const port = seedPort();
		const step = presentKanbanClosureStep();
		expect(step.results).toEqual(["Completed", "Abandoned"]);
		expect(step.copy.completed).toBe("Completed");
		expect(step.copy.abandoned).toBe("Abandoned");
		expect(JSON.stringify(step)).not.toMatch(CLOSURE_CHECK_PATTERN);
		expect(
			closeKanbanCard(port, {
				reason: "Shipped checkout",
				result: "Completed",
				workId: "work_intake",
			})
		).toEqual({
			closureResult: "Completed",
			status: "committed",
			workflowStatus: "Closed",
			workId: "work_intake",
		});
		expect(port.get("work_intake")).toMatchObject({
			closureResult: "Completed",
			status: "Closed",
		});
		expect(
			closeKanbanCard(port, {
				result: "Abandoned",
				workId: "work_pay",
			})
		).toEqual({
			closureResult: "Abandoned",
			status: "committed",
			workflowStatus: "Closed",
			workId: "work_pay",
		});
		const closed = presentKanbanBoard(port.list()).columns.find(
			(column) => column.status === "Closed"
		);
		const completed = closed?.cards.find(
			(card) => card.workId === "work_intake"
		);
		const abandoned = closed?.cards.find((card) => card.workId === "work_pay");
		expect(completed?.summary).toContainEqual({
			field: "Status",
			value: "Closed · Completed",
		});
		expect(abandoned?.summary).toContainEqual({
			field: "Status",
			value: "Closed · Abandoned",
		});
		expect(completed?.closureResult).toBe("Completed");
		expect(abandoned?.closureResult).toBe("Abandoned");
		expect(completed?.closureResult).not.toBe(abandoned?.closureResult);
	});

	it("reopens from Closed with confirm and a non-terminal target while keeping the previous outcome in history", () => {
		const port = seedPort();
		closeKanbanCard(port, {
			reason: "Shipped checkout",
			result: "Completed",
			workId: "work_intake",
		});
		expect(
			reopenKanbanCard(port, {
				confirmed: false,
				targetStatus: "In Progress",
				workId: "work_intake",
			})
		).toEqual({
			reason: "reopen-confirm-required",
			status: "rejected",
		});
		expect(port.get("work_intake")).toMatchObject({
			closureResult: "Completed",
			status: "Closed",
		});
		expect(
			reopenKanbanCard(port, {
				confirmed: true,
				targetStatus: "Closed",
				workId: "work_intake",
			})
		).toEqual({
			reason: "unknown-work-status",
			status: "rejected",
		});
		expect(
			reopenKanbanCard(port, {
				confirmed: true,
				targetStatus: "In Progress",
				workId: "work_intake",
			})
		).toEqual({
			status: "committed",
			workflowStatus: "In Progress",
			workId: "work_intake",
		});
		expect(port.get("work_intake")).toMatchObject({
			closureResult: null,
			status: "In Progress",
		});
		expect(port.history("work_intake")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					closureResult: "Completed",
					kind: "closed",
					reason: "Shipped checkout",
					status: "Closed",
				}),
				expect.objectContaining({
					closureResult: null,
					kind: "reopened",
					status: "In Progress",
				}),
			])
		);
		const card = presentKanbanBoard(port.list())
			.columns.find((column) => column.status === "In Progress")
			?.cards.find((item) => item.workId === "work_intake");
		expect(card?.summary).toContainEqual({
			field: "Status",
			value: "In Progress",
		});
		expect(card?.closureResult).toBeNull();
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

	it("presents List as the same Work scan including unplanned Work", () => {
		const records = seedPort().list();
		const board = presentKanbanBoard(records);
		const list = presentKanbanList(records);
		expect(list.layout).toBe("list");
		expect(list.copy.list).toBe("List");
		expect(list.rows.map((row) => row.workId)).toEqual([
			"work_intake",
			"work_unplanned",
			"work_pay",
		]);
		expect(list.rows.map((row) => row.id)).toEqual([
			"work_intake",
			"work_unplanned",
			"work_pay",
		]);
		expect(
			board.columns.flatMap((column) => column.cards.map((card) => card.workId))
		).toEqual(list.rows.map((row) => row.workId));
		expect(list.rows.find((row) => row.workId === "work_unplanned")?.key).toBe(
			"PAY-4"
		);
		expect(list.rows.map((row) => row.workId)).not.toContain("work_old");
		expect(list.visibleFields).toEqual([...DEFAULT_CARD_VISIBLE_FIELDS]);
		expect(list.copy.openSourceRecord).toBe("Open source record");
	});

	it("scans List fields and opens the source Work without writing status or closure", () => {
		const port = seedPort();
		const scanned = scanKanbanList(port, { field: "Key" });
		expect(scanned.rows.map((row) => row.key)).toEqual([
			"PAY-1",
			"PAY-2",
			"PAY-4",
		]);
		expect(scanned.rows.map((row) => row.id)).toEqual(
			scanned.rows.map((row) => row.workId)
		);
		expect(scanned.copy.openSourceRecord).toBe("Open source record");
		expect(port.get("work_intake")?.status).toBe("Not Started");
		expect(port.get("work_pay")?.status).toBe("In Progress");
		expect(port.get("work_pay")?.closureResult).toBeUndefined();
		expect(port.get("work_unplanned")?.status).toBe("Not Started");
	});

	it("does not present List as Table View, Smart Collection, or Backlog manual order", () => {
		const list = presentKanbanList(seedPort().list());
		expect(list.layout).toBe("list");
		expect(list.layout).not.toBe("table");
		expect(JSON.stringify(list)).not.toMatch(LIST_NOT_OTHER_SURFACE_PATTERN);
		expect(list.rows.some((row) => "backlogRank" in row)).toBe(false);
		expect(list.rows.some((row) => "smartCollectionId" in row)).toBe(false);
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
		expect(before.backlog).toEqual([
			"work_intake",
			"work_pay",
			"work_old",
			"work_unplanned",
		]);
		expect(before.session).toEqual([
			"work_unplanned",
			"work_old",
			"work_pay",
			"work_intake",
		]);
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
