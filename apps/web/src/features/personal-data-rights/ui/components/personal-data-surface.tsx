import { EXPORT_PERSONAL_DATA_LABEL } from "@cantiara/api/personal-data-rights";
import { useQuery } from "@tanstack/react-query";
import { contactLabel } from "@/features/contacts/lib/contact-label";
import { orpc } from "@/utils/orpc";
import {
  usePersonalDataErase,
  usePersonalDataErasePreview,
  usePersonalDataPreview,
  usePersonalDataProduce,
} from "../../hooks/use-personal-data-requests";
import { PersonalDataView } from "../views/personal-data-view";

/** Loads the Contacts a person package can be requested for. */
export default function PersonalDataSurface() {
  const contacts = useQuery(orpc.contacts.queryOptions());
  const preview = usePersonalDataPreview();
  const produce = usePersonalDataProduce();
  const previewErase = usePersonalDataErasePreview();
  const erase = usePersonalDataErase();

  if (contacts.isPending) {
    return <p role="status">Loading {EXPORT_PERSONAL_DATA_LABEL}…</p>;
  }
  if (contacts.isError || !contacts.data) {
    return <p role="alert">{EXPORT_PERSONAL_DATA_LABEL} is unavailable.</p>;
  }
  return (
    <PersonalDataView
      contacts={contacts.data.map((contact) => ({
        id: contact.id,
        label: contactLabel(contact),
      }))}
      onConfirmIdentity={erase.confirmIdentity}
      onErase={erase.erase}
      onPreview={preview}
      onPreviewErase={previewErase}
      onProduce={produce}
    />
  );
}
