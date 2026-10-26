import type { GitHubAvailability } from "./github-availability";

export async function addFreshGitHubConsent(
  request: Request,
  githubAvailability: Pick<GitHubAvailability, "requiresFreshConsent">,
) {
  if (
    request.method !== "POST" ||
    new URL(request.url).pathname !== "/api/auth/sign-in/social" ||
    !githubAvailability.requiresFreshConsent()
  ) {
    return request;
  }

  try {
    const body = (await request.clone().json()) as {
      additionalParams?: Record<string, string>;
      provider?: unknown;
      [key: string]: unknown;
    };
    if (body.provider !== "github") {
      return request;
    }

    const headers = new Headers(request.headers);
    headers.delete("content-length");
    return new Request(request, {
      body: JSON.stringify({
        ...body,
        additionalParams: {
          ...body.additionalParams,
          prompt: "consent",
        },
      }),
      headers,
    });
  } catch {
    return request;
  }
}
