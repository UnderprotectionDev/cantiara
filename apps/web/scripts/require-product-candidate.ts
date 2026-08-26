import {
	desktopBackendTarget,
	productCandidateSigningReady,
} from "../src/features/web-macos-client/macos-package";

const signing = productCandidateSigningReady(process.env);
if (!signing.ready) {
	process.stderr.write(`${signing.reason}\n`);
	process.exit(1);
}

const serverUrl = process.env.VITE_SERVER_URL ?? "";
if (desktopBackendTarget(serverUrl) !== "hono-bun") {
	process.stderr.write("local-backend\n");
	process.exit(1);
}

process.stdout.write("product-candidate-credentials-ready\n");
