# Çevrimiçi Web ve macOS İstemcisi

Kaynak: [`docs/workflow/03-web-macos-client/phase-context.md`](../../workflow/03-web-macos-client/phase-context.md)

## Problem Statement

Kurucu aynı ürünü online-only web uygulamasında ve imzalı macOS paketinde kullanmak ister. Bugün iskelet bir Vite web uygulaması ve Tauri sarmalayıcısıdır; bağlantı kesilince yazılmamış risk görünmez, paket imza/notarization/updater sözleşmesi yoktur, hata secret'siz destek referansı taşımaz ve masaüstünün ikinci bir yerel doğruluk kaynağı açmayacağı kanıtlanmamıştır. Operatör yedeği, AB bölge kullanıcı yüzeyi ve GitHub ile giriş bu sorunun parçası değildir.

## Solution

Web ve macOS Tauri aynı Hono/Bun backend'ini, Neon doğruluk kaynağını ve ürün sözleşmesini kullanır. Bağlantı kesilince yazma kuyruğa alınmaz; kurucu son başarılı kayıt zamanını ve yazılmamış riski görür. macOS paketi imzalanır ve noterlenir; Tauri Updater yalnız doğrulanmış imzalı çıktıyı uygular. Backend güncel ve bir önceki imzalı masaüstü API sözleşmesini 30 gün destekler. Başarısız ana akışta kullanıcı secret içermeyen destek referansı görür.

## User Stories

1. As a founder on the web, I want document reading, record creation, and planning changes to require an active internet connection, so that the product never pretends a local queue is a second Workspace.
2. As a founder whose connection drops, I want to see the last successful save time and that unsaved changes are at risk, so that I know what the server actually has.
3. As a founder who reconnects, I do not want pending writes to complete in secret, so that I choose what to save again rather than discovering a silent sync.
4. As a founder, I do not want a local working queue, offline cache, or automatic sync, so that Online-only çalışma is the only working model.
5. As a founder on macOS, I want a signed and notarized Tauri package of the same product, so that I can install a trusted desktop shell without a second backend.
6. As a founder on macOS, I want that package to use the same Hono/Bun backend and Neon source of truth as the web, so that the desktop is not a Rust data layer or a local database.
7. As a founder, I want the package to install cleanly on the current macOS major version and the previous two majors at the candidate’s acceptance date, so that the Ürün destek matrisi is honest.
8. As a founder, I do not want a Windows Tauri package, Linux package, PWA install, or self-host installer, so that the first native shell stays macOS Tauri.
9. As a founder, I want Tauri Updater to apply only an output whose signature verifies, so that a tampered package cannot replace my working app.
10. As a founder, I want a modified or invalidly signed update to be rejected without breaking the previously working version, so that a bad update is not a wipe.
11. As a founder, I do not want automatic rollback, so that the product does not invent a second updater policy; the previous signed installer stays downloadable for documented manual recovery.
12. As a founder on a desktop client older than the 30-day API window, I want an explicit update error before any unsafe write, so that an expired contract cannot mutate the Workspace.
13. As a founder on the current or previous signed desktop API, I want writes to keep working during that 30-day window, so that I am not forced to update the minute a new desktop ships.
14. As a founder hitting a failed main flow, I want a clear reason, a safe retry bound, and whether data was written, so that I can decide the next step without guessing.
15. As a founder (and as the operator helping myself), I want a support reference that contains no secret and no private content, so that I can look up the failure without leaking tokens or Workspace text.
16. As a founder, I do not want that support reference to open a pager, customer-support queue, or S1 alarm console, so that this feature stays the user-visible error contract.
17. As a founder, I want last-successful-save times formatted with Hesap locale and time zone, so that the empty state is readable without this feature owning preferences.
18. As a founder, I do not want documents, diagrams, or records stored in a synced project folder beside the app, so that [içeriğin yalnız veritabanında yaşaması](../../adr/0021-icerigi-yalniz-veritabaninda-tut.md) holds on desktop too.
19. As a founder, I do not want VS Code or Obsidian live sync, so that the desktop shell is not a file watcher.
20. As a founder, I do not want this feature to implement GitHub sign-in, session cookies, or Stronghold token storage policy, so that Account Access remains the identity owner while this shell hosts the session.
21. As a founder, I do not want an EU region picker or region-migration UI, so that Avrupa Birliği veri bölgesi stays a deployment gate, not a preference.
22. As a founder, I do not want this feature to implement operator backup, RPO/RTO, or restore replay, so that those remain the last-gate operator feature.
23. As a founder using only a keyboard or a screen reader, I want to understand the offline empty state, the update-required error, and the support reference, so that platform acceptance is possible without a pointer.
24. As a founder, I want English UI copy for the empty state, update error, and support reference, so that product language stays English.
25. As a visitor on a Dış yüzey, I do not want the founder desktop updater or Workspace empty state, so that public pages are not the Client Shell.

## Implementation Decisions

- **Owning documents.** Delivery behavior for this feature lives in this spec. Content must not grow a second local source: [ADR-0021](../../adr/0021-icerigi-yalniz-veritabaninda-tut.md). Session minting stays Account Access. No new ADR.
- **Glossary.** Use Online-only çalışma, Hesap, Çalışma Alanı, Ürün destek matrisi, Denetim kaydı (errors may correlate, but the support reference is not a Denetim kaydı UI). Do not introduce local-first, offline-first, sync queue, User Workspace, or a desktop database. Operasyonel yedek and Avrupa Birliği veri bölgesi are neighboring terms this feature must not implement.
- **Client Shell module.** One product-facing shell for web and macOS: connection state, last successful save time, unsaved-risk flag, update-required stop, and secret-free support reference. Domain writes still go through later feature seams; this module is the host that refuses unsafe work when offline or when the desktop API window has expired.
- **Online-only.** Document read/edit, record create, and planning changes require connectivity. On disconnect: show last successful save time; show `Unsaved changes may be lost` only when the unsaved-risk flag is set. Do not enqueue, cache for write, or auto-sync on reconnect. Reconnect does not replay a hidden queue. Format times with Hesap preferences when that record exists; do not own the preference schema.
- **macOS package.** Signed with the platform certificate and notarized. Same backend and product contract as web. Tauri backend is not moved to a Rust data layer. Supported majors: current macOS major at the candidate date plus the previous two; exact versions freeze on the Ürün destek matrisi. This candidate (frozen 2026-08-26): macOS 26, macOS 15, macOS 14. Windows/self-host/PWA out.
- **Updater.** Tauri Updater applies only signature-verified output. Invalid or modified packages are rejected; the previously working version stays. No automatic rollback. Previous signed installer remains downloadable for documented manual recovery. Distribute desktop artifacts via GitHub Releases as in the stack.
- **30-day API window.** After a new macOS desktop ships, the backend supports the current and previous signed desktop API contracts for 30 days. A client outside that window stops with an explicit update error before any unsafe write.
- **Support reference.** Every failed main flow shows a clear reason, a safe retry bound, whether data was written, and a server-issued support reference with no secret and no private content. The toast stays until the founder dismisses it or chooses Retry, so Retry and the Support reference remain reachable. This is not a pager, S1 alarm, or operator runbook. Better Stack remains the operator sink; the user never sees tokens, emails-as-secrets, or Workspace bodies.
- **English UI labels.** First user-visible copy uses: `You’re offline`, `Last saved`, `Unsaved changes may be lost`, `Update required`, `Support reference`, `Retry`. That spec English is the name in code and in the interface.
- **Stack.** React + Vite + TanStack Router web; Tauri + Opener/Deep Link/Single Instance/Stronghold/Updater plugins; Hono/Bun API; Neon/PostgreSQL; GitHub Releases; Better Stack/Evlog for operator logs. Do not add Electron, a local DB, PWA, or a second authenticity store.

## Testing Decisions

- **What a good test is.** Tests observe Client Shell through its public interface: disconnect shows last save and refuses writes without a queue; `Unsaved changes may be lost` appears only when the unsaved-risk flag is set and is omitted after a successful save that left nothing unsaved; reconnect does not flush a hidden queue; updater accepts a valid signature and rejects an invalid one without breaking the previous app; a client past the 30-day window is stopped before a write; a failed flow returns a support reference that contains no token, session, or private field; the failed-flow toast stays until dismissed so Retry remains reachable. They do not assert Tauri internals, Railway topology, or Better Stack payloads. Expected values are product rules (no queue, flag-driven unsaved-risk copy, 30-day window, secret-free reference, toast stays until dismissed).
- **Seam (one).** Client Shell — the product-facing web/macOS host used by every later feature for connectivity, packaging, updater, and user-visible errors. Playwright/platform matrix observes the same seam. Signing certificates in CI may use a test double; the contract (reject invalid signature, keep previous version) is still asserted. The macOS package contract at this seam rejects an unsigned skeleton, a missing notarization, a local/Rust data layer, Windows/Linux/PWA/self-host, and a support matrix that is not the frozen 26/15/14 released majors.
- **Modules under test.** Client Shell only. Account Access, operator backup, EU region, GitHub App, and visitor Dış yüzey are counterparts (“this control is absent / this write is unauthorized”), not in-suite features.
- **Prior art.** Almost no Vitest/Playwright yet. First contract tests live at this seam. Evidence environment is [platform kabulü](../../prd/16-product-acceptance.md#platform-kabulu) plus the online-only empty state in that section. Cloud tests must not use production sessions, tokens, or private content.
- **Required counterparts.** No local queue after disconnect; no second local DB; no Windows package; no EU region UI; no GitHub sign-in UI here; support reference has no secret; expired desktop API cannot write.

## Out of Scope

- Yerel-first, offline-first, senkron kuyruğu, cihaz-yerel veritabanı, VS Code/Obsidian canlı senkron.
- Windows/Linux Tauri, PWA, self-host operatör yüzeyi.
- GitHub ile giriş, oturum çerezi, Stronghold’a token yazma politikası (workflow 01).
- Operasyonel yedek, RPO/RTO, restore replay, S1/S2 alarm, pager, 7/24 nöbet (workflow 85).
- Avrupa Birliği veri bölgesi kullanıcı yüzeyi veya bölge taşıma.
- Hesap tercih şeması (workflow 02 yalnızca biçim tüketilir).

## Further Notes

- **Orient.** Glossary: Online-only çalışma, Ürün destek matrisi, Hesap, Çalışma Alanı. Owning spec: this file. ADRs in play: 0021 (content in the database only). Session stays Account Access (workflow 01).
- **Acceptance.** Bind to [platform kabulü](../../prd/16-product-acceptance.md#platform-kabulu) (signed/notarized install matrix, updater signature, previous installer manual recovery, online-only empty state, web–Tauri same backend, 30-day API window) and to the observability rule that a failed main flow shows reason, retry bound, write outcome, and secret-free support reference. Browser matrix in the same section is this shell’s web side. Negative bounds (no offline queue, no second local source, no Windows, no EU UI) are 19-class counterparts.
- **Consumers.** Every later writing feature must fail through this shell when offline or when the desktop API has expired; they do not grow their own queues. Account Access hosts sign-in inside this shell but owns the session contract. Preferences format the last-saved timestamp.
- **Scaffold debt.** The existing Tauri wrapper and unsigned dev package are not product behavior; signing, notarization, updater, online-only empty state, and support reference are this feature’s correction.
