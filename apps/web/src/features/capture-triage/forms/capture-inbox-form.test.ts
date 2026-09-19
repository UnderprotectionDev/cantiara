import {
  getProjectShellConfiguration,
  type ProjectProfile,
} from "@cantiara/api/project-shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  ClientShellProvider,
  createClientShell,
} from "@/features/web-macos-client/views/client-shell";
import { projectsQueryOptions } from "@/utils/orpc";

import CaptureInboxForm, {
  CREATE_BUG_UNAVAILABLE_MESSAGE,
  captureFormValuesEqual,
  captureInput,
} from "./capture-inbox-form";

describe("Capture Inbox form submission", () => {
  test("only treats an unchanged form as safe to reset after Save", () => {
    const submitted = {
      content: "Preview is blank",
      fields: { "Observed Behavior": "Blank screen" },
      projectId: "project-1",
      template: "Bug Capture" as const,
    };

    expect(captureFormValuesEqual(submitted, submitted)).toBe(true);
    expect(
      captureFormValuesEqual(submitted, {
        ...submitted,
        content: "Preview is blank after refresh",
      }),
    ).toBe(false);
  });

  test("submits the selected Project id without asking for an internal value", () => {
    expect(
      captureInput(
        {
          content: "Preview is blank",
          fields: {},
          projectId: "project-1",
          template: "Bug Capture",
        },
        "capture-key-1",
      ),
    ).toMatchObject({
      clientIdempotencyKey: "capture-key-1",
      projectId: "project-1",
      template: "Bug Capture",
    });
  });

  test("renders the Project and mini-template controls in the composer", () => {
    const queryClient = new QueryClient();
    const projects = [
      {
        configuration: getProjectShellConfiguration("Blank Project"),
        createdAt: "2026-09-17T09:00:00.000Z",
        id: "project-1",
        logo: null,
        name: "Payment App",
        problem: null,
        purpose: null,
        revision: 1,
        scope: null,
        shortCode: "PAY",
        shortCodeLocked: false,
        starterConfiguration: "Blank Project",
        status: "Active",
        targetDate: null,
        updatedAt: "2026-09-17T09:00:00.000Z",
      },
    ] satisfies ProjectProfile[];
    queryClient.setQueryData(projectsQueryOptions().queryKey, projects);

    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, {
        client: queryClient,
        // biome-ignore lint/correctness/noChildrenProp: This .ts test uses createElement instead of JSX.
        children: createElement(ClientShellProvider, {
          // biome-ignore lint/correctness/noChildrenProp: This .ts test uses createElement instead of JSX.
          children: createElement(CaptureInboxForm, { accountId: "account-1" }),
          shell: createClientShell(),
        }),
      }),
    );

    expect(html).toContain("Workspace Capture Inbox");
    expect(html).toContain("Payment App (PAY)");
    expect(html).toContain("Bug Capture");
    expect(html).toContain("Feedback Capture");
    expect(html).toContain("Research Fragment");
    expect(html).toContain(">Save</button>");
    expect(html).toContain(">Create Bug</button>");
    expect(html).toContain(CREATE_BUG_UNAVAILABLE_MESSAGE);
  });
});
