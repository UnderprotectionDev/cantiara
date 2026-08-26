import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "node:crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const CAPTURE_STAGING_KEY_VERSION = 1;

export function deriveCaptureStagingRootKey(secret: string): Buffer {
	return Buffer.from(
		hkdfSync(
			"sha256",
			secret,
			"cantiara-capture-staging",
			"envelope-root-v1",
			32
		)
	);
}

function encryptAesGcm(key: Buffer, plaintext: Uint8Array): Buffer {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]);
}

function decryptAesGcm(key: Buffer, packed: Uint8Array): Buffer {
	const buf = Buffer.from(packed);
	const iv = buf.subarray(0, IV_LENGTH);
	const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
	const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
	const decipher = createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function envelopeSeal(
	plaintext: Uint8Array,
	rootKey: Uint8Array
): {
	ciphertext: Uint8Array;
	keyVersion: number;
	wrappedDek: Uint8Array;
} {
	const dek = randomBytes(32);
	const ciphertext = encryptAesGcm(dek, plaintext);
	const wrappedDek = encryptAesGcm(Buffer.from(rootKey), dek);
	return {
		ciphertext,
		keyVersion: CAPTURE_STAGING_KEY_VERSION,
		wrappedDek,
	};
}

export function envelopeOpen(input: {
	ciphertext: Uint8Array;
	rootKey: Uint8Array;
	wrappedDek: Uint8Array;
}): Uint8Array {
	const dek = decryptAesGcm(Buffer.from(input.rootKey), input.wrappedDek);
	return decryptAesGcm(dek, input.ciphertext);
}
