import { expect, test } from "vitest";

import { CONTACT_AND_COMPANY_COPY } from "./contact-and-company-copy";

const CRM_COPY =
	/ARR|MRR|subscription|sales stage|geo segment|commercial value|contract|revenue|plan tier/i;
const ERASE_COPY =
	/Erase personal data|Export personal data|Confirm GitHub Identity/i;

test("English Contact and Company labels stay Contact, Company, Belongs to Company, and Open Source Record", () => {
	expect(CONTACT_AND_COMPANY_COPY.contact).toBe("Contact");
	expect(CONTACT_AND_COMPANY_COPY.company).toBe("Company");
	expect(CONTACT_AND_COMPANY_COPY.belongsToCompany).toBe("Belongs to Company");
	expect(CONTACT_AND_COMPANY_COPY.openSourceRecord).toBe("Open Source Record");
	expect(CONTACT_AND_COMPANY_COPY.createContact).toBe("Create Contact");
	expect(CONTACT_AND_COMPANY_COPY.createCompany).toBe("Create Company");
	expect(CONTACT_AND_COMPANY_COPY.duplicateCandidates).toBe(
		"Duplicate candidates"
	);
	expect(CONTACT_AND_COMPANY_COPY.mergeContacts).toBe("Merge Contacts");
	expect(CONTACT_AND_COMPANY_COPY.mergePreview).toBe("Merge Preview");
	expect(CONTACT_AND_COMPANY_COPY.emailAliases).toBe("Email aliases");
	expect(CONTACT_AND_COMPANY_COPY.feedbackHistory).toBe("Feedback history");
	expect(CONTACT_AND_COMPANY_COPY.fieldConflicts).toBe("Field conflicts");
	expect(CONTACT_AND_COMPANY_COPY.relationsToRewrite).toBe("Relations");
	expect(CONTACT_AND_COMPANY_COPY.strongCopyCandidate).toBe(
		"Strong copy candidate"
	);
	expect(CONTACT_AND_COMPANY_COPY.weakSuggestion).toBe("Weak suggestion");
	expect(JSON.stringify(CONTACT_AND_COMPANY_COPY)).not.toMatch(CRM_COPY);
	expect(JSON.stringify(CONTACT_AND_COMPANY_COPY)).not.toMatch(ERASE_COPY);
});
