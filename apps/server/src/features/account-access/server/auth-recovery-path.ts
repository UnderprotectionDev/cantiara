export function isRecoverableAuthPath(path: string) {
  const authPath = path.startsWith("/api/auth/")
    ? path.slice("/api/auth".length)
    : path;
  return (
    authPath === "/sign-out" ||
    authPath === "/callback/github" ||
    authPath.startsWith("/sign-in/")
  );
}
