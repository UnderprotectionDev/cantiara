export function createGitHubSignInCallbackUrl(webOrigin: string) {
  return new URL("/dashboard", webOrigin).href;
}
