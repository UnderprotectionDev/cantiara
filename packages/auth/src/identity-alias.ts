import { createHmac } from "node:crypto";

export function identityAlias(
	kind: "account" | "session",
	id: string,
	secret: string
): string {
	return createHmac("sha256", secret).update(`${kind}:${id}`).digest("hex");
}
