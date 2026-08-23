# Bitiriş Efektleri

Kaynak: [`docs/workflow/23-completion-effects/phase-context.md`](../../workflow/23-completion-effects/phase-context.md)

## Problem Statement

Kurucu bir İşi kendi kararıyla Tamamlandı yaptığında bunu hissedilir bir kutlama ile görmek ister; otomasyon, Vazgeçildi veya dış olayın konfeti basmasını istemez. Lisanslı karakter, kullanıcı yüklemeli efekt ve açık uçlu tema pazarı ürünü hak ve güvenlik yüküne sokar. Azaltılmış hareket başarı geri bildirimini de kaldırmamalıdır. Hesap görünüm tercihi (locale, açık/koyu) efekt kataloğunun sahibi değildir.

## Solution

Bitiriş efekti varsayılan kapalı, Hesap düzeyinde açıkça etkinleştirilen deneysel kişisel geri bildirimdir. Kapalı katalog: `Calm`, `Weave`, `Arc`, `Nova`; her temada tam dört palet. Örnekler durağandır; hareket yalnız `Preview` ile başlar. Efekt yalnız görünür istemcide başlatılan kapatmanın sunucuda kalıcı `Completed` kabulünden sonra bir kez oynar. `Work completed` bildirimi hareketsiz de kalır. Katalog özgün birinci taraf varlıklarla sınırlıdır ([ADR-0017](../../adr/0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md)).

## User Stories

1. As a founder, I want completion effects off by default, so that a new Hesap is not surprising or distracting.
2. As a founder, I want to enable them explicitly at Hesap level, so that the choice applies to every Project until I change it.
3. As a founder, I want to pick one theme among `Calm`, `Weave`, `Arc`, and `Nova`, so that the catalog stays closed.
4. As a founder, I want exactly four palettes per theme that already passed design, contrast, and motion-safety review, so that I cannot edit particles, speed, density, duration, or color freely.
5. As a founder, I want theme and palette samples to be static, so that browsing the picker does not start motion.
6. As a founder, I want motion only from an explicit `Preview` action, so that preview does not change Work status, the success notification, or the 30-second wait.
7. As a founder, I do not want random theme pick, Project override, or per-event theme, so that the Hesap choice is the only selector.
8. As a founder, I want unnamed catalog values rejected, so that a palette cannot ship before its name is added to the PRD section.
9. As a founder completing Work by an explicit close that the server accepts as `Completed`, I want the effect to play once on that visible client, so that celebration matches User-initiated Work Success.
10. As a founder, I want the effect not to start during the close step, the close check, or an optimistic client status, so that a rejected write cannot celebrate.
11. As a founder, I want rejected, conflicting, timed-out, or undone writes to play nothing, so that failure is not success.
12. As a founder retrying the same idempotent request, refreshing, going back, or using a second tab/device, I want the effect not to replay, so that sync is not a firework.
13. As a founder, I want `Abandoned`, checklist completion, PR merge, the prepared PR-merge auto-complete rule, external-run reconcile, closing Daily Focus, closing a Focus Period, reaching a Milestone, completing a Project or stage, publishing a Project Release, and other record terminals not to trigger the effect, so that there is no general success-event engine.
14. As a founder, I want every User-initiated Work Success to keep a `Work completed` result notice for 10 seconds with a `Reopen` action that starts the normal reopen confirmation, so that turning the effect off cannot hide success.
15. As a founder, I want that notice not to mint a notification-center attention record, so that celebration is not `Needs Action`.
16. As a founder with Reduce Motion (OS or browser), I want the effect and motion preview unconditionally suppressed, so that an in-app preference cannot override it.
17. As a founder with Reduce Motion, I want the notice text, visible status/icon, and polite screen-reader announcement kept, and preview replaced by a static last frame plus a short motion description, so that success remains perceivable.
18. As a founder, I want the effect to produce no sound, haptics, strobe, or flashing that fails WCAG flash, so that motion safety is this feature, not a later card.
19. As a founder on a device that cannot hold the drawing budget, I want the decorative layer skipped while `Work completed` stays equally fast and correct, so that performance cannot delay the mutation or the next input.
20. As a founder, I want the layer around the Work or card to last at most 1.2 seconds, not steal focus, not capture input, not block scroll/navigation, and to clear when the surface changes, so that web and Tauri match ([etkileşim tutarlılığı](../../prd/15-product-quality.md#etkilesim-tutarliligi)).
21. As a founder, I want a 30-second client-only wait after a full effect starts, during which later eligible successes get only the base notice, so that the server never stores played/seen/wait state.
22. As a founder reopening and completing the same Work again, I want a new eligible event (still under trigger and wait rules), so that history does not replay old completions.
23. As a founder, I do not want a separate stop control while an effect plays; I turn the feature off in Hesap settings, so that there is no in-flight panic button product.
24. As a founder, I do not want licensed characters, third-party universes, or founder-uploaded visuals/animation/audio, so that ADR-0017 remains the trust model.
25. As a founder, I do not want locale/light-dark appearance settings to own this catalog, so that account-preferences (02) stays locale, timezone, and appearance — it may later host a row, but enablement/theme/palette behavior lives here.
26. As a founder, I do not want this picker treated as a product theme, a design-token system, or a Moodboard palette, so that completion taste stays a closed first-party effect catalog.
27. As a founder, I do not want satisfaction surveys or play analytics as a release gate or as a product metric pipeline, so that perceived value stays a linked Decision record outside the gate.
28. As a founder using only a keyboard or a screen reader, I want to enable the feature, preview statically under Reduce Motion, complete Work, and hear `Work completed`, so that Bitiriş efekti is testable.
29. As a founder, I want English UI for `Calm`, `Weave`, `Arc`, `Nova`, `Preview`, `Work completed`, and `Reopen`, so that the product language stays English.
30. As a founder on dark appearance or 200% zoom, I want the notice still readable independent of the effect layer, so that PRD 15's matrix holds.
31. As a founder waiting 30 seconds after an effect, I want a second eligible completion on the same client to play again only after the wait, so that the debounce is observable.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Bitiriş efektleri](../../prd/06-work-management-and-planning.md#bitiris-efektleri). Catalog trust: [ADR-0017](../../adr/0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md). Hesap ownership of the preference: [kapsam ve sahiplik](../../prd/02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik) and [Hesap profil tercihleri](../../prd/03-account-platform-operations.md#hesap-profil-tercihleri) (profil yüzeyi does not own catalog, Project theme, per-event pick, or play history). Quality: [performans](../../prd/15-product-quality.md#performans-butcesi), [erişilebilirlik](../../prd/15-product-quality.md#erisilebilirlik), [etkileşim tutarlılığı](../../prd/15-product-quality.md#etkilesim-tutarliligi). Term: [Kullanıcı başlatmalı İş başarısı](../../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) = `User-initiated Work Success`. Journey: [Bitiriş efekti](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). No new ADR.
- **Glossary.** Use Kullanıcı başlatmalı İş başarısı, Bitiriş efekti, Hesap, Kapanış sonucu. Avoid: confetti-as-status, licensed character, user-uploaded effect, general success engine, play analytics, product-theme-as-effect, Moodboard palette.
- **Catalog.** Default off; experimental; Hesap-scoped enablement, one theme, one palette for all Projects. Themes: `Calm` (quiet default), `Weave` (abstract bind/weave), `Arc` (light/arc), `Nova` (cosmic energy). Each theme has exactly four palettes. Palette names are added to the PRD section when the visual prototype exists; a value not named in the catalog cannot be stored or played. No random, Project override, per-event pick, or free parameter editor. Samples static; motion only via `Preview`. Preview does not affect status, notice, or the 30s wait. The picker is not a product theme, design-token system, or Moodboard palette.
- **Original first-party only.** Silent original assets. No licensed characters/universes. No user upload of visual/animation/audio. Expanding the catalog along those two paths requires replacing ADR-0017, not a catalog PR.
- **Trigger.** Single trigger: founder starts close on a visible client and the server persists kapanış sonucu `Completed` (`UI: Completed`). Do not start on the close dialog, close check, or optimistic UI. No play on reject/conflict/timeout/undo. Idempotent retry, refresh, history back, second tab/device, or background sync do not replay. Reopen then complete is a new event subject to the same rules. Server stores no played/delivered/wait/seen record per Work.
- **Non-triggers.** `Abandoned`; checklist item completion; PR merge; prepared PR-merge rule auto-`Completed`; external-run reconcile; close Daily Focus; Focus Period close; Milestone reached; Project or stage complete; Project Release publish; other types' terminals. No general `success event → effect` engine in this slice.
- **Base feedback.** Every User-initiated Work Success keeps `Work completed` visible 10 seconds then auto-dismisses. `Reopen` starts the normal reopen confirmation; it does not silently clear the close result. Effect off/suppressed does not remove this notice and does not create a notification-center item. Visual and SR presentation follow PRD 15.
- **Reduce Motion.** OS/browser Reduce Motion unconditionally suppresses the effect and motion preview; in-app preference cannot override. Keep notice text, status/icon, and polite SR announcement. Preview becomes static last frame + short motion description. No sound, haptics, strobe, vibrating brightness, or flashing that trips flash thresholds.
- **Performance and interaction.** Effect must not add delay to single-record mutation confirmation, visible status, or next input. If the drawing budget cannot be held, skip the decorative layer; keep `Work completed` at the same speed and correctness. Layer ≤ 1.2s around the Work/card; no focus steal, no input capture, no scroll/nav block; clear on surface change. Same visible result on web and macOS Tauri; renderer internals may differ. Verify dark/light, 200% zoom, long localized (English) strings.
- **30s wait.** Client-local, temporary. While an effect plays, later eligible successes get only base feedback; after a full effect starts, no new effect for 30s. Not stored on the server.
- **No in-flight stop control.** Founder disables the feature from Hesap settings.
- **Not workflow 02's surface.** Locale, timezone, and light/dark stay account-preferences. This feature owns enablement, theme, palette, preview, and play rules. A preferences row may deep-link here later; 02 must not become catalog owner.
- **Research vs gate.** Trigger, safety, a11y, and performance are release gates. Perceived satisfaction, repeat fatigue, and value are a source-linked Decision record on a volunteer dogfooding build — not a gate, not auto-removal, not a play-analytics product.
- **English UI labels.** `Calm`, `Weave`, `Arc`, `Nova`, `Preview`, `Work completed`, `Reopen`, `User-initiated Work Success` as the term-table concept. Palette names when prototyped. Add missing labels in the same change.
- **Stack.** Web + Tauri, no new animation SDK that implies licensed packs. Respect existing a11y stack (`@axe-core/playwright` on screens).

## Testing Decisions

- **What a good test is.** Tests observe Completion Effects through its public interface: settings/preview, trigger matrix, idempotency/multi-tab, Reduce Motion, 1.2s/10s/30s timing, allow-list catalog, performance fallback. They do not assert canvas frame internals or “felt delight.”
- **Seam (one).** Completion Effects — the product-facing Hesap catalog, trigger, and success-notice interface. Work close is an input event at this seam, not a second module. Playwright for Bitiriş efekti is this seam through the UI (web and Tauri preference parity).
- **Modules under test.** Completion Effects only. Automation close, GitHub, notification center, and account locale/appearance are counterparts.
- **Prior art.** Contract tests at this seam with a close-acceptance double. Evidence: [Bitiriş efekti](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Sentetik fixture`) — settings/preview E2E, trigger/exclude matrix, 1.2s and 10s notice/reopen timing, error/idempotency/multi-tab and 30s wait, catalog allow-list, Reduce Motion/flash/focus/input, low-performance fallback, light/dark and 200% zoom. Qualitative Decision record is outside the release gate.
- **Required counterparts.** Abandoned/automation/GitHub do not play; Reduce Motion keeps notice; unnamed palette rejected; second tab no replay; mutation p95 not regressed by the layer; product theme / design-token / Moodboard palette controls are absent.

## Out of Scope

- Vazgeçildi, otomasyon veya GitHub olayıyla efekt tetikleme.
- Açık uçlu tema pazarı, lisanslı karakter, kullanıcı yüklemeli asset, sürekli arka plan animasyonu.
- Hareketi kapatınca kapanış geribildirimini de kaldırma.
- Hareket güvenliğini ayrı teslim kartı sayma.
- Locale/açık-koyu yüzeyini bu kataloğun sahibi yapmak (02).
- Ürün teması, tasarım tokenı veya Moodboard paleti sayma.
- Bildirim merkezi kaydı; efekt oynatma analitiği; tatmin anketini release kapısı yapmak.

## Further Notes

- **Orient.** Glossary: Kullanıcı başlatmalı İş başarısı, Bitiriş efekti, Hesap, Kapanış sonucu. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#bitiris-efektleri`). ADRs: 0017. Related: PRD 02/03 Hesap preference ownership, PRD 15 a11y/perf/interaction, PRD 16 Bitiriş efekti, PRD 19 (no licensed/user packs implied by ADR).
- **Acceptance.** Bind to [Bitiriş efekti](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Gate vs research split is normative there.
- **Palette names.** Four slots per theme are in-scope now; concrete names land in PRD 06 in the same change that first shows them — this spec does not invent unofficial palette names.
