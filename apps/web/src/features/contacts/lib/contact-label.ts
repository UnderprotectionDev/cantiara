import type { Contact } from "@cantiara/api/contacts";

export const NO_COMPANY = "";

export function contactLabel(contact: Pick<Contact, "displayName" | "emails">) {
  return contact.displayName ?? contact.emails[0] ?? "Unnamed Contact";
}
