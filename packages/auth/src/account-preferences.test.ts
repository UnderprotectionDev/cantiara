/**
 * Account Preferences seam — Hesap locale, time zone, date format,
 * first day of week, and Appearance (Light/Dark). Defaults, first-login
 * suggestion without applying it, save, date/number/week formatting,
 * time zone display versus stored instants, English chrome with no
 * language preference, Light/Dark from the Hesap record rather than a
 * device key, and no Bitiriş efekti controls. Synthetic fixture for the
 * locale and Light/Dark slice of
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İngilizce ürün dili).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	ACCOUNT_PREFERENCES_COPY,
	preferencesChrome,
} from "./account-preferences-copy";
import {
	calendarDay,
	displayRecord,
	formatDate,
	formatDateTime,
	formatNumber,
	instantFromCalendarDate,
	startOfWeekCalendarDate,
	weekdayHeaders,
} from "./account-preferences-format";
import {
	appearanceFromHesap,
	appearanceSchema,
	applySuggestedLocaleAndTimeZone,
	DEFAULT_FIRST_DAY_OF_WEEK,
	DEFAULT_LOCALE,
	DEFAULT_TIME_ZONE,
	shouldShowLocaleTimeZoneSuggestion,
} from "./account-preferences-model";
import {
	getAccountPreferences,
	saveAccountPreferences,
} from "./account-preferences-persist";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const SAMPLE_INSTANT = new Date("2026-03-29T12:00:00.000Z");
const LATE_INSTANT = new Date("2026-03-29T21:00:00.000Z");
const SAMPLE_NUMBER = 1234.5;

function defaults() {
	return {
		appearance: "Dark" as const,
		dateFormat: "locale" as const,
		firstDayOfWeek: DEFAULT_FIRST_DAY_OF_WEEK,
		locale: DEFAULT_LOCALE,
		saved: false,
		timeZone: DEFAULT_TIME_ZONE,
	};
}

function preferenceInput(
	overrides: Partial<Omit<ReturnType<typeof defaults>, "saved">> = {}
) {
	const { saved: _saved, ...input } = defaults();
	return { ...input, ...overrides };
}

describe("Account Preferences", () => {
	let prisma: PrismaClient;
	let pool: Pool;
	let accountId: string;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.accountPreference.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
		const user = await prisma.user.create({
			data: {
				email: "founder@example.com",
				emailVerified: true,
				id: crypto.randomUUID(),
				name: "Taslak başlık",
			},
		});
		accountId = user.id;
		await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Workspace",
				ownerId: accountId,
			},
		});
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("keeps Hesap persist off the web Account Preferences modules", async () => {
		const copy = await import("./account-preferences-copy");
		const format = await import("./account-preferences-format");
		const model = await import("./account-preferences-model");
		for (const webModule of [copy, format, model]) {
			expect("getAccountPreferences" in webModule).toBe(false);
			expect("saveAccountPreferences" in webModule).toBe(false);
		}
	});

	it("uses en-GB, Europe/Istanbul, Monday, and Dark when the Hesap has no saved preferences", async () => {
		await expect(getAccountPreferences(prisma, accountId)).resolves.toEqual(
			defaults()
		);
	});

	it("shows the first-login locale and time zone suggestion without applying it until Save", async () => {
		const unsaved = await getAccountPreferences(prisma, accountId);
		expect(shouldShowLocaleTimeZoneSuggestion(unsaved)).toBe(true);
		const draft = applySuggestedLocaleAndTimeZone(unsaved, {
			locale: "tr-TR",
			timeZone: "Europe/Berlin",
		});
		expect(draft).toMatchObject({
			locale: "tr-TR",
			saved: false,
			timeZone: "Europe/Berlin",
		});
		await expect(getAccountPreferences(prisma, accountId)).resolves.toEqual(
			defaults()
		);
	});

	it("saves locale, time zone, date format, and first day of week on the Hesap", async () => {
		const saved = await saveAccountPreferences(
			prisma,
			accountId,
			preferenceInput({
				dateFormat: "yyyy-MM-dd",
				firstDayOfWeek: "Sunday",
				locale: "tr-TR",
				timeZone: "America/New_York",
			})
		);
		expect(saved).toEqual({
			appearance: "Dark",
			dateFormat: "yyyy-MM-dd",
			firstDayOfWeek: "Sunday",
			locale: "tr-TR",
			saved: true,
			timeZone: "America/New_York",
		});
		await expect(getAccountPreferences(prisma, accountId)).resolves.toEqual(
			saved
		);
		expect(shouldShowLocaleTimeZoneSuggestion(saved)).toBe(false);
	});

	it("applies the browser suggestion only through the same Save command", async () => {
		const draft = applySuggestedLocaleAndTimeZone(defaults(), {
			locale: "de-DE",
			timeZone: "Europe/Berlin",
		});
		const saved = await saveAccountPreferences(
			prisma,
			accountId,
			preferenceInput({
				dateFormat: draft.dateFormat,
				firstDayOfWeek: draft.firstDayOfWeek,
				locale: draft.locale,
				timeZone: draft.timeZone,
			})
		);
		expect(saved).toMatchObject({
			locale: "de-DE",
			saved: true,
			timeZone: "Europe/Berlin",
		});
	});

	it("formats a known timestamp and number from the Hesap locale and date format", () => {
		const london = {
			...defaults(),
			saved: true,
		};
		expect(formatDate(SAMPLE_INSTANT, london)).toBe("29/03/2026");
		expect(formatDateTime(SAMPLE_INSTANT, london)).toBe("29/03/2026, 15:00");
		expect(formatNumber(SAMPLE_NUMBER, london)).toBe("1,234.5");

		const us = {
			...london,
			locale: "en-US",
		};
		expect(formatDate(SAMPLE_INSTANT, us)).toBe("03/29/2026");
		expect(formatDateTime(SAMPLE_INSTANT, us)).toBe("03/29/2026, 03:00 PM");
		expect(formatNumber(SAMPLE_NUMBER, us)).toBe("1,234.5");

		const turkish = {
			...london,
			locale: "tr-TR",
		};
		expect(formatDate(SAMPLE_INSTANT, turkish)).toBe("29.03.2026");
		expect(formatNumber(SAMPLE_NUMBER, turkish)).toBe("1.234,5");

		const isoDate = {
			...london,
			dateFormat: "yyyy-MM-dd" as const,
		};
		expect(formatDate(SAMPLE_INSTANT, isoDate)).toBe("2026-03-29");
		expect(
			formatDate(SAMPLE_INSTANT, { ...london, dateFormat: "MM/dd/yyyy" })
		).toBe("03/29/2026");
	});

	it("shifts the week grid and week boundary from the first day of week", () => {
		const monday = defaults();
		expect(weekdayHeaders(monday)).toEqual([
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
			"Sunday",
		]);
		expect(startOfWeekCalendarDate(SAMPLE_INSTANT, monday)).toBe("2026-03-23");

		const sunday = { ...monday, firstDayOfWeek: "Sunday" as const };
		expect(weekdayHeaders(sunday)[0]).toBe("Sunday");
		expect(startOfWeekCalendarDate(SAMPLE_INSTANT, sunday)).toBe("2026-03-29");

		const saturday = { ...monday, firstDayOfWeek: "Saturday" as const };
		expect(weekdayHeaders(saturday)[0]).toBe("Saturday");
		expect(startOfWeekCalendarDate(SAMPLE_INSTANT, saturday)).toBe(
			"2026-03-28"
		);
	});

	it("changes calendar day boundaries, historical display, and future date entry with time zone without rewriting the stored instant", () => {
		const istanbul = defaults();
		const newYork = { ...istanbul, timeZone: "America/New_York" };
		expect(LATE_INSTANT.toISOString()).toBe("2026-03-29T21:00:00.000Z");
		expect(calendarDay(LATE_INSTANT, istanbul)).toBe("2026-03-30");
		expect(calendarDay(LATE_INSTANT, newYork)).toBe("2026-03-29");
		expect(formatDate(LATE_INSTANT, istanbul)).toBe("30/03/2026");
		expect(formatDateTime(LATE_INSTANT, istanbul)).toBe("30/03/2026, 00:00");
		expect(formatDateTime(LATE_INSTANT, newYork)).toBe("29/03/2026, 17:00");
		expect(instantFromCalendarDate("2026-03-30", istanbul).toISOString()).toBe(
			"2026-03-29T21:00:00.000Z"
		);
		expect(instantFromCalendarDate("2026-03-29", newYork).toISOString()).toBe(
			"2026-03-29T04:00:00.000Z"
		);
		expect(LATE_INSTANT.toISOString()).toBe("2026-03-29T21:00:00.000Z");
	});

	it("does not rewrite stored keys, statuses, field values, or exact timestamps when preferences change", async () => {
		const created = await prisma.user.findUniqueOrThrow({
			where: { id: accountId },
		});
		const storedInstant = created.createdAt.toISOString();
		const record = {
			key: "CAN-1",
			occurredAt: LATE_INSTANT,
			status: "In Progress",
			title: "Taslak başlık",
		};
		const before = displayRecord(record, defaults());
		await saveAccountPreferences(
			prisma,
			accountId,
			preferenceInput({
				dateFormat: "MM/dd/yyyy",
				firstDayOfWeek: "Sunday",
				locale: "tr-TR",
				timeZone: "America/New_York",
			})
		);
		const afterPrefs = await getAccountPreferences(prisma, accountId);
		const after = displayRecord(record, afterPrefs);
		expect(after.key).toBe("CAN-1");
		expect(after.status).toBe("In Progress");
		expect(after.title).toBe("Taslak başlık");
		expect(after.occurredAt).toBe("2026-03-29T21:00:00.000Z");
		expect(after.occurredAtDisplay).not.toBe(before.occurredAtDisplay);
		const reloaded = await prisma.user.findUniqueOrThrow({
			where: { id: accountId },
		});
		expect(reloaded.name).toBe("Taslak başlık");
		expect(reloaded.createdAt.toISOString()).toBe(storedInstant);
		expect(
			await prisma.workspace.findUniqueOrThrow({
				where: { ownerId: accountId },
			})
		).toMatchObject({ name: "Workspace" });
	});

	it("keeps English chrome and has no language preference when locale is tr-TR", () => {
		const chrome = preferencesChrome("tr-TR");
		expect(chrome).toMatchObject({
			appearance: "Appearance",
			dark: "Dark",
			dateFormat: "Date format",
			firstDayOfWeek: "First day of week",
			heading: "Preferences",
			light: "Light",
			locale: "Locale",
			save: "Save",
			timeZone: "Time zone",
			useSuggested: "Use suggested locale and time zone",
		});
		expect(chrome).toEqual(ACCOUNT_PREFERENCES_COPY);
		expect(chrome).toEqual(preferencesChrome("en-GB"));
		expect("language" in chrome).toBe(false);
		expect(Object.values(chrome)).not.toContain("Confirm GitHub Identity");
		expect(Object.values(chrome)).not.toContain("Language");
		expect(Object.values(chrome)).not.toContain("System");
		expect(Object.values(chrome)).not.toContain("Bitiriş efekti");
		expect(Object.values(chrome)).not.toContain("Completion effect");
		expect(Object.values(chrome)).not.toContain("Palette");
		expect(weekdayHeaders({ ...defaults(), locale: "tr-TR" })[0]).toBe(
			"Monday"
		);
	});

	it("does not take a Project override; the Hesap record applies across Projects", async () => {
		await saveAccountPreferences(
			prisma,
			accountId,
			preferenceInput({
				appearance: "Light",
				dateFormat: "locale",
				firstDayOfWeek: "Monday",
				locale: "en-US",
				timeZone: "Europe/London",
			})
		);
		const saved = await getAccountPreferences(prisma, accountId);
		expect(saved).toEqual({
			appearance: "Light",
			dateFormat: "locale",
			firstDayOfWeek: "Monday",
			locale: "en-US",
			saved: true,
			timeZone: "Europe/London",
		});
		expect("projectId" in saved).toBe(false);
	});

	it("saves Light and Dark Appearance on the Hesap", async () => {
		const light = await saveAccountPreferences(
			prisma,
			accountId,
			preferenceInput({ appearance: "Light" })
		);
		expect(light.appearance).toBe("Light");
		await expect(
			getAccountPreferences(prisma, accountId)
		).resolves.toMatchObject({ appearance: "Light", saved: true });
		const dark = await saveAccountPreferences(
			prisma,
			accountId,
			preferenceInput({ appearance: "Dark" })
		);
		expect(dark.appearance).toBe("Dark");
		await expect(
			getAccountPreferences(prisma, accountId)
		).resolves.toMatchObject({ appearance: "Dark", saved: true });
	});

	it("does not accept System as a Hesap Appearance value", async () => {
		await expect(
			saveAccountPreferences(prisma, accountId, {
				...preferenceInput(),
				appearance: "System",
			} as unknown as ReturnType<typeof preferenceInput>)
		).rejects.toThrow();
		await expect(
			saveAccountPreferences(prisma, accountId, {
				...preferenceInput(),
				appearance: "dark",
			} as unknown as ReturnType<typeof preferenceInput>)
		).rejects.toThrow();
		await expect(getAccountPreferences(prisma, accountId)).resolves.toEqual(
			defaults()
		);
	});

	it("applies Light and Dark from the Hesap record rather than a device theme key", async () => {
		await saveAccountPreferences(
			prisma,
			accountId,
			preferenceInput({ appearance: "Dark" })
		);
		const saved = await getAccountPreferences(prisma, accountId);
		expect(appearanceFromHesap(saved, "light")).toBe("Dark");
		expect(appearanceFromHesap(saved, "system")).toBe("Dark");
		expect(appearanceSchema.safeParse("system").success).toBe(false);
		expect(appearanceSchema.safeParse("vite-ui-theme").success).toBe(false);
	});
});
