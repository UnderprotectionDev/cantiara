import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  previewFallback,
  type SmartLinkPreviewAccess,
  smartLinkPreviewSchema,
} from "@cantiara/api/smart-link-preview";

// Limit concurrent parser/image workers and kill the complete worker on a slow
// DNS/body/parser. No account, cookie, token or application environment crosses.
let activeWorkers = 0;
export const isolatedSmartLinkPreview: SmartLinkPreviewAccess = async (url) => {
  if (activeWorkers >= 4) {
    return previewFallback(url);
  }
  activeWorkers += 1;
  try {
    const extension = import.meta.url.endsWith(".ts") ? "ts" : "mjs";
    const worker = fileURLToPath(
      new URL(`./smart-link-egress-worker.${extension}`, import.meta.url),
    );
    const result = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        ["--no-env-file", "--smol", worker],
        {
          cwd: tmpdir(),
          env: {},
          timeout: 12_000,
          killSignal: "SIGKILL",
          maxBuffer: 2 * 1024 * 1024,
        },
        (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        },
      );
      child.stdin?.end(JSON.stringify(url));
    });
    return smartLinkPreviewSchema.parse(JSON.parse(result));
  } catch {
    return previewFallback(url);
  } finally {
    activeWorkers -= 1;
  }
};
