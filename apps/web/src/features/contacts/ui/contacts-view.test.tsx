import type {
  Company,
  Contact,
  ContactResolution,
  DuplicateCandidate,
  MergePreview,
} from "@cantiara/api/contacts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";

import ContactsView from "./contacts-view";
import MergePreviewPanel, { mergeContactsRequest } from "./merge-preview-panel";

function noop() {
  // Presentational test: the handlers are never called.
}

const timestamp = "2026-09-20T09:00:00.000Z";

const company: Company = {
  archivedAt: null,
  contactCount: 1,
  createdAt: timestamp,
  id: "company-1",
  name: "Acme",
  revision: 0,
};

const contact: Contact = {
  archivedAt: null,
  company: { archivedAt: null, id: company.id, name: company.name },
  companyHistory: [
    {
      company: { archivedAt: null, id: "company-0", name: "Globex" },
      endedAt: timestamp,
      startedAt: timestamp,
    },
    {
      company: { archivedAt: null, id: company.id, name: company.name },
      endedAt: null,
      startedAt: timestamp,
    },
  ],
  createdAt: timestamp,
  displayName: "Ada Lovelace",
  emails: ["ada@example.com"],
  id: "contact-1",
  personaDocuments: [],
  revision: 1,
};

const withPersona: Contact = {
  ...contact,
  personaDocuments: [
    {
      archivedAt: null,
      documentId: "document-1",
      projectId: "project-1",
      title: "Maker Mia",
    },
  ],
};

function renderView(
  contacts: Contact[],
  companies: Company[],
  candidates: DuplicateCandidate[] = [],
  opened?: { contactId: string; resolution: ContactResolution },
) {
  const queryClient = new QueryClient();
  if (opened) {
    queryClient.setQueryData(
      orpc.resolveContact.queryOptions({
        input: { contactId: opened.contactId },
      }).queryKey,
      opened.resolution,
    );
  }
  queryClient.setQueryData(orpc.contacts.queryOptions().queryKey, contacts);
  queryClient.setQueryData(orpc.companies.queryOptions().queryKey, companies);
  queryClient.setQueryData(
    orpc.contactDuplicateCandidates.queryOptions().queryKey,
    candidates,
  );
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute(),
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>
        <ContactsView contactId={opened?.contactId} />
      </RouterContextProvider>
    </QueryClientProvider>,
  );
}

describe("Contact and Company surface", () => {
  test("uses the English identity-book labels", () => {
    const html = renderView([withPersona], [company]);

    expect(html).toContain("Create Contact");
    expect(html).toContain("Create Company");
    expect(html).toContain("Display name");
    expect(html).toContain("Save Contact");
    expect(html).toContain("Belongs to Company");
    expect(html).toContain("Open Source Record");
    expect(html).toContain("Past Companies");
    expect(html).toContain("Globex");
  });

  test("opens the Persona Document as the only Open Source Record link", () => {
    const html = renderView([withPersona], [company]);

    expect(html.match(/Open Source Record/g)).toHaveLength(1);
    expect(html).toContain("Maker Mia");
  });

  test("shows the empty states", () => {
    const html = renderView([], []);

    expect(html).toContain("No Contacts yet.");
    expect(html).toContain("No Companies yet.");
    expect(html).toContain("No duplicate candidates.");
  });

  test("shows strong and weak Duplicate candidates and offers Merge Contacts only for the strong one", () => {
    const other: Contact = { ...contact, id: "contact-2" };
    const html = renderView(
      [contact, other],
      [company],
      [
        {
          contactIds: [contact.id, other.id],
          reasons: ["Same email"],
          strength: "strong",
        },
        {
          contactIds: [contact.id, other.id],
          reasons: ["Similar name"],
          strength: "weak",
        },
      ],
    );

    expect(html).toContain("Duplicate candidates");
    expect(html).toContain("Strong copy candidate");
    expect(html).toContain("Weak suggestion");
    expect(html.match(/Merge Contacts/g)).toHaveLength(1);
    expect(html).not.toContain("Confirm Merge");
  });

  test("shows the Merge Preview with conflicts and moved links before confirming", () => {
    const retired: Contact = {
      ...contact,
      displayName: "Ada L.",
      emails: ["ada@work.example"],
      id: "contact-2",
    };
    const html = renderToStaticMarkup(
      <MergePreviewPanel
        onCancel={noop}
        onConfirm={noop}
        pending={false}
        preview={{
          addedEmails: ["ada@work.example"],
          adoptedDisplayName: null,
          companyOutcome: "Keep survivor",
          feedbackIds: ["feedback-1", "feedback-2"],
          fieldConflicts: [
            {
              field: "Display name",
              retiredValue: "Ada L.",
              survivorValue: "Ada Lovelace",
            },
          ],
          personaDocuments: withPersona.personaDocuments,
          retired,
          survivor: contact,
        }}
      />,
    );

    expect(html).toContain("Merge Preview");
    expect(html).toContain("Surviving Contact");
    expect(html).toContain("Display name: keeps Ada Lovelace, drops Ada L.");
    expect(html).toContain("ada@work.example");
    expect(html).toContain("Maker Mia");
    expect(html).toContain("Confirm Merge");
    for (const label of ["Kanıt", "Evidence role", "Priority"]) {
      expect(html).not.toContain(label);
    }
  });

  test("offers no CRM fields or Persona assignment", () => {
    const html = renderView([contact], [company]);

    for (const label of [
      "Plan",
      "Subscription",
      "ARR",
      "MRR",
      "Revenue",
      "Contract",
      "Sales stage",
      "Geo segment",
      "Score",
      "Assign Persona",
    ]) {
      expect(html).not.toContain(label);
    }
  });
});

describe("Contact merge confirmation", () => {
  test("shows the retired identity as the visible origin of a redirected link", () => {
    const html = renderView([contact], [company], [], {
      contactId: "contact-retired",
      resolution: {
        contact,
        feedbackIds: [],
        redirectedFrom: "contact-retired",
      },
    });

    expect(html).toContain("Redirected from");
    expect(html).toContain("contact-retired");
  });

  test("sends the revisions shown in the Merge Preview with the confirmation", () => {
    const preview: MergePreview = {
      addedEmails: [],
      adoptedDisplayName: null,
      companyOutcome: "None",
      feedbackIds: [],
      fieldConflicts: [],
      personaDocuments: [],
      retired: { ...contact, id: "contact-2", revision: 4 },
      survivor: { ...contact, revision: 7 },
    };

    expect(
      mergeContactsRequest(
        { retiredId: "contact-2", survivorId: "contact-1" },
        preview,
      ),
    ).toEqual({
      expectedRetiredRevision: 4,
      expectedSurvivorRevision: 7,
      retiredId: "contact-2",
      survivorId: "contact-1",
    });
  });
});
