// An idle pooled client can lose its connection (for example when the database
// or proxy closes it). The pool emits that as an `error` event and Node crashes
// the process when no listener exists; the pool already drops the broken client.
export function reportIdleClientError(error: Error) {
  console.error("Idle database client error:", error.message);
}
