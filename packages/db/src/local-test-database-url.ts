const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export const LOCAL_TEST_DATABASE_URL =
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

function databaseHostname(databaseUrl: string): string {
	try {
		return new URL(databaseUrl).hostname.toLowerCase();
	} catch {
		return "";
	}
}

export function isLoopbackDatabaseUrl(
	databaseUrl = process.env.DATABASE_URL ?? ""
): boolean {
	return LOOPBACK_HOSTS.has(databaseHostname(databaseUrl));
}

export function localTestDatabaseUrl(
	databaseUrl = process.env.DATABASE_URL
): string {
	if (databaseUrl && isLoopbackDatabaseUrl(databaseUrl)) {
		return databaseUrl;
	}
	return LOCAL_TEST_DATABASE_URL;
}

const TEST_FILE_ARGV = /\.(test|spec)\.[cm]?[jt]sx?$/;

export function isTestProcess(
	argv = process.argv,
	vitest = process.env.VITEST
): boolean {
	if (vitest) {
		return true;
	}
	return argv.some((arg) => TEST_FILE_ARGV.test(arg));
}

export function prismaAdapterConnectionString(
	databaseUrl: string,
	testProcess = isTestProcess()
): string {
	return testProcess ? localTestDatabaseUrl(databaseUrl) : databaseUrl;
}

export function assertDatabaseUrlAllowsDbPush(databaseUrl: string): void {
	if (!databaseUrl || isLoopbackDatabaseUrl(databaseUrl)) {
		return;
	}
	throw new Error(
		"Refusing prisma db push against a hosted database. Target loopback Postgres."
	);
}
