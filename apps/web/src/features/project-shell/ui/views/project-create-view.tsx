import { Link } from "@tanstack/react-router";

import ProjectCreateForm from "../forms/project-create-form";

export default function ProjectCreateView() {
  return (
    <main className="surface-frame max-w-4xl">
      <header className="surface-header mb-8 max-w-2xl">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link
                className="text-muted-foreground hover:text-foreground"
                to="/projects"
              >
                Projects
              </Link>
            </li>
            <li aria-hidden="true" className="text-muted-foreground">
              /
            </li>
            <li aria-current="page" className="font-medium">
              Create
            </li>
          </ol>
        </nav>
        <h1 className="text-balance font-semibold text-3xl tracking-tight">
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
