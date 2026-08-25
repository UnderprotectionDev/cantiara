const TOKEN_KEY = "product-session";
const STRONGHOLD_CLIENT = "account-access";

let cachedToken: string | null = null;

export function isDesktopShell(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getDesktopSessionToken(): string | null {
	return cachedToken;
}

export function withProductSessionHeaders(headers?: HeadersInit): Headers {
	const next = new Headers(headers);
	const token = getDesktopSessionToken();
	if (token && !next.has("authorization")) {
		next.set("Authorization", `Bearer ${token}`);
	}
	return next;
}

export async function loadDesktopSessionToken(): Promise<string | null> {
	if (!isDesktopShell()) {
		return null;
	}
	cachedToken = await readStrongholdToken();
	return cachedToken;
}

export async function saveDesktopSessionToken(token: string): Promise<void> {
	cachedToken = token;
	if (isDesktopShell()) {
		await writeStrongholdToken(token);
	}
}

export async function clearDesktopSessionToken(): Promise<void> {
	cachedToken = null;
	if (isDesktopShell()) {
		await writeStrongholdToken(null);
	}
}

async function vault() {
	const { invoke } = await import("@tauri-apps/api/core");
	const { appDataDir } = await import("@tauri-apps/api/path");
	const { Stronghold } = await import("@tauri-apps/plugin-stronghold");
	const password = await invoke<string>("desktop_vault_password");
	const vaultPath = `${await appDataDir()}/product-session.hold`;
	const stronghold = await Stronghold.load(vaultPath, password);
	let client: Awaited<ReturnType<typeof stronghold.loadClient>>;
	try {
		client = await stronghold.loadClient(STRONGHOLD_CLIENT);
	} catch {
		client = await stronghold.createClient(STRONGHOLD_CLIENT);
	}
	return { save: () => stronghold.save(), store: client.getStore() };
}

async function readStrongholdToken(): Promise<string | null> {
	const { store } = await vault();
	const data = await store.get(TOKEN_KEY);
	if (!data) {
		return null;
	}
	return new TextDecoder().decode(new Uint8Array(data));
}

async function writeStrongholdToken(token: string | null): Promise<void> {
	const { save, store } = await vault();
	if (token) {
		await store.insert(TOKEN_KEY, Array.from(new TextEncoder().encode(token)));
	} else {
		await store.remove(TOKEN_KEY);
	}
	await save();
}
