const LOOPBACK_DATABASE = /127\.0\.0\.1|localhost/;

export const LOCAL_TEST_DATABASE_URL =
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

export function isLoopbackDatabaseUrl(
	databaseUrl = process.env.DATABASE_URL ?? ""
): boolean {
	return LOOPBACK_DATABASE.test(databaseUrl);
}

export function localTestDatabaseUrl(
	databaseUrl = process.env.DATABASE_URL
): string {
	if (databaseUrl && isLoopbackDatabaseUrl(databaseUrl)) {
		return databaseUrl;
	}
	return LOCAL_TEST_DATABASE_URL;
}
