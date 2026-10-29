import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import LookAgainList, {
  type OpenLookAgainSource,
} from "../components/look-again-list";

const noop = () => undefined;

export default function LookAgainPageView({
  openSourceRecord,
}: {
  openSourceRecord: OpenLookAgainSource;
}) {
  return (
    <ClientShellContent>
      <main className="mx-auto grid w-full max-w-3xl gap-4 p-4">
        <h1 className="font-semibold text-xl">Look again</h1>
        <LookAgainList
          onOpenSource={noop}
          openSourceRecord={openSourceRecord}
        />
      </main>
    </ClientShellContent>
  );
}
