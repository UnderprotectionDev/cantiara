import {
  USER_FLOW_NODE_KINDS,
  userFlowTemplateNameSchema,
  userFlowTitleSchema,
} from "@cantiara/api/user-flow";
import { z } from "zod";

/** Option value that selects `Create a new Screen` in `Promote to Screen`. */
export const PROMOTE_CREATE_NEW = "__create__";

/** The outline's `Add a node to the outline` form; a Screen node needs a Screen. */
export const createOutlineNodeFormSchema = z
  .object({
    kind: z.enum(USER_FLOW_NODE_KINDS),
    screenId: z.string(),
    text: z.string(),
  })
  .refine((value) => value.kind !== "Screen" || value.screenId !== "", {
    path: ["screenId"],
  });

/** `Promote to Screen`: link a chosen Screen, or create one with a title. */
export const promoteToScreenFormSchema = z
  .object({ choice: z.string().min(1), title: z.string() })
  .transform((value, context) => {
    if (value.choice !== PROMOTE_CREATE_NEW) {
      return { mode: "link" as const, screenId: value.choice };
    }
    const title = value.title.trim();
    if (title === "") {
      context.addIssue({ code: "custom", path: ["title"] });
      return z.NEVER;
    }
    return { mode: "create" as const, title };
  });

/** `Save as template`: a name and at least one selected node. */
export const saveUserFlowTemplateFormSchema = z.object({
  name: userFlowTemplateNameSchema,
  nodeIds: z.array(z.string().min(1)).min(1),
});

/** `Create from template`: a chosen template and a title. */
export const createUserFlowFromTemplateFormSchema = z.object({
  templateId: z.string().min(1),
  title: userFlowTitleSchema,
});
