// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the picker fields.
import {
  WIREFRAME_LIVE_CARD_RECORD_TYPES,
  type WireframeLiveCardRecordType,
} from "@cantiara/api/wireframe-document";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, useState } from "react";

/**
 * `Place live card`: a read-only Work, Decision or Risk reference by record id.
 * Only the reference lands in the Wireframe; the title is read live and a
 * missing record paints as unavailable.
 */
export function LiveCardPicker({
  onPlace,
}: {
  onPlace: (record: {
    recordId: string;
    recordType: WireframeLiveCardRecordType;
  }) => void;
}) {
  const [recordType, setRecordType] =
    useState<WireframeLiveCardRecordType>("Work");
  const [recordId, setRecordId] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const id = recordId.trim();
    if (!id) {
      return;
    }
    onPlace({ recordId: id, recordType });
    setRecordId("");
  }
  return (
    <form
      aria-label="Place live card"
      className="flex flex-wrap items-center gap-2"
      onSubmit={submit}
    >
      <label className="text-xs" htmlFor="live-card-type">
        Record type
      </label>
      <NativeSelect
        id="live-card-type"
        onChange={(event) =>
          setRecordType(event.target.value as WireframeLiveCardRecordType)
        }
        value={recordType}
      >
        {WIREFRAME_LIVE_CARD_RECORD_TYPES.map((type) => (
          <NativeSelectOption key={type} value={type}>
            {type}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label className="text-xs" htmlFor="live-card-record">
        Record id
      </label>
      <Input
        className="w-48"
        id="live-card-record"
        onChange={(event) => setRecordId(event.target.value)}
        value={recordId}
      />
      <Button size="sm" type="submit" variant="outline">
        Place live card
      </Button>
    </form>
  );
}
