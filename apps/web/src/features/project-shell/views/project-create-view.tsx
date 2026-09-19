import { Link } from "@tanstack/react-router";

import ProjectCreateForm from "../forms/project-create-form";

export default function ProjectCreateView() {
  return (
    <main className="surface-frame max-w-4xl">
      <header className="surface-header mb-8 max-w-2xl">
        <div className="mb-4 text-muted-foreground text-xs">
          <Link className="hover:text-foreground" to="/projects">
            Projects
          </Link>
          <span aria-hidden="true" className="px-2">
            /
          </span>
          <span>Create</span>
        </div>
        <h1 className="mt-2 text-balance font-semibold text-3xl tracking-tight">
          Create a Project
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-muted-foreground text-sm/6">
          Give the work a home. Choose a starting configuration once, then add
          context as the Project takes shape.
        </p>
      </header>
      <ProjectCreateForm />
    </main>
  );
}
