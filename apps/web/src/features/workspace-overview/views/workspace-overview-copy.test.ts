import { expect, test } from "vitest";

import { WORKSPACE_OVERVIEW_UI_COPY } from "./workspace-overview-copy";

const FORBIDDEN_UI =
	/Mission Control|Portfolio|Home board|widget builder|sağlık|Genel bakış/i;

test("English UI uses the four prepared Workspace Overview modules", () => {
	expect(WORKSPACE_OVERVIEW_UI_COPY).toMatchObject({
		activeProjects: "Active Projects",
		attentionRequired: "Attention Required",
		lastReportedHealth: "Last reported health",
		newList: "New list",
		openSourceRecord: "Open source record",
		recentWork: "Recent Work",
		savedLists: "Saved lists",
		upcoming: "Upcoming",
		workspace: "Workspace",
	});
	expect(JSON.stringify(WORKSPACE_OVERVIEW_UI_COPY)).not.toMatch(FORBIDDEN_UI);
});
