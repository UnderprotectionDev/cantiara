import {
  isProjectCoreArea,
  type ProjectArea,
} from "@cantiara/api/project-shell";

export function projectAreaNavigationHash(area: ProjectArea) {
  return isProjectCoreArea(area)
    ? projectAreaSlug(area)
    : `project-area-${projectAreaSlug(area)}`;
}

export function projectAreaCatalogAnchor(area: ProjectArea) {
  return `#project-area-${projectAreaSlug(area)}`;
}

function projectAreaSlug(area: ProjectArea) {
  return area.toLowerCase().replaceAll(" ", "-");
}
