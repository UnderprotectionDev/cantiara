import {
  type WebCaptureBrowser,
  type WebCapturePairingInput,
  webCapturePairingInputSchema,
} from "@cantiara/api/web-capture";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import type { StoredWebCaptureLink } from "../../lib/web-capture";
import { DEFAULT_DEVICE } from "../../lib/web-capture-draft";

export function WebCapturePairing({
  link,
  browser,
  isPairing,
  onInvalid,
  onPair,
}: {
  link: StoredWebCaptureLink | null;
  browser: WebCaptureBrowser | null;
  isPairing: boolean;
  onInvalid: () => void;
  onPair: (input: WebCapturePairingInput) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: { device: DEFAULT_DEVICE, pairingCode: "" },
    onSubmit: async ({ value }) => {
      const parsed = webCapturePairingInputSchema.safeParse({
        browser,
        code: value.pairingCode,
        device: value.device.trim() || DEFAULT_DEVICE,
      });
      if (!parsed.success) {
        onInvalid();
        return;
      }
      await onPair(parsed.data);
    },
  });

  return link ? null : (
    <section aria-labelledby="pair-heading" className="capture-section">
      <h2 id="pair-heading">Pair this browser</h2>
      <p className="muted">
        Generate a Pairing code in Cantiara, then enter it here. This pairing
        code expires in five minutes and can be used once.
      </p>
      {browser ? (
        <form
          className="pair-form"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="pairingCode">
            {(field) => (
              <label htmlFor="pairing-code">
                Pairing code
                <Input
                  autoComplete="one-time-code"
                  id="pairing-code"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="CANTIARA-AB12-CD34"
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="device">
            {(field) => (
              <label htmlFor="pairing-device">
                Device
                <Input
                  id="pairing-device"
                  maxLength={255}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.pairingCode}>
            {(pairingCode) => (
              <button
                disabled={isPairing || pairingCode.trim().length === 0}
                type="submit"
              >
                {isPairing ? "Pairing…" : "Pair"}
              </button>
            )}
          </form.Subscribe>
        </form>
      ) : (
        <p className="warning">This browser cannot pair with Web Capture.</p>
      )}
    </section>
  );
}
