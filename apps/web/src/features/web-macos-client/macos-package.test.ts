import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import {
	desktopBackendTarget,
	evaluateMacosPackageCandidate,
	type MacosPackageCandidate,
	macosSupportMatrix,
	productCandidateSigningReady,
	shippingBundleTargets,
	supportMatrixMajors,
} from "./macos-package";

const productPackage = (
	overrides: Partial<MacosPackageCandidate> = {}
): MacosPackageCandidate => ({
	backend: "hono-bun",
	euRegionPicker: false,
	nativeShells: ["macos"],
	notarized: true,
	operationalBackupUi: false,
	pwaInstall: false,
	selfHostInstaller: false,
	signed: true,
	signingIdentity: "Developer ID Application: Cantiara (TEAMID)",
	sourceOfTruth: "neon",
	supportMatrix: {
		cleanInstall: true,
		frozenAt: "2026-08-26",
		macosMajors: [26, 15, 14],
	},
	...overrides,
});

test("an unsigned skeleton package is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(
			productPackage({
				notarized: false,
				signed: false,
				signingIdentity: "-",
			})
		)
	).toEqual({
		reason: "unsigned-skeleton",
		status: "not-product-behavior",
	});
});

test("an ad-hoc signature is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(productPackage({ signingIdentity: "-" }))
	).toEqual({
		reason: "unsigned-skeleton",
		status: "not-product-behavior",
	});
});

test("a signed package that is not notarized is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(productPackage({ notarized: false }))
	).toEqual({
		reason: "not-notarized",
		status: "not-product-behavior",
	});
});

test("a package that talks to a local backend is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(productPackage({ backend: "local-dev" }))
	).toEqual({
		reason: "local-backend",
		status: "not-product-behavior",
	});
});

test("a package that moves Tauri onto a Rust data layer is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(
			productPackage({ backend: "rust-data-layer" })
		)
	).toEqual({
		reason: "rust-data-layer",
		status: "not-product-behavior",
	});
});

test("a package with a local Postgres source of truth is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(
			productPackage({ sourceOfTruth: "local-postgres" })
		)
	).toEqual({
		reason: "local-source-of-truth",
		status: "not-product-behavior",
	});
});

test("a package with a local file source of truth is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(
			productPackage({ sourceOfTruth: "local-files" })
		)
	).toEqual({
		reason: "local-source-of-truth",
		status: "not-product-behavior",
	});
});

test("a Windows or Linux native shell is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(
			productPackage({ nativeShells: ["macos", "windows"] })
		)
	).toEqual({
		reason: "non-macos-native-shell",
		status: "not-product-behavior",
	});
	expect(
		evaluateMacosPackageCandidate(productPackage({ nativeShells: ["linux"] }))
	).toEqual({
		reason: "non-macos-native-shell",
		status: "not-product-behavior",
	});
});

test("a PWA install surface is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(productPackage({ pwaInstall: true }))
	).toEqual({
		reason: "pwa-install",
		status: "not-product-behavior",
	});
});

test("a self-host installer is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(productPackage({ selfHostInstaller: true }))
	).toEqual({
		reason: "self-host-installer",
		status: "not-product-behavior",
	});
});

test("an EU region picker is not this package's job", () => {
	expect(
		evaluateMacosPackageCandidate(productPackage({ euRegionPicker: true }))
	).toEqual({
		reason: "eu-region-picker",
		status: "not-product-behavior",
	});
});

test("operational backup RPO/RTO UI is not this package's job", () => {
	expect(
		evaluateMacosPackageCandidate(productPackage({ operationalBackupUi: true }))
	).toEqual({
		reason: "operational-backup-ui",
		status: "not-product-behavior",
	});
});

test("a support matrix that counts numeric majors instead of released majors is not a product candidate", () => {
	expect(
		evaluateMacosPackageCandidate(
			productPackage({
				supportMatrix: {
					cleanInstall: true,
					frozenAt: "2026-08-26",
					macosMajors: [26, 25, 24],
				},
			})
		)
	).toEqual({
		reason: "support-matrix",
		status: "not-product-behavior",
	});
});

test("a signed and notarized macOS package on the Hono backend is a product candidate", () => {
	expect(evaluateMacosPackageCandidate(productPackage())).toEqual({
		status: "product-candidate",
	});
});

test("the Ürün destek matrisi freezes the current released macOS major and the previous two", () => {
	expect(supportMatrixMajors(26)).toEqual([26, 15, 14]);
	expect(macosSupportMatrix).toEqual({
		cleanInstall: true,
		frozenAt: "2026-08-26",
		macosMajors: [26, 15, 14],
	});
});

test("localhost and loopback API URLs are a local backend, not the product Hono server", () => {
	expect(desktopBackendTarget("http://localhost:3000")).toBe("local-dev");
	expect(desktopBackendTarget("http://127.0.0.1:3000")).toBe("local-dev");
	expect(desktopBackendTarget("http://[::1]:3000")).toBe("local-dev");
	expect(desktopBackendTarget("https://api.example.test")).toBe("hono-bun");
});

test("a product candidate release is refused without signing and notarization credentials", () => {
	expect(productCandidateSigningReady({})).toEqual({
		ready: false,
		reason: "missing-signing-credentials",
	});
	expect(
		productCandidateSigningReady({
			APPLE_CERTIFICATE: "cert",
			APPLE_CERTIFICATE_PASSWORD: "pass",
			APPLE_SIGNING_IDENTITY: "Developer ID Application: Cantiara (TEAMID)",
		})
	).toEqual({
		ready: false,
		reason: "missing-notarization-credentials",
	});
});

test("Apple ID or App Store Connect API credentials make a product candidate release ready", () => {
	expect(
		productCandidateSigningReady({
			APPLE_CERTIFICATE: "cert",
			APPLE_CERTIFICATE_PASSWORD: "pass",
			APPLE_ID: "founder@example.test",
			APPLE_PASSWORD: "app-specific",
			APPLE_SIGNING_IDENTITY: "Developer ID Application: Cantiara (TEAMID)",
			APPLE_TEAM_ID: "TEAMID1234",
		})
	).toEqual({ ready: true });
	expect(
		productCandidateSigningReady({
			APPLE_API_ISSUER: "issuer-uuid",
			APPLE_API_KEY: "KEYID",
			APPLE_API_KEY_PATH: "/tmp/AuthKey.p8",
			APPLE_CERTIFICATE: "cert",
			APPLE_CERTIFICATE_PASSWORD: "pass",
			APPLE_SIGNING_IDENTITY: "Developer ID Application: Cantiara (TEAMID)",
		})
	).toEqual({ ready: true });
});

test("the shipping Tauri bundle is macOS app and dmg only", () => {
	const tauriConf = JSON.parse(
		readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				"../../../src-tauri/tauri.conf.json"
			),
			"utf8"
		)
	) as {
		bundle: { targets: string | string[]; android?: unknown };
	};

	expect(shippingBundleTargets(tauriConf.bundle.targets)).toEqual([
		"app",
		"dmg",
	]);
	expect(tauriConf.bundle.android).toBeUndefined();
});

test("a support matrix frozen on another date is not this candidate", () => {
	expect(
		evaluateMacosPackageCandidate(
			productPackage({
				supportMatrix: {
					cleanInstall: true,
					frozenAt: "2099-01-01",
					macosMajors: [26, 15, 14],
				},
			})
		)
	).toEqual({
		reason: "support-matrix",
		status: "not-product-behavior",
	});
});

test("the committed Tauri signing identity is an unsigned skeleton, not a product candidate", () => {
	const tauriConf = JSON.parse(
		readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				"../../../src-tauri/tauri.conf.json"
			),
			"utf8"
		)
	) as {
		bundle: { macOS: { signingIdentity: string } };
	};

	expect(tauriConf.bundle.macOS.signingIdentity).toBe("-");
	expect(
		evaluateMacosPackageCandidate(
			productPackage({
				notarized: false,
				signed: false,
				signingIdentity: tauriConf.bundle.macOS.signingIdentity,
			})
		)
	).toEqual({
		reason: "unsigned-skeleton",
		status: "not-product-behavior",
	});
});

test("an ad-hoc signing identity is not enough for a product candidate release", () => {
	expect(
		productCandidateSigningReady({
			APPLE_CERTIFICATE: "cert",
			APPLE_CERTIFICATE_PASSWORD: "pass",
			APPLE_ID: "founder@example.test",
			APPLE_PASSWORD: "app-specific",
			APPLE_SIGNING_IDENTITY: "-",
			APPLE_TEAM_ID: "TEAMID1234",
		})
	).toEqual({
		ready: false,
		reason: "missing-signing-credentials",
	});
});
