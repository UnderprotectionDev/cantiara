import { createFileRoute } from "@tanstack/react-router";

import ContactAndCompanyArea from "@/features/contact-and-company/views/contact-and-company-area";

function contactsSearch(search: Record<string, unknown>): {
	company?: string;
	contact?: string;
} {
	return {
		company: typeof search.company === "string" ? search.company : undefined,
		contact: typeof search.contact === "string" ? search.contact : undefined,
	};
}

export const Route = createFileRoute("/_founder/_auth/contacts")({
	component: ContactsRoute,
	validateSearch: contactsSearch,
});

function ContactsRoute() {
	const search = Route.useSearch();
	return (
		<ContactAndCompanyArea
			companyId={search.company}
			contactId={search.contact}
		/>
	);
}
