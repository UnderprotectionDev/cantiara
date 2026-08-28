import { withProductSessionHeaders } from "../../account-access/forms/tauri-session-token";
import { withDesktopApiHeaders } from "../../web-macos-client/views/client-shell";

export async function fetchProductMedia(
	href: string,
	fetchImpl: typeof fetch = globalThis.fetch
): Promise<Blob> {
	const response = await fetchImpl(href, {
		credentials: "include",
		headers: withDesktopApiHeaders(withProductSessionHeaders()),
	});
	if (!response.ok) {
		throw new Error("unavailable");
	}
	return response.blob();
}
