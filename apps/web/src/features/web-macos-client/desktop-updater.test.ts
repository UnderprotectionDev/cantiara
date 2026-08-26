/**
 * Client Shell seam — Tauri Updater applies only a signature-verified
 * desktop output. Invalid or modified packages are rejected without
 * breaking the previously working version. No automatic rollback; the
 * previous signed installer stays downloadable for manual recovery.
 * Signing uses an Ed25519 test double (spec: CI may double certificates).
 * docs/specs/03-web-macos-client/spec.md and
 * docs/prd/16-product-acceptance.md#platform-kabulu
 */
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import {
	applyVerifiedDesktopUpdate,
	manualRecoveryInstaller,
	recoverFromFailedUpdate,
	verifyDesktopUpdateSignature,
} from "./desktop-updater";

const INSTALLED = "1.0.0";
const CANDIDATE = "1.1.0";
const PAYLOAD = new TextEncoder().encode("cantiara-desktop-1.1.0");
const TAMPERED = new TextEncoder().encode("cantiara-desktop-1.1.0-tampered");

function keyPair() {
	return generateKeyPairSync("ed25519");
}

function signedCandidate(
	privateKey: ReturnType<typeof keyPair>["privateKey"],
	payload: Uint8Array = PAYLOAD
) {
	return {
		payload,
		signature: new Uint8Array(sign(null, payload, privateKey)),
		version: CANDIDATE,
	};
}

test("a valid signed update replaces the installed desktop", () => {
	const { privateKey, publicKey } = keyPair();
	const installed = { version: INSTALLED };

	expect(
		applyVerifiedDesktopUpdate(
			installed,
			signedCandidate(privateKey),
			publicKey,
			verifyDesktopUpdateSignature
		)
	).toEqual({ status: "applied", version: CANDIDATE });
});

test("an invalid signature is rejected and the previous version stays running", () => {
	const { publicKey } = keyPair();
	const other = keyPair();
	const installed = { version: INSTALLED };

	expect(
		applyVerifiedDesktopUpdate(
			installed,
			signedCandidate(other.privateKey),
			publicKey,
			verifyDesktopUpdateSignature
		)
	).toEqual({
		previousIntact: true,
		status: "rejected",
		version: INSTALLED,
	});
	expect(installed.version).toBe(INSTALLED);
});

test("a modified payload with the original signature is rejected and the previous version stays running", () => {
	const { privateKey, publicKey } = keyPair();
	const installed = { version: INSTALLED };
	const candidate = signedCandidate(privateKey);
	candidate.payload = TAMPERED;

	expect(
		applyVerifiedDesktopUpdate(
			installed,
			candidate,
			publicKey,
			verifyDesktopUpdateSignature
		)
	).toEqual({
		previousIntact: true,
		status: "rejected",
		version: INSTALLED,
	});
	expect(installed.version).toBe(INSTALLED);
});

test("a failed update does not roll back automatically; the previous signed installer stays downloadable", () => {
	const catalog = [
		{
			downloadable: true,
			signed: true,
			url: "https://github.com/UnderprotectionDev/cantiara/releases/download/desktop-v1.0.0/Cantiara_1.0.0_aarch64.dmg",
			version: INSTALLED,
		},
		{
			downloadable: true,
			signed: true,
			url: "https://github.com/UnderprotectionDev/cantiara/releases/download/desktop-v1.1.0/Cantiara_1.1.0_aarch64.dmg",
			version: CANDIDATE,
		},
	];
	const installed = { version: CANDIDATE };

	expect(recoverFromFailedUpdate(installed, catalog)).toEqual({
		installedVersion: CANDIDATE,
		manualInstaller: catalog[0],
		rolledBack: false,
	});
	expect(manualRecoveryInstaller(catalog, CANDIDATE)).toEqual(catalog[0]);
});

test("an unsigned previous installer is not offered for manual recovery", () => {
	expect(
		manualRecoveryInstaller(
			[
				{
					downloadable: true,
					signed: false,
					url: "https://example.test/unsigned.dmg",
					version: INSTALLED,
				},
				{
					downloadable: true,
					signed: true,
					url: "https://github.com/UnderprotectionDev/cantiara/releases/download/desktop-v1.1.0/Cantiara_1.1.0_aarch64.dmg",
					version: CANDIDATE,
				},
			],
			CANDIDATE
		)
	).toBeNull();
});

test("the shipping Tauri updater requires a minisign pubkey and GitHub Releases", () => {
	const tauriConf = JSON.parse(
		readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				"../../../src-tauri/tauri.conf.json"
			),
			"utf8"
		)
	) as {
		bundle: { createUpdaterArtifacts?: boolean };
		plugins: {
			updater?: {
				endpoints?: string[];
				pubkey?: string;
			};
		};
	};

	expect(tauriConf.bundle.createUpdaterArtifacts).toBe(true);
	expect(tauriConf.plugins.updater?.pubkey?.length).toBeGreaterThan(80);
	expect(tauriConf.plugins.updater?.endpoints).toEqual([
		"https://github.com/UnderprotectionDev/cantiara/releases/latest/download/latest.json",
	]);

	const capabilities = JSON.parse(
		readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				"../../../src-tauri/capabilities/default.json"
			),
			"utf8"
		)
	) as { permissions: Array<string | { identifier: string }> };

	expect(capabilities.permissions).toContain("updater:default");
});
