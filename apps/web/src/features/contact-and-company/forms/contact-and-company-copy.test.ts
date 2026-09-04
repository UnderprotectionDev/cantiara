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
	expect(JSON.stringify(CONTACT_AND_COMPANY_COPY)).not.toMatch(CRM_COPY);
	expect(JSON.stringify(CONTACT_AND_COMPANY_COPY)).not.toMatch(ERASE_COPY);
});
