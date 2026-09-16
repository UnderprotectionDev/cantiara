export async function sanitizeProductSessionResponse(
  request: Request,
  response: Response,
) {
  if (!new URL(request.url).pathname.endsWith("/get-session")) {
    return response;
  }

  const body = (await response.json()) as {
    session?: Record<string, unknown>;
    user?: unknown;
  } | null;
  if (!body?.session) {
    return Response.json(body, {
      headers: response.headers,
      status: response.status,
    });
  }

  const { token: _sessionSecret, ...session } = body.session;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(
    { ...body, session },
    { headers, status: response.status },
  );
}
