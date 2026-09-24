import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Check, LockKeyhole, Save } from "lucide-react";
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
  const { error, isPending, saveShortCode } = useProjectShortCode(project);

  useEffect(() => {
    setShortCode(project.shortCode);
  }, [project.shortCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextShortCode = shortCode.trim();
    if (!nextShortCode || nextShortCode === project.shortCode) {
      return;
    }
    await saveShortCode(nextShortCode);
  }

  const handleShortCodeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setShortCode(event.target.value);
    },
    [],
  );

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <label
        className="font-medium text-xs"
        htmlFor={`short-code-${project.id}`}
      >
        Short code
      </label>
      <div className="flex gap-2">
        <Input
          aria-describedby={
            project.shortCodeLocked
              ? `short-code-help-${project.id}`
              : undefined
          }
          aria-label="Short code"
          disabled={project.shortCodeLocked || isPending}
          id={`short-code-${project.id}`}
          onChange={handleShortCodeChange}
          value={shortCode}
        />
        {project.shortCodeLocked ? (
          <LockKeyhole
            aria-hidden="true"
            className="mt-2 size-4 shrink-0 text-muted-foreground"
          />
        ) : (
          <Button
            aria-label="Save Short code"
            className="min-w-10"
            disabled={
              isPending ||
              !shortCode.trim() ||
              shortCode.trim() === project.shortCode
            }
            size="icon"
            type="submit"
            variant="outline"
          >
            {isPending ? (
              <Save aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
      <p
        className="text-muted-foreground text-xs"
        id={`short-code-help-${project.id}`}
      >
        {project.shortCodeLocked
          ? "Short code is locked after the first Work."
          : "Editable until the first Work."}
      </p>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
