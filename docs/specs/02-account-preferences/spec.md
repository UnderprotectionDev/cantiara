# Hesap Tercihleri

Kaynak: [`docs/workflow/02-account-preferences/phase-context.md`](../../workflow/02-account-preferences/phase-context.md)

## Problem Statement

Kurucu locale, saat dilimi, tarih biçimi, haftanın ilk günü ve açık/koyu görünümü bütün Projelerde ortak yönetmek ister. Bugün iskelet görünümü `next-themes` ile cihazda `localStorage` anahtarında tutar, `System` seçeneği sunar ve Hesap kaydı yoktur; locale/saat dilimi ürün varsayılanı da tarayıcı önerisi de kaydedilmez. Arayüz çevirisi, Projeye özel locale, Bitiriş efekti teması ve tasarım token sistemi bu sorunun parçası değildir.

## Solution

Hesap profil tercihleri locale, saat dilimi, tarih biçimi, haftanın ilk günü ve `Light`/`Dark` görünümü Hesap kapsamında tutar ve bütün Projelerde aynı uygulanır. İlk girişte tarayıcıdan önerilen locale ve saat dilimi gösterilir; ancak açık kayıtla uygulanır. Kayıt yokken varsayılanlar locale `en-GB`, saat dilimi `Europe/Istanbul` ve haftanın ilk günü `Monday`dır. Arayüz İngilizce kalır; locale yalnız tarih, saat ve sayı biçimini değiştirir. İskeletteki cihaz-yerel tema anahtarı ve `System` seçeneği bu Hesap kaydıyla değişir.

## User Stories

1. As a founder, I want locale, time zone, date format, first day of week, and appearance stored on my Hesap, so that every Project shows the same personal formatting and Light/Dark surface.
2. As a founder opening preferences for the first time, I want the product defaults to be locale `en-GB`, time zone `Europe/Istanbul`, and first day `Monday`, so that I am not silently localized to the browser before I choose.
3. As a founder on first login, I want the browser-suggested locale and time zone shown as a suggestion, so that I can accept a familiar format without the product guessing my identity from the device.
4. As a founder seeing that suggestion, I want it applied only when I explicitly save, so that dismissing the screen leaves the product defaults in place.
5. As a founder who saved a locale, I want dates, times, and numbers to follow that locale, so that calendars, timestamps, and counts are readable in my format.
6. As a founder who saved a date format distinct from the locale default, I want that date format used for date display, so that locale is not the only way to choose how a date is written.
7. As a founder who saved a first day of week, I want week grids and week boundaries to start on that day, so that a calendar week matches how I plan.
8. As a founder who changes time zone, I want future date entry, calendar day boundaries, and the display of historical events to follow the new zone, so that “today” and “this week” move with me.
9. As a founder who changes time zone, I do not want stored exact timestamps rewritten, so that history and other founders’ later restore/export stay truthful.
10. As a founder, I want the user interface to stay English after I change locale, so that navigation, actions, statuses, and system messages are not translated.
11. As a founder, I do not want locale to translate my Work titles, Document bodies, or other user content, so that my words stay as I wrote them.
12. As a founder, I do not want a language preference control, so that the first product does not pretend the UI is translatable.
13. As a founder, I want Appearance as `Light` or `Dark` on the Hesap, so that web and macOS Tauri share one look instead of a device-local theme.
14. As a founder who saved Appearance, I want that value to replace the scaffold theme provider’s `localStorage` key and its `System` option, so that OS-follow is not a second product preference.
15. As a founder, I want preferences to apply across all Projects in my single Çalışma Alanı, so that I do not reconfigure format per Project.
16. As a founder, I do not want a per-Project locale or appearance override, so that Hesap remains the only formatting scope.
17. As a founder, I do not want this surface to enable, theme, or palette a Bitiriş efekti, so that completion-effect taste stays the later Bitiriş efekti feature.
18. As a founder, I do not want Appearance treated as a design-token or theme-system product, so that Light/Dark is a readability preference rather than a branding kit.
19. As a founder using only a keyboard or a screen reader, I want to inspect suggested values, change each preference, save, and see the new date/number/week/appearance result, so that the English product-language journey is possible without a pointer.
20. As a founder on web and on macOS Tauri, I want the same saved Hesap preferences, so that the shell is not a second profile.
21. As a founder, I want English UI labels for the preferences surface, so that the product language stays English while locale only formats values.
22. As a founder, I do not want Turkish UI copy on this surface, so that PRD discussion language is not shipped as the interface.
23. As a visitor on a Dış yüzey, I do not want founder Hesap preferences to become a public language or theme control, so that sharing cannot inherit Workspace profile.
24. As a founder, I do not want this feature to own sign-in, session revoke, or `Confirm GitHub Identity`, so that account access stays the identity feature.
25. As a founder, I want unsaved preference edits to follow the online-only rule of the client shell (last successful save time and unsaved risk, no local queue), so that a dropped connection cannot invent a device-local profile.
26. As a founder who changes locale, time zone, date format, first day of week, or appearance, I do not want stored keys, statuses, field values, or other record meanings rewritten, so that the preference personalizes readability and does not change record semantics.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Hesap profil tercihleri](../../prd/03-account-platform-operations.md#hesap-profil-tercihleri). Hesap vs Çalışma Alanı vs Proje ownership is [kapsam ve sahiplik](../../prd/02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik). English UI vs locale-as-format is [kapsam dili](../../prd/01-product-vision-and-scope.md#kapsam-dili). No ADR: nothing surprising remains undecided. Bitiriş efekti enable/theme/palette is owned by [Bitiriş efektleri](../../prd/06-work-management-and-planning.md#bitiris-efektleri) (workflow 23), not this surface.
- **Glossary.** Use Hesap, Çalışma Alanı, Proje, Online-only çalışma. Do not introduce User Workspace, profile project, organization, team, i18n language pack, or per-Project locale. Appearance is a Hesap preference, not a theme system. Bitiriş efekti is a different Hesap-scoped experimental preference owned elsewhere.
- **Preferences module.** One Hesap-scoped preference record: locale, time zone, date format, first day of week, appearance (`Light` or `Dark`). Reads and saves go through the product API the web app and Tauri shell already share. There is no second device-local profile store after save.
- **Defaults and first-login suggestion.** Until an explicit save, locale is `en-GB`, time zone `Europe/Istanbul`, first day of week `Monday`. On first login the browser-suggested locale and time zone are shown as a suggestion only. Applying them requires the same save command as any later edit. Closing without save keeps the product defaults.
- **Format semantics.** Locale changes date, time, and number display. Date format is its own saved field; if the founder has not chosen one, display follows the locale. First day of week changes week grids and week boundaries, not stored timestamps. Time zone changes future date entry, calendar day boundaries, and how historical events are shown; it must not rewrite stored exact timestamps. Preference never rewrites stored record semantics — keys, statuses, field values, and identities stay as stored; only how they are shown changes.
- **UI language.** No language preference control. Navigation, actions, statuses, validation, and system messages stay English. User content is not translated. No i18n/translation runtime is added; date-fns and React DayPicker format values from the Hesap locale.
- **Appearance.** Hesap appearance is `Light` or `Dark` only. Replacing the scaffold theme provider and header mode toggle is in-scope product correction: the `localStorage` theme key and the `System` option are not product behavior once this feature ships. Web and Tauri consume the same Hesap value. This is not a design-token, Project color, or white-label theme.
- **English UI labels.** First user-visible copy uses: `Preferences`, `Locale`, `Time zone`, `Date format`, `First day of week`, `Appearance`, `Light`, `Dark`, `Save`, `Use suggested locale and time zone`. Add missing labels to the PRD term table in the same change that first shows them. No Turkish UI.
- **Online-only.** Preference saves are ordinary product writes. Disconnected editing shows last successful save time and unsaved risk; there is no local preference queue. The empty-state chrome itself is the client-shell feature; this feature only must not invent a device cache for profile.
- **Stack.** React, TanStack Form, Zod, date-fns, React DayPicker, oRPC, Prisma/PostgreSQL, Better Auth session as caller identity. Do not add an i18n framework. `next-themes` may remain a class applicator only if appearance source of truth is the Hesap record.

## Testing Decisions

- **What a good test is.** Tests observe Account Preferences through its public interface: read defaults, show first-login suggestion without applying it, save locale/time zone/date format/first day/appearance, format a known timestamp and number, move a week boundary, refuse to rewrite stored timestamps, keys, statuses, or field values, keep English UI copy under a non-English locale, and apply Light/Dark from the Hesap record rather than a device key. They do not assert Prisma row shapes, `localStorage` internals, or date-fns locale-pack file names. Expected values are product rules (`en-GB` / `Europe/Istanbul` / `Monday`, suggestion-not-applied, no UI translation).
- **Seam (one).** Account Preferences — the product-facing Hesap preference interface used by the web app, the Tauri shell, and later surfaces that format dates or choose Light/Dark. Playwright for the English product-language journey is the same seam observed through the UI, not a second module.
- **Modules under test.** Account Preferences only. Bitiriş efekti, Workspace overview, Project shell, and visitor Dış yüzey are not in this suite except as “this control is absent / this value is not read from Hesap” counterparts.
- **Prior art.** The repository has almost no Vitest/Playwright suite yet. First contract tests live at this seam. Synthetic fixture is the evidence environment for [İngilizce ürün dili](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Cloud tests must not use production sessions or private user content.
- **Required counterparts.** No language preference control; locale `tr-TR` (or any non-English locale) does not change chrome copy or user content; suggestion without save leaves defaults; time zone change does not mutate stored timestamps; locale or date-format change does not rewrite stored numbers, dates, keys, or statuses; `System` appearance is not a saved Hesap value; Bitiriş efekti theme/palette controls are absent; per-Project locale is absent.

## Out of Scope

- Arayüz çevirisi, i18n runtime, RTL, dil tercihi.
- Projeye özel locale, saat dilimi veya görünüm.
- Bitiriş efekti etkinleştirme, tema, palet, önizleme (workflow 23).
- Proje rengi, logo dışında white-label, özel CSS, font veya tasarım token sistemi.
- Hesap girişi, oturum, `Confirm GitHub Identity`.
- Online-only boş durum kromu, Tauri imza/updater, destek referansı (workflow 03).
- Ziyaretçi Dış yüzey teması veya herkese açık dil.

## Further Notes

- **Orient.** Glossary: Hesap, Çalışma Alanı, Online-only çalışma. Owning PRD: `docs/prd/03-account-platform-operations.md` (Hesap profil tercihleri). ADRs in play: none. Related but not owning: PRD 01 (English UI), PRD 02 (Hesap ownership of profile), PRD 06 (Bitiriş efekti), PRD 15 (locale in the quality matrix, not a translation program), PRD 16 (İngilizce ürün dili), PRD 19 (no translatable UI, no offline).
- **Acceptance.** Bind this feature to [İngilizce ürün dili](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (synthetic fixture: locale matrix, no language preference, UI stays English, user content untranslated). Closed accessibility for this surface rides that journey plus the quality matrix (Light/Dark, 200% zoom, English chrome). Negative bounds (no i18n, no per-Project locale, no Bitiriş efekti here) are 19-class counterparts on that journey.
- **Consumers.** Workflow `03-web-macos-client` formats empty-state times with this locale/zone. Workflow `23-completion-effects` reads a different Hesap experimental preference and must not store theme on this record’s Appearance field. Calendar, reminder, and overview features consume format; they do not own the preference.
- **Scaffold debt.** Replacing the theme provider / mode toggle (`Light`/`Dark`/`System` + `localStorage`) with Hesap-scoped `Light`/`Dark` is in-scope product correction for this feature, not a separate cleanup epic.
