if (process.env.CONDUCTOR_PORT) {
  const url = process.env.BETTER_AUTH_URL;
  if (!url) {
    throw new Error("BETTER_AUTH_URL is required for Conductor development");
  }

  console.log("Waiting for API before starting web");
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: Readiness probes must run in order.
      const response = await fetch(`${url}/api/auth/get-session`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* API is still starting. */
    }
    await Bun.sleep(500);
  }

  if (!ready) {
    throw new Error("API did not become ready; web was not started");
  }
}
