import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Check, LockKeyhole, Pencil, Save } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useProjectShortCode } from "../../hooks/use-project-short-code";

export default function ProjectShortCodeForm({
  project,
}: {
  project: ProjectProfile;
}) {
  const [shortCode, setShortCode] = useState(project.shortCode);
  const [isEditing, setIsEditing] = useState(false);
  const { clearError, error, isPending, saveShortCode } =
    useProjectShortCode(project);

  useEffect(() => {
    setShortCode(project.shortCode);
  }, [project.shortCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextShortCode = shortCode.trim();
    if (!nextShortCode || nextShortCode === project.shortCode) {
      return;
    }
    if (await saveShortCode(nextShortCode)) {
      setIsEditing(false);
    }
  }

  function cancelEditing() {
    setShortCode(project.shortCode);
    setIsEditing(false);
    clearError();
  }

  const handleShortCodeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setShortCode(event.target.value);
    },
    [],
  );
  const handleStartEditing = useCallback(() => {
    clearError();
    setIsEditing(true);
  }, [clearError]);

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Short code</p>
          <p className="mt-1 flex items-center gap-2 font-medium text-sm">
            <span>{project.shortCode}</span>
            {project.shortCodeLocked ? (
              <LockKeyhole
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
            ) : null}
          </p>
          {project.shortCodeLocked ? (
            <p
              className="mt-1 text-muted-foreground text-xs"
              id={`short-code-help-${project.id}`}
            >
              Short code is locked after the first Work.
            </p>
          ) : null}
        </div>
        {project.shortCodeLocked ? null : (
          <Button
            aria-label="Edit Short code"
            className="min-h-11"
            onClick={handleStartEditing}
            size="sm"
            type="button"
            variant="outline"
          >
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <label
        className="font-medium text-xs"
        htmlFor={`short-code-${project.id}`}
      >
        Short code
      </label>
      <Input
        aria-label="Short code"
        disabled={isPending}
        id={`short-code-${project.id}`}
        onChange={handleShortCodeChange}
        value={shortCode}
      />
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={
            isPending ||
            !shortCode.trim() ||
            shortCode.trim() === project.shortCode
          }
          size="sm"
          type="submit"
        >
          {isPending ? (
            <Save aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          Save Short code
        </Button>
        <Button
          className="min-h-11"
          disabled={isPending}
          onClick={cancelEditing}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
