const GENERIC_SIGN_IN_ERROR = "sign_in_failed";

export function sanitizeGitHubCallbackResponse(
  request: Request,
  response: Response,
  webOrigin: string,
) {
  if (!new URL(request.url).pathname.endsWith("/callback/github")) {
    return response;
  }

  const location = response.headers.get("location");
  if (!(location && new URL(location, request.url).searchParams.has("error"))) {
    return response;
  }

  const loginUrl = new URL("/login", webOrigin);
  loginUrl.searchParams.set("error", GENERIC_SIGN_IN_ERROR);
  const headers = new Headers(response.headers);
  headers.set("location", loginUrl.href);
  return new Response(null, { headers, status: response.status });
}
