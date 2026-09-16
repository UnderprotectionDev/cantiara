interface GitHubWaitingStatusProps {
  visible: boolean;
}

export default function GitHubWaitingStatus({
  visible,
}: GitHubWaitingStatusProps) {
  if (!visible) {
    return null;
  }

  return (
    <p aria-live="polite" className="mt-3 text-center text-sm" role="status">
      Waiting for GitHub
    </p>
  );
}
