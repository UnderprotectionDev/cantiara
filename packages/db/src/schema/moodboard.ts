import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/** Tasarım type `Moodboard`: a Project-scoped main record. */
export const moodboard = pgTable(
  "moodboard",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("moodboard_project_idx").on(table.projectId),
    check(
      "moodboard_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check("moodboard_revision_check", sql`${table.revision} >= 0`),
  ],
);

/**
 * Ordered Moodboard content. `kind` discriminates the item; each kind owns a
 * one-to-one detail table keyed by the item ID, so later kinds (Color Swatch)
 * and per-view metadata add tables without reshaping this one.
 */
export const moodboardItem = pgTable(
  "moodboard_item",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    moodboardId: text("moodboard_id")
      .notNull()
      .references(() => moodboard.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("moodboard_item_moodboard_position_uidx").on(
      table.moodboardId,
      table.position,
    ),
    unique("moodboard_item_id_kind_uidx").on(table.id, table.kind),
    // Kept wide so later item kinds (Color Swatch) need no constraint change;
    // the allowed kinds are enforced by the API schema.
    check("moodboard_item_kind_check", sql`length(btrim(${table.kind})) > 0`),
    check("moodboard_item_position_check", sql`${table.position} >= 0`),
  ],
);

/**
 * A visual reference keeps its exact origin: one File Attachment version or
 * one external link. The caption lives only here; it is never written to the
 * File Attachment and has no thread, reaction, task, or mention.
 */
export const moodboardVisual = pgTable(
  "moodboard_visual",
  {
    caption: text("caption"),
    externalUrl: text("external_url"),
    // No foreign key: the exact File Attachment version is verified inside the
    // mutation transaction, and a new restricting key on an existing table is
    // not parallel-safe on the shared development database.
    fileAttachmentVersionId: text("file_attachment_version_id"),
    itemId: text("item_id").primaryKey(),
    itemKind: text("item_kind").default("Visual").notNull(),
    originKind: text("origin_kind").notNull(),
  },
  (table) => [
    index("moodboard_visual_version_idx").on(table.fileAttachmentVersionId),
    foreignKey({
      columns: [table.itemId, table.itemKind],
      foreignColumns: [moodboardItem.id, moodboardItem.kind],
      name: "moodboard_visual_item_fk",
    }).onDelete("cascade"),
    check(
      "moodboard_visual_item_kind_check",
      sql`${table.itemKind} = 'Visual'`,
    ),
    check(
      "moodboard_visual_caption_check",
      sql`${table.caption} is null or length(btrim(${table.caption})) between 1 and 280`,
    ),
    check(
      "moodboard_visual_origin_check",
      sql`(${table.originKind} = 'File Attachment version' and ${table.fileAttachmentVersionId} is not null and ${table.externalUrl} is null) or (${table.originKind} = 'External link' and ${table.externalUrl} is not null and ${table.fileAttachmentVersionId} is null and length(${table.externalUrl}) <= 2048)`,
    ),
  ],
);

/**
 * A named Color Swatch group on one Moodboard. It narrates visual direction;
 * it is not a theme, a token set, or a Completion effect palette.
 */
export const moodboardPaletteGroup = pgTable(
  "moodboard_palette_group",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    moodboardId: text("moodboard_id")
      .notNull()
      .references(() => moodboard.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("moodboard_palette_group_position_uidx").on(
      table.moodboardId,
      table.position,
    ),
    unique("moodboard_palette_group_id_moodboard_uidx").on(
      table.id,
      table.moodboardId,
    ),
    check(
      "moodboard_palette_group_name_check",
      sql`length(btrim(${table.name})) between 1 and 80`,
    ),
    check(
      "moodboard_palette_group_position_check",
      sql`${table.position} >= 0`,
    ),
  ],
);

/**
 * A Color Swatch: one normalized `#RRGGBB` value, an optional short note, and
 * optional membership of a Palette group of the same Moodboard. It has no link
 * to Account appearance, Completion effects, tokens, CSS, custom fields, or
 * Project Wall cards.
 */
export const moodboardColorSwatch = pgTable(
  "moodboard_color_swatch",
  {
    color: text("color").notNull(),
    itemId: text("item_id").primaryKey(),
    itemKind: text("item_kind").default("Color Swatch").notNull(),
    moodboardId: text("moodboard_id").notNull(),
    note: text("note"),
    paletteGroupId: text("palette_group_id"),
  },
  (table) => [
    index("moodboard_color_swatch_group_idx").on(table.paletteGroupId),
    foreignKey({
      columns: [table.itemId, table.itemKind],
      foreignColumns: [moodboardItem.id, moodboardItem.kind],
      name: "moodboard_color_swatch_item_fk",
    }).onDelete("cascade"),
    // A swatch can only join a group of its own Moodboard; MATCH SIMPLE skips
    // the check while the group is null.
    foreignKey({
      columns: [table.paletteGroupId, table.moodboardId],
      foreignColumns: [
        moodboardPaletteGroup.id,
        moodboardPaletteGroup.moodboardId,
      ],
      name: "moodboard_color_swatch_group_fk",
    }),
    check(
      "moodboard_color_swatch_item_kind_check",
      sql`${table.itemKind} = 'Color Swatch'`,
    ),
    check(
      "moodboard_color_swatch_color_check",
      sql`${table.color} ~ '^#[0-9A-F]{6}$'`,
    ),
    check(
      "moodboard_color_swatch_note_check",
      sql`${table.note} is null or length(btrim(${table.note})) between 1 and 140`,
    ),
  ],
);

/**
 * View-local crop and 90-degree rotation of one visual on this Moodboard. The
 * row is bound to the exact origin it was made for (`bound_origin` is the File
 * Attachment version ID or the external link), so it never applies to another
 * version. It never touches the File Attachment, its version chain, or any
 * other Moodboard that uses the same attachment. Crop edges are basis points
 * (0..10000) of the original image; no row means the unedited presentation.
 */
export const moodboardVisualView = pgTable(
  "moodboard_visual_view",
  {
    boundOrigin: text("bound_origin").notNull(),
    cropHeight: integer("crop_height"),
    cropLeft: integer("crop_left"),
    cropTop: integer("crop_top"),
    cropWidth: integer("crop_width"),
    itemId: text("item_id").primaryKey(),
    itemKind: text("item_kind").default("Visual").notNull(),
    rotation: integer("rotation").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId, table.itemKind],
      foreignColumns: [moodboardItem.id, moodboardItem.kind],
      name: "moodboard_visual_view_item_fk",
    }).onDelete("cascade"),
    check(
      "moodboard_visual_view_item_kind_check",
      sql`${table.itemKind} = 'Visual'`,
    ),
    check(
      "moodboard_visual_view_rotation_check",
      sql`${table.rotation} in (0, 90, 180, 270)`,
    ),
    check(
      "moodboard_visual_view_crop_check",
      sql`(${table.cropLeft} is null and ${table.cropTop} is null and ${table.cropWidth} is null and ${table.cropHeight} is null) or (${table.cropLeft} >= 0 and ${table.cropTop} >= 0 and ${table.cropWidth} >= 1 and ${table.cropHeight} >= 1 and ${table.cropLeft} + ${table.cropWidth} <= 10000 and ${table.cropTop} + ${table.cropHeight} <= 10000)`,
    ),
  ],
);

/**
 * Optional Focus order of Presentation Mode: view metadata that only lists
 * existing items of this Moodboard in a sequence. It owns no content, so there
 * is no second presentation document or content copy.
 */
export const moodboardFocusStep = pgTable(
  "moodboard_focus_step",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => moodboardItem.id, { onDelete: "cascade" }),
    moodboardId: text("moodboard_id")
      .notNull()
      .references(() => moodboard.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.moodboardId, table.itemId],
      name: "moodboard_focus_step_pk",
    }),
    uniqueIndex("moodboard_focus_step_position_uidx").on(
      table.moodboardId,
      table.position,
    ),
    check("moodboard_focus_step_position_check", sql`${table.position} >= 0`),
  ],
);
