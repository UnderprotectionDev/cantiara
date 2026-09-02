function isTauriRuntime(runtime: object): boolean {
	return "__TAURI_INTERNALS__" in runtime;
}

export function productServerUrl(
	configuredUrl: string,
	runtime: object = globalThis
): string {
	const record = runtime as {
		location?: { origin: string };
		process?: { env?: Record<string, string | undefined> };
	};
	const processEnv = record.process?.env;
	if (!record.location && processEnv?.SERVER_URL) {
		return processEnv.SERVER_URL.endsWith("/")
			? processEnv.SERVER_URL.slice(0, -1)
			: processEnv.SERVER_URL;
	}

	const normalized = configuredUrl.endsWith("/")
		? configuredUrl.slice(0, -1)
		: configuredUrl;

	if (record.location && !isTauriRuntime(runtime)) {
		return record.location.origin;
	}

	if (!normalized.startsWith("/")) {
		return normalized;
	}

	if (record.location) {
		return `${record.location.origin}${normalized}`;
	}

	const vercelUrl =
		processEnv?.VERCEL_ENV === "production"
			? (processEnv?.VERCEL_PROJECT_PRODUCTION_URL ?? processEnv?.VERCEL_URL)
			: (processEnv?.VERCEL_URL ?? processEnv?.VERCEL_PROJECT_PRODUCTION_URL);
	if (vercelUrl) {
		const origin = vercelUrl.startsWith("http")
			? vercelUrl
			: `https://${vercelUrl}`;
		return `${origin}${normalized}`;
	}

	return `http://localhost:3000${normalized}`;
}
