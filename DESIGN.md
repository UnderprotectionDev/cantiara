---
version: alpha
name: Cantiara
description: "A quiet, exact project operating system for one founder. Neutral cool-gray surfaces (light #f8f8f8 / dark #121212) carry all hierarchy; color appears only when it means something. One orange (#f97316) is both the accent and Done (progress that has shipped), amber is In Progress, vivid green is review and passed outcomes, red is Blocked, Urgent and failed, violet is Decision, blue is Todo and Capture, mint-teal is Document. Geist Sans sets the interface; Geist Mono sets IDs, numbers, and deltas. Cards are flat panels with hairline borders; depth comes from a tonal surface ladder, not shadows."

colors:
  # Light neutrals
  sidebar: "#f3f3f3"
  canvas: "#f8f8f8"
  surface: "#ffffff"
  surface-hover: "#f4f4f5"
  surface-selected: "#dedee2"
  surface-subtle: "#f0f0f0"
  icon-tile: "#f2f2f3"
  hairline: "#e8e8e8"
  hairline-strong: "#d4d4d4"
  ink: "#232326"
  ink-muted: "#56565b"
  ink-subtle: "#6a6a6e"
  primary: "#232326"
  on-primary: "#fafafa"
  focus-ring: "#3a3a3c"
  tooltip: "#3a3a3e"
  on-tooltip: "#f7f7f7"
  track: "#d9d9de"
  in-review: "#00b34a"
  in-review-text: "#005a25"
  in-review-bg: "#e6f7ed"
  in-review-border: "#8cddae"
  success: "#00b34a"
  success-text: "#005a25"
  success-bg: "#e6f7ed"
  success-border: "#8cddae"
  link-underline: "#8a8a90"
  selection: "#d9d9de"
  control-border: "#8a8a90"
  # Light semantic (base / text / background / border)
  in-progress: "#f2b200"
  in-progress-text: "#795900"
  in-progress-bg: "#fef7e6"
  in-progress-border: "#f9dc8c"
  in-progress-chart: "#f5b301"
  blocked: "#e5384a"
  blocked-text: "#721c25"
  blocked-bg: "#fcebed"
  blocked-border: "#f3a5ae"
  accent-text: "#ea580c"
  done: "#f97316"
  done-text: "#7c3a0b"
  done-bg: "#fef1e8"
  done-border: "#fcc096"
  done-readiness: "#f97316"
  urgent: "#e5303f"
  urgent-text: "#c01f2d"
  urgent-bg: "#fdeded"
  urgent-border: "#f6b9be"
  danger-fill: "#d92d3b"
  decision: "#6c5ce7"
  decision-text: "#362e74"
  decision-bg: "#f0effd"
  decision-border: "#bdb6f4"
  todo: "#2f7df6"
  todo-text: "#183e7b"
  todo-bg: "#eaf2fe"
  todo-border: "#a1c4fb"
  info: "#25b7e0"
  info-text: "#0e5f78"
  info-bg: "#e6f6fb"
  info-border: "#9adaee"
  system: "#a78bfa"
  document: "#0f766e"
  document-bg: "#effaf8"
  document-border: "#b5e3dc"
  release: "#8b8b95"
  release-text: "#686876"
  release-bg: "#f6f6f7"
  release-border: "#dedee1"
  bar-opened: "#fdc49b"
  bar-completed: "#c4bffb"
  cancelled: "#8a8a90"
  # Dark neutrals
  sidebar-dark: "#0e0e0e"
  canvas-dark: "#121311"
  surface-dark: "#1a1b19"
  surface-hover-dark: "#2e2e2e"
  surface-selected-dark: "#404040"
  popover-dark: "#1f1f1f"
  hairline-dark: "#2d2e2a"
  hairline-strong-dark: "#4a4a4a"
  ink-dark: "#dee0d2"
  ink-muted-dark: "#a0a394"
  ink-subtle-dark: "#8b8b8b"
  primary-dark: "#c8c8c8"
  on-primary-dark: "#141414"
  focus-ring-dark: "#bdbdbd"
  tooltip-dark: "#2c2c2c"
  tooltip-border-dark: "#4a4a4a"
  track-dark: "#2d2e2a"
  in-review-dark: "#00c853"
  in-review-text-dark: "#66de98"
  in-review-bg-dark: "#143823"
  in-review-border-dark: "#105c2f"
  success-dark: "#00c853"
  success-text-dark: "#66de98"
  success-bg-dark: "#143823"
  success-border-dark: "#105c2f"
  link-underline-dark: "#7a7a7a"
  selection-dark: "#404040"
  control-border-dark: "#6e6e6e"
  # Dark semantic
  in-progress-dark: "#ffc53d"
  in-progress-text-dark: "#ffdc8b"
  in-progress-bg-dark: "#42381f"
  in-progress-border-dark: "#705a27"
  blocked-dark: "#ff5a6a"
  blocked-text-dark: "#ff9ca6"
  blocked-bg-dark: "#422528"
  blocked-border-dark: "#703238"
  done-dark: "#f58b2c"
  done-text-dark: "#fbab73"
  done-bg-dark: "#412918"
  done-border-dark: "#6e3b18"
  test-pass-dark: "#00c853"
  urgent-dark: "#f0404f"
  urgent-text-dark: "#ff6b76"
  urgent-bg-dark: "#331216"
  urgent-border-dark: "#6a1e26"
  danger-fill-dark: "#d42a38"
  decision-dark: "#7a6cf8"
  decision-text-dark: "#afa7fb"
  decision-bg-dark: "#2a2841"
  decision-border-dark: "#3e396e"
  todo-dark: "#4c8dff"
  todo-text-dark: "#9cc7ff"
  todo-bg-dark: "#253242"
  todo-border-dark: "#324d70"
  info-dark: "#3ccbea"
  info-text-dark: "#7fddf2"
  info-bg-dark: "#11313a"
  info-border-dark: "#1b5666"
  system-dark: "#b9a3f5"
  document-dark: "#5eead4"
  document-bg-dark: "#0d2a26"
  document-border-dark: "#1d5149"
  release-dark: "#9a9aa6"
  release-text-dark: "#b6b6bf"
  release-bg-dark: "#252528"
  release-border-dark: "#4e4e54"
  bar-opened-dark: "#eead89"
  bar-completed-dark: "#726dc4"
  cancelled-dark: "#6b6b6f"

typography:
  greeting:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.025em
  title:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: '"tnum"'
  label:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
  button:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: 12.5px
    fontWeight: 500
    lineHeight: 1
  metric:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 26px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.04em
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 11.5px
    fontWeight: 500
    lineHeight: 1.3

rounded:
  hair: 2px
  sm: 6px
  md: 7px
  lg: 12px
  card: 20px
  pill: 999px

spacing:
  xxs: 4px
  xs: 6px
  sm: 10px
  md: 14px
  lg: 16px
  xl: 24px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 30px
    padding: 0 12px
  button-primary-dark:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.on-primary-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 30px
    padding: 0 12px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 30px
  button-secondary-dark:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 30px
  button-subtle:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: 30px
  button-subtle-dark:
    backgroundColor: "{colors.surface-hover-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.md}"
    height: 30px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    height: 30px
  button-delete:
    backgroundColor: "{colors.danger-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: 30px
  button-delete-dark:
    backgroundColor: "{colors.urgent-bg-dark}"
    textColor: "{colors.urgent-text-dark}"
    rounded: "{rounded.md}"
    height: 30px
  button-disabled:
    backgroundColor: "#f0f0f1"
    textColor: "#a1a1a6"
    rounded: "{rounded.md}"
    height: 30px
  button-disabled-dark:
    backgroundColor: "#1f1f1f"
    textColor: "#5e5e5e"
    rounded: "{rounded.md}"
    height: 30px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: 14px 16px
  card-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.card}"
    padding: 14px 16px
  icon-tile:
    backgroundColor: "{colors.icon-tile}"
    rounded: 8px
    size: 28px
  icon-tile-dark:
    backgroundColor: "{colors.surface-hover-dark}"
    rounded: 8px
    size: 28px
  status-pill-in-progress:
    backgroundColor: "{colors.in-progress-bg}"
    textColor: "{colors.in-progress-text}"
    rounded: "{rounded.sm}"
  status-pill-in-progress-dark:
    backgroundColor: "{colors.in-progress-bg-dark}"
    textColor: "{colors.in-progress-text-dark}"
    rounded: "{rounded.sm}"
  status-pill-blocked:
    backgroundColor: "{colors.blocked-bg}"
    textColor: "{colors.blocked-text}"
    rounded: "{rounded.sm}"
  status-pill-blocked-dark:
    backgroundColor: "{colors.blocked-bg-dark}"
    textColor: "{colors.blocked-text-dark}"
    rounded: "{rounded.sm}"
  status-chip:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  status-chip-dark:
    backgroundColor: "{colors.surface-hover-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.sm}"
  list-row-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.ink}"
    height: 38px
  list-row-hover:
    backgroundColor: "{colors.surface-hover}"
    height: 38px
  tooltip:
    backgroundColor: "{colors.tooltip}"
    textColor: "{colors.on-tooltip}"
    rounded: "{rounded.sm}"
  tooltip-dark:
    backgroundColor: "{colors.tooltip-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.sm}"
  popover-dark:
    backgroundColor: "{colors.popover-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.lg}"
---

## Overview

Cantiara is a personal project operating system for one founder who already lives in Linear-class tools. The interface is **exact, quiet, durable**: neutral cool-gray surfaces, hairline borders, and type do the structural work, and color is spent only where it carries meaning — a status, an outcome, a Decision, a Release.

Both modes are first-class. Light mode is a cool white canvas (`{colors.canvas}` #f8f8f8) with white cards; dark mode is a near-black, neutral (never warm or brown) ladder from `{colors.sidebar-dark}` #0e0e0e through `{colors.canvas-dark}` #121311 to `{colors.surface-dark}` #1a1b19 cards. The dark ladder was chosen so cards separate clearly from the canvas while vivid status colors do not glow.

The palette is a small, fixed vocabulary. **One orange** (`{colors.done}` #f97316) is both the brand accent and the Done state, so orange always means "this has moved forward." Amber is In Progress, vivid green is In review and passed Tests, red is Blocked, Urgent and failed Tests, violet is Decision, blue is Todo and Capture, mint-teal is Document. Every pair that appears side by side is measured to stay distinguishable (OKLab ΔE ≥ 15). Under color-vision deficiency orange, green and red sit close, so status never relies on color alone: every status chip also carries its own glyph and fill style (see Status pill).

**Key Characteristics:**
- Neutral cool grays only; no warm blacks, no beige, no brown tints in any tinted background.
- Color = meaning. A colored element without a domain meaning is a defect.
- One orange: accent and Done share a hue; there is no second accent.
- Icon tiles are neutral; only the glyph carries color.
- Deltas and numbers are Geist Mono text with a trend icon, never a filled pill.
- Depth comes from the tonal surface ladder and hairlines; shadows appear only on floating layers.

## Colors

### Neutrals — light
- **Sidebar** (`{colors.sidebar}` #f3f3f3): app sidebar and page frame.
- **Canvas** (`{colors.canvas}` #f8f8f8): page background behind cards; list group headers.
- **Surface** (`{colors.surface}` #ffffff): cards, list body, detail panel, popovers.
- **Surface Hover** (`{colors.surface-hover}` #f4f4f5) and **Surface Selected** (`{colors.surface-selected}` #e8e8eb): list row hover and selection — kept a visible step apart.
- **Surface Subtle** (`{colors.surface-subtle}` #f0f0f0): subtle buttons, neutral status chip.
- **Icon Tile** (`{colors.icon-tile}` #f2f2f3): background of every card header icon tile.
- **Hairline** (`{colors.hairline}` #e8e8e8) / **Hairline Strong** (`{colors.hairline-strong}` #d4d4d4): card and divider borders (decorative, exempt from 3:1). **Control Border** (`{colors.control-border}` #8a8a90, 3.2:1 on canvas): the outline of inputs, selects, checkboxes, radios and the off switch track.
- **Ink** (`{colors.ink}` #232326), **Ink Muted** (`{colors.ink-muted}` #56565b), **Ink Subtle** (`{colors.ink-subtle}` #6a6a6e).

### Neutrals — dark
- **Sidebar** `{colors.sidebar-dark}` #0e0e0e → **Canvas** `{colors.canvas-dark}` #121311 → **Surface** `{colors.surface-dark}` #1a1b19 → **Selected** `{colors.surface-selected-dark}` #404040 → **Hover / Icon Tile / Subtle** `{colors.surface-hover-dark}` #2e2e2e.
- **Hairline** `{colors.hairline-dark}` #2d2e2a, **Hairline Strong** `{colors.hairline-strong-dark}` #4a4a4a (popover, dialog and tooltip edges), **Control Border** `{colors.control-border-dark}` #6e6e6e (control outlines, ≥3:1 on surface-dark and popover-dark).
- **Ink** `{colors.ink-dark}` #dee0d2, **Muted** `{colors.ink-muted-dark}` #a0a394, **Subtle** `{colors.ink-subtle-dark}` #8b8b8b.
- **Popover** `{colors.popover-dark}` #1f1f1f and **Tooltip** `{colors.tooltip-dark}` #2c2c2c sit one step above cards with `{colors.tooltip-border-dark}` borders.

### Semantic roles
Each role has a base (icons, dots, fills), a text step (AA on its background), a tinted background, and a border. Use the text step for any label; never set text in the base color.

| Role | Domain meaning | Light base / text | Dark base / text |
|---|---|---|---|
| In Progress | Work status | `#f2b200` / `#795900` | `#ffc53d` / `#ffdc8b` |
| Done = Accent | Work status, brand accent, Release progress, Readiness "Work done" | `#f97316` / `#7c3a0b` | `#f97316` / `#f58b2c` dark · `#fbab73` |
| Blocked | Work status (outline chip), blocked Work | `#e5384a` / `#721c25` | `#ff5a6a` / `#ff9ca6` |
| In review / Passed | Review status, passed Tests, positive delta | `#00b34a` / `#005a25` | `#00c853` / `#66de98` |
| Urgent | Priority, Bug, failed Tests, negative delta, destructive | `#e5303f` / `#c01f2d` | `#f0404f` / `#ff6b76` |
| Decision | Decision, "Completed" series, Decisions resolved | `#6c5ce7` / `#362e74` | `#7a6cf8` / `#afa7fb` |
| Todo | Todo status, Feature, Capture | `#2f7df6` / `#183e7b` | `#4c8dff` / `#9cc7ff` |
| Info | Live and healthy-neutral signals, Memory series, hint banners | `#25b7e0` / `#0e5f78` | `#3ccbea` / `#7fddf2` |
| System | Lavender categorical slot (System, 7th series only with marker and dash) | `#a78bfa` | `#b9a3f5` |
| Document | Document, Docs | `#0f766e` / `#0f766e` | `#5eead4` / `#5eead4` |
| Release | Release chip (neutral by design) | `#8b8b95` / `#686876` | `#9a9aa6` / `#b6b6bf` |
| Cancelled | Cancelled status | `#b2b2b7` | `#6b6b6f` |

### Data colors
- **Release progress** (sidebar Release card, Release stat, Release readiness "Work done"): Done = `{colors.done}` orange, In review = `{colors.in-review}` green, empty = `{colors.track}` / `{colors.track-dark}`; the segments are tall rounded pills. The same metric always uses this treatment.
- **Status distribution** lives only in the Work by status donut: In Progress `{colors.in-progress-chart}` (light) / `{colors.in-progress-dark}`, Blocked red, Todo blue, Done orange, In review green, Cancelled gray.
- **Weekly bars** are pastel pairs (`{colors.bar-opened}` / `{colors.bar-completed}`, dark `{colors.bar-opened-dark}` / `{colors.bar-completed-dark}`); the highlighted week uses full orange and violet. Never gray bars. Line charts draw Opened in ink and Completed in violet, with a dashed neutral Target line.
- **Ink + signal** progress bars (Readiness, Release hero): the completed run is ink (light) or white (dark) pills and only the leading edge takes the metric color (orange Work done, green Tests passing, violet Decisions resolved). The **Release hero** card follows the page mode (light: white card with ink pills, dark: `{colors.surface-dark}` card with white pills): large mono percentage, an "On track" In-review-tint chip with a dot, 24 tall pills (22px wide, 11px radius) with an orange leading edge, and Mon / Wed / Fri / Sun labels.
- **Test runs** cells: passed `{colors.success}` (dark `{colors.test-pass-dark}`), failed `{colors.urgent}`.

## Typography

### Font Family
- **Geist Sans (Variable)** (tabular numerals on): every interface label, title, and body run.
- **Geist Mono**: Work keys (LUMA-42), metric values, deltas, dates in data rows, Release versions, kbd hints. Mono marks data and measurement — never decoration.

### Hierarchy
| Token | Size / weight | Use |
|---|---|---|
| `{typography.greeting}` | 26px / 600, -0.025em | Workspace home greeting |
| `{typography.title}` | 14px / 600 | Detail panel title, dialog title |
| `{typography.body}` | 13px / 400, 1.45 | Default body and list titles |
| `{typography.label}` | 12px / 500 | Card headers, field labels, chips |
| `{typography.button}` | 12.5px / 500 | Buttons |
| `{typography.metric}` | 26px Geist Mono / 500, -0.04em | KPI values |
| `{typography.mono}` | 11.5px Geist Mono / 500 | Keys, deltas, meta |

### Principles
- Emphasis comes from weight and size, not color. Inline highlights ("ships in **8 days**") are ink at weight 600.
- All numeric data is tabular so values never shift as they change.

## Layout

### Spacing System
Base step 2px with working values 4 / 6 / 10 / 14 / 16 / 24px. Cards pad 14px 16px; card grids gap 10–12px. List rows are 38px high with 16px side padding.

### Density
Operate-mode density: compact rows, single-line chips, no decorative whitespace. Hierarchy comes from type and grouping, not from more cards.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | Canvas, no border | Page background, list group headers |
| 1 | Surface + 1px hairline | Cards, list, detail panel |
| 2 | Hover / Selected tone | Row hover, selected row, subtle controls |
| 3 | Popover/tooltip tone + hairline-strong border + soft shadow | Menus, selects, tooltips, dialogs |
| Focus | 2px `{colors.focus-ring}` / `{colors.focus-ring-dark}` outline, 2px offset | Every focusable control |

Shadows are reserved for level 3: light `0 12px 32px rgb(0 0 0 / .18)`, dark `0 16px 40px rgb(0 0 0 / .55)`. Cards never carry shadows.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.hair}` | 2px | Ticks, segments, bars |
| `{rounded.sm}` | 6px | Chips, status pills, tags, tooltips |
| `{rounded.md}` | 7px | Buttons, inputs |
| `{rounded.lg}` | 12px | Menus, popovers |
| `{rounded.card}` | 20px | Cards, dialogs, app frame |
| `{rounded.pill}` | 999px | Segmented toggles, Re-run, avatars |

## Components

### Buttons
- **Primary** (`button-primary`): dark fill `#232326` with white text in light mode; soft light fill `#c8c8c8` with `#141414` text and no border in dark mode (hover `#d6d6d6`, pressed `#b8b8b8`; the focus ring is offset by a dark gap so it reads against the light fill). At most one Primary per surface (e.g. New Work).
- **Secondary**: light — white with hairline-strong border; dark — transparent with hairline-strong border. The label identifies the control, so the border stays decorative (`hairline-strong`), not `control-border`.
- **Subtle**: tone fill, no border. **Ghost**: text only, ink-muted.
- **Delete**: light — solid `{colors.danger-fill}`; dark — urgent tint. Irreversible confirmations (Archive Project dialog) use solid red in both modes.
- **Disabled**: flat light-gray fill with faded text; never a lowered-opacity Primary.

### Cards & icon tiles
Cards are `{colors.surface}` with a 1px hairline and `{rounded.card}`. Every card header icon sits in a neutral 28px tile; the glyph takes the domain color (Work done orange, Cycle time amber, Test pass rate red, Open Decisions violet, Work opened ink, Release readiness orange, Test runs green). Cards without a domain meaning (Insights, Work by status) use an ink glyph. KPI cards carry no colored side rule.

### Status
- **Status pill** (In Progress, Blocked, Passed, Failed, Decision, Feature): role background + role border + role text, plus a glyph. Outcome states are solid (Done orange, Passed green, Failed red; dark ink text on the fill, white on light Failed), active states are tinted (In review, In Progress, Decision), Todo is dashed and Blocked is an outline, so no two states differ by hue alone.
- **Status chip** in the detail panel: neutral fill, ink text, colored status icon (the icon alone carries the state).
- **Tags** (Bug, Feature, Docs): outlined, no fill; a colored dot or text step marks the type.
- **Status icons** in lists: In Progress amber spinner arc, Blocked red slashed circle, Todo blue dashed circle, In review green eye, Done orange check, Passed green circled check, Decision violet diamond, Failed red cross.

### Data
- **Deltas**: Geist Mono text in the role text color plus a trend icon; no pill background.
- **Readiness ticks**: 40 cells, 2px gaps, `{rounded.hair}`; rows use orange (Work done), green (Tests passing), violet (Decisions resolved).

### Lists
Rows 38px; hover `{colors.surface-hover}`, selected `{colors.surface-selected}` with a 2px ink notch on the left edge. Group headers sit on the canvas tone with status icon, label, and count.

### Feedback
Inline alerts use a 10% role tint over the canvas, a 40% role border, and a role dot: success green, blocked red, warning amber, error red. Toasts are neutral surfaces.

### Browser surfaces
Text selection `{colors.selection}` / `{colors.selection-dark}`, caret in ink, thin scrollbars in hairline-strong tones, links in ink with a 1px `{colors.link-underline}` underline offset 3px.

## Do's and Don'ts

### Do
- Map every color to a glossary meaning before using it.
- Use the text step of a role for any colored label.
- Keep Release progress orange + green on a gray track everywhere it appears.
- Keep icon tiles neutral and color only the glyph.
- Validate any new categorical pair (ΔE ≥ 15 normal, ≥ 8 CVD) before shipping.
- Keep one Primary per surface.
- Hover (`{colors.surface-hover-dark}` #2e2e2e) and selected (`{colors.surface-selected-dark}` / `{colors.selection-dark}` #404040) rows carry a 2px left notch and a check on selected, so state does not depend on fill contrast alone.

### Don't
- Don't use warm blacks, brown-tinted backgrounds, beige, or pink tints.
- Don't introduce a second accent or use orange for emphasis that is not Done/accent.
- Don't fill tags, deltas, or icon tiles with color.
- Don't use gray for data bars or pale grays for meaningful light-mode states.
- Don't use purple chips or decorative gradients.
- Don't use a pure-white-filled Primary button in dark mode; the soft light fill is `#c8c8c8`.
- Don't set text in `{colors.accent-text}` (#ea580c, 3.35:1) below 18px or 14px bold, nor on a selected row; use ink text and keep the orange for dots, icons and bars.

## Responsive Behavior

- Breakpoints follow Tailwind defaults (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px); the app frame uses `.surface-frame` padding 20 → 32 → 40px.
- Interactive controls keep a 30px visual height on pointer devices and a ≥40px hit area on touch (padding or `::before` expansion, not a larger visual control).
- Colors and tokens do not change per breakpoint.

## Implementation

Target mapping for `packages/ui/src/styles/globals.css` (`:root` light, `.dark` dark), exposed as Tailwind colors through `@theme inline`. Not applied yet. Once applied, use utilities, never raw hex:

| Need | Utility |
|---|---|
| Page / card / popover | `bg-background`, `bg-card`, `bg-popover` |
| Ink levels | `text-foreground`, `text-muted-foreground`, `text-subtle-foreground` |
| Row hover / selected | `hover:bg-accent`, `bg-selected` |
| Icon tile | `bg-icon-tile` + glyph `text-done` / `text-blocked` … |
| Status pill | `bg-{role}-bg text-{role}-text border-{role}-border` |
| Status icon / dot / fill | `text-{role}` / `bg-{role}` |
| Release progress | `bg-done` (done), `bg-in-review`, `bg-track` |
| Charts | `chart-1` orange, `chart-2` violet, `chart-3` green, `chart-4` blue, `chart-5` amber |
| Card radius | `rounded-card` |
| Data text | `font-mono` (Geist Mono) |

Roles: `in-progress`, `blocked`, `done`, `in-review`, `success`, `urgent`, `decision`, `todo`, `document`, plus `release` and `cancelled` (base and text only).

## Iteration Guide
1. Name the glossary meaning first, then pick the role; if no role fits, the element stays neutral.
2. Reference tokens by name (`{colors.done-text}` here, `text-done-text` in code), not raw hex.
3. Check both modes; dark values are separate selections, not inversions.
4. Run the palette validator for any new adjacent color pair.
5. Add variants as new component entries rather than overriding existing ones.

## Known Gaps
- `packages/ui/src/styles/globals.css` still carries the previous grayscale tokens; the mapping above is not applied yet.
- Geist Sans and Geist Mono are not yet loaded by the app (no font package in the repository).
- Per-surface responsive layouts (card grid steps, detail panel placement) are owned by each surface spec, not this file.
- Source of truth for this palette: `.context/design-research/v69/` (theme `ember-indigo-6-tuned5`).
- Palette changes after v69 (approved in the Paper decision round): Dark Primary soft light fill, `control-border`, `success` / `in-review` / neutral `done` split, softer Dark hairlines and hover/selected steps, lighter track and link underline, Dark danger fill `#d42a38`. Danger button states are component states, not tokens: Light hover `#c52836` / pressed `#b32331`; Dark hover `#c42634` / pressed `#b32230`.
