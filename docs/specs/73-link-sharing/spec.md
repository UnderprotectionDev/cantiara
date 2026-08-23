# Bağlantıyla Sınırlı Paylaşım

Kaynak: [`docs/workflow/73-link-sharing/phase-context.md`](../../workflow/73-link-sharing/phase-context.md)

## Problem Statement

Kurucu seçili bir kaydı kimlik vermeden salt okunur göstermek ister. Bearer bağlantı, isteğe bağlı parola ve süre gerekir; süre dolumu ile terminal iptal karışmamalıdır. Önizlenmeyen ilişki, secret, paylaşım token'ı veya parola kapsama sızmamalıdır. Ziyaretçi kurucu oturumunu, paleti veya aramayı devralmamalıdır. Cache veya CDN iptali ezmemelidir. YouTube kartı sayfa açılışında üçüncü tarafa istek atmamalıdır. Wiki yayını ve Build in Public bu bağlantının türü değildir.

## Solution

Kurucu kapalı dünya önizlemesini onayladıktan sonra bir Dış yüzey ve Onaylı snapshot revizyonu oluşur. Bağlantı bearer'dır; isteğe bağlı parola ve süre vardır. Ziyaretçi token ve parolayı doğruladıktan sonra yalnız bu Dış yüzeye bağlı `HttpOnly`/`Secure` Paylaşım erişim oturumu alır ve temiz URL'ye yönlenir; bu oturum Hesap oturumu değildir. Süre dolumu geri açılabilir; `Revoke` terminaldir. Her HTML ve asset isteği cache tesliminden önce güncel yüzey durumunu doğrular. Çözülmemiş `{{alan_adı}}` yer tutucuları önizlemede listelenir. YouTube ziyaretçide de tıklayınca yüklenir.

## User Stories

1. As a founder, I want to share a selected Belge, Roadmap, Ekran, Proje Duvarı, Moodboard, Teknik Diyagram, Akıllı Koleksiyon, or a single İş, Karar, Risk, Geri Bildirim, Üretim Olayı, Kilometre Taşı, or Proje Sürümü as revokeable read-only link, so that I can show one closed world without an Account.
2. As a founder, I want a preview of every exact record, version, field, relation, embed, and Dosya Eki that will leave, so that unseen relations cannot leak.
3. As a founder, I want no link minted until I approve that closed world, so that unreviewed shares do not exist.
4. As a founder sharing an Ekran, I want to pick the exact Wireframe version, so that later Wireframe edits cannot silently appear.
5. As a founder sharing a product-owned Teknik Diyagram, I want to pick exact Diyagram Sürümü and Diyagram Görünümü, so that live diagram edits stay private until a new approval.
6. As a founder sharing an dış kaynak bağlantısı diagram, I want an origin snapshot (URL, known revision/time, last check, provider) without an iframe, so that the share is not the external editor.
7. As a founder starting from a named view, I want that view’s filters and layout to be a one-time draft for the first preview, so that the view is not an access permission and later view edits do not auto-publish.
8. As a founder, I want Secret, share token, and link password excluded from share scope, so that credentials cannot be previewed out.
9. As a founder, I want unresolved `{{alan_adı}}` placeholders listed with source record, field, and text context, so that I can fix or give a separate `Publish/share anyway` confirmation.
10. As a founder, I want code-block and inline-code matches ignored, so that examples are not false positives.
11. As a founder, I want the product not to guess missing prose or AI-fill placeholders, so that the check stays syntactic.
12. As a founder, I want an approved snapshot revision that is the immutable content manifest, so that the Dış yüzey shows only that revision until I approve another.
13. As a founder, I want later source edits to stay private until a new preview and approval, so that live records cannot stream out.
14. As a founder, I want limited live structured fields only when I separately mark them `Live` from the allow-list, so that free text, new relations, and new attachments stay frozen.
15. As a founder, I want mixed surfaces labeled `Some fields live` rather than a misleading `Current`, so that visitors are not told the whole page is live.
16. As a visitor holding the link (and password if any), I want read-only access to the approved scope only, so that I cannot enter the Çalışma Alanı, comment, or copy-edit.
17. As a visitor, I want the token URL exchanged for a surface-bound session and a token-free clean URL, so that the secret does not sit in the address bar.
18. As a visitor, I want that session to end on browser close or 12 hours from creation without idle extension, so that leftover access dies.
19. As a founder, I do not want a Paylaşım erişim oturumu treated as my Hesap session, so that link-sharing cannot inherit Workspace writes, palette, or search (01).
20. As a visitor typing the wrong password, I want a generic error that does not reveal whether the surface exists, so that the gate does not enumerate.
21. As a founder, I want optional password add/change/remove, so that a shared secret can rotate without pretending to be identity.
22. As a founder, I want optional expiry in my profile time zone with no default auto-expiry, so that a link can live until I choose otherwise.
23. As a founder, I want expiry to stop new and existing visitor sessions without deleting the snapshot, password, or a Build in Public surface, so that expiry is not revoke.
24. As a founder, I want `Reshare with a new link` versus `Reopen the same link` after expiry to be two explicit actions, so that old holders are not silently re-admitted by default.
25. As a founder, I want `Revoke` to be irreversible for that URL/token, so that the next share is a new Dış yüzey.
26. As a founder, I want every HTML and asset/range request to re-check the live surface before cache delivery, so that CDN cannot beat revoke or redaction.
27. As a visitor, I want YouTube to load only after I click, with `Live external source` and a cookie/privacy warning, so that page open does not phone Google.
28. As a founder (and as the operator), I want share start, password attempts, and revoke rate-limited without storing raw reusable fingerprints, so that stuffing is contained.
29. As the operator restoring from backup, I want surface/token/password change and visitor-session revoke to replay from the irreversible security event log, so that an old database copy cannot resurrect access.
30. As a founder, I want English UI copy, so that the product language stays English.
31. As a founder and as a visitor using only a keyboard or a screen reader, I want to complete preview/approve and the visitor password/access/file/expiry/revoke/error journey, so that the closed accessibility journeys “yayın önizleme ve iptal” and “Dış yüzeyde parola, erişim, …” are possible.
32. As a founder, I do not want this link to be an Account invite, authenticated private share, Wiki publish, or Build in Public, so that those remain other surfaces.
33. As a founder, I do not want redaction to be client-side hiding, so that removed values cannot be recovered from the snapshot the visitor still holds in cache.
34. As a founder, I want Yakalama Gelen Kutusu öğesi, unresolved Toplu Anlamlandırma, and unsaved Taslak excluded from every share, so that capture never inherits visibility.
35. As a founder, I want the last scope-approval time visible on the share surface, so that I know which snapshot the visitor holds.
36. As a founder, I want new filter matches to stay on my diff until I approve, and a previously approved record to leave the link only when live-approved fields caused membership loss, so that scope cannot silently shrink or grow.
37. As a visitor, I want unpublished pending changes not hinted by counters or gaps, so that a share does not leak that a diff exists.
38. As a founder, I want opening, expiry change, or reactivation not to rewrite the source record’s status, Herkese açık durum etiketi, or Build in Public snapshot, so that a link is not a publish button.

## Implementation Decisions

- **Owning documents.** [ortak snapshot ve dış görünürlük güvenliği](../../prd/14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi), [bağlantıyla sınırlı salt okunur paylaşım](../../prd/14-sharing-and-public-publishing.md#bağlantıyla-sınırlı-salt-okunur-paylaşım), [canlı alan izin listesi](../../prd/14-sharing-and-public-publishing.md#canli-alan-izin-listesi), [yer tutucu söz dizimi](../../prd/07-documents-and-knowledge.md#yer-tutucu-soz-dizimi), [YouTube](../../prd/13-data-security-and-portability.md#database-first-guvenlik-tabani) and [akıllı bağlantı](../../prd/08-search-relations-and-evidence.md#akıllı-bağlantı-önizlemesi). Identity split: [ADR-0001](../../adr/0001-dis-yuzey-ve-snapshot-kimligi.md), access: [ADR-0002](../../adr/0002-dis-erisim-guvenlik-siniri.md), restore replay: [ADR-0003](../../adr/0003-restore-guvenlik-olay-gunlugu.md) / [ADR-0019](../../adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md). Visitor ≠ founder: Account Access (01) and [ADR-0002](../../adr/0002-dis-erisim-guvenlik-siniri.md). No new ADR.
- **Glossary.** Use Dış yüzey, Onaylı snapshot revizyonu, Bağlantıyla sınırlı salt okunur paylaşım, Bağlantı süre dolumu, Bağlantı iptali, Paylaşım erişim oturumu, Secret, Denetim kaydı, Geri döndürülemez güvenlik olay günlüğü. Do not introduce private share, authenticated share, Account invite, or live clone. Do not treat Paylaşım erişim oturumu as Hesap session.
- **Closed world.** Nothing enters without preview+approval: exact records, versions, fields, relations, attachments, embeds, and view metadata. Visibility is not inherited through relation, folder, parent Belge, or view membership. Preview also inspects indirect leaks (names, counters, gaps, broken lines). Removed items must not telegraph structure. Proje Duvarı and Moodboard list cards, exact Dosya Eki versions, layout, group titles, visual lines, view text, focus order, palette, crop/rotate/markup, and live Smart Collection blocks as separate preview items; omitting an item does not leave a hole that reveals private structure. Yakalama Gelen Kutusu öğesi, unresolved Toplu Anlamlandırma girdileri, and unsaved Taslak never inherit share scope.
- **Placeholders.** Unresolved placeholders are only `{{alan_adı}}` (`alan_adı`: leading letter, then lowercase letters, digits, underscore). Code fences and inline code do not warn. List with record, field, text context. Scope approval does not consume this warning; founder returns to content or gives separate `Publish/share anyway`. No AI fill, no semantic missing-prose guess, not a required-field score.
- **Secrets.** Classification is closed field/record type. Free-text secret scanning is not claimed. Share token and link password are Secret; they never enter search, export, logs, or share scope. Passwords are not stored reversibly.
- **Approved snapshot.** New approval → new Onaylı snapshot revizyonu. Dış yüzey points at current revision. Previous revisions stay internal for audit/diff while the surface lives; they are not selectable as old visitor views.
- **Live allow-list (this surface only).** Separately approvable live fields: user-facing status and closure result, priority, planned start/due/reappear dates, Roadmap horizon, Kilometre Taşı status, Proje Sürümü status, and openable numeric/date summaries. Title, description, Markdown, comments, relation rationale, Contact/Company, URL, Dosya Eki, new attachment version, Secret, custom fields are not live. Hybrid label `Some fields live`; frozen `Approved snapshot`; never a blanket `Current` if anything is frozen. New records entering a filter are candidates on the owner’s diff only. A previously approved record may leave the link only when live-approved field changes caused filter membership loss; other edits do not silently shrink scope. Unpublished pending changes and new candidates are owner-diff only — visitors do not see content, counters, gaps, or other hints that a diff exists. Last scope-approval time is visible on this surface. This hybrid does not apply to Build in Public.
- **Visitor session.** After token (+ password) check, backend mints a surface-bound `HttpOnly`, `Secure` session and redirects to a token-free URL. Clean URL does not work in another browser/session. Ends on browser close or 12 hours from creation; activity does not extend. Password change/remove, expiry, and revoke invalidate immediately. Not a Better Auth Hesap session: no Workspace write, Command Palette, or Evrensel Arama.
- **Password and rate limit.** Optional shared password is not identity. Attempts rate-limited on Dış yüzey plus privacy-preserving network/device signals; no durable raw IP fingerprint; keys rotate; data gone ≤ 24h after last attempt. Generic errors; increasing cooldown. Suspicious events may offer founder token/password rotation, not an anonymous visitor Account.
- **Expiry versus revoke.** Optional expiry, no default. Expiry stops access; snapshot, password, and any Build in Public surface unchanged. Before expiry, founder may extend. After expiry: default `Reshare with a new link` (new Dış yüzey/URL); `Reopen the same link` warns that all old holders regain access and needs extra confirmation. `Revoke` is terminal; URL/token never reused. Restore of a historical row keeps revoked. Opening, changing expiry, or reactivating a share does not change the source record’s status, Herkese açık durum etiketi, or a Build in Public snapshot.
- **Cache fail-closed.** Every page, asset, and byte-range request authorizes current Dış yüzey, visitor session, and exact file version *before* cache delivery. No raw public R2 URL, no reusable origin/CDN object URL. Purge is hygiene, not the security barrier. Offline/stale window does not exist. Revoke/redaction beat cache. A revoked or unpublished URL answers generic empty-body `410 Gone` with `noindex`; it is not a redirect to a new surface or private content, and the URL is never reused.
- **Headers.** `Referrer-Policy: no-referrer`, restrictive CSP, outbound links `rel="noreferrer"`. No third-party request or script before visitor consent (YouTube click).
- **YouTube.** Only first-product interactive embed. Card labeled `Live external source`. Player loads only on visitor click after privacy/cookie warning; enhanced privacy mode where applicable; no autoplay; original URL visible. Failure → safe link or explainable error, no broken embed. Click-to-load does not make the record Public. Same rule for founder preview and visitor.
- **Hono** serves product-controlled public HTML. Cloudflare CDN may distribute only after origin/edge activity check (tech stack). Link-limited content stays in the EU data region (ADR-0009); it is not “knowingly public static.”
- **Restore replay.** Token/password change, surface revoke, and visitor-session revoke append secret-free aliased events to the irreversible security log. Replay after restore of a still-live surface row keeps access unauthorized. Production log must not live in the primary restore unit (ADR-0019). Full RPO/RTO stays in operator-backup.
- **Denetim kaydı.** Share create, password rotate, expiry change, revoke, visitor-gate failures: 365-day auth class, aliased identities, no tokens/passwords/content.
- **English UI labels.** `Share`, `Approved snapshot`, `Live`, `Some fields live`, `Publish/share anyway`, `Revoke`, `Reshare with a new link`, `Reopen the same link`, `Live external source`. Missing labels go to the term table when first shown.
- **Responsive visitor.** Desktop plus current and previous iOS Safari and Android Chrome at acceptance matrix; not a signed-in mobile app.

## Testing Decisions

- **What a good test is.** Tests observe Link Sharing through its public interface: preview list of exact records, versions, fields, and files, approve/mint, visitor session exchange, password/expiry/revoke, asset/range, placeholder list with resolve-or-`Publish/share anyway`, YouTube no-request-on-load, founder-session rejection of visitor cookie, empty-body `410 Gone` after revoke. They do not assert CDN internals. Expected values are PRD rules (12-hour session, generic errors, revoke beats cache).
- **Seam (one).** Link Sharing — the product-facing share and visitor-access interface. Object storage, CDN, and the security-event log are adapters. Wiki Publishing and Build in Public must reuse this access-verification adapter rather than fork ADR-0002.
- **Modules under test.** Link Sharing only. Account Access is the counterpart that a visitor session cannot call founder revoke. Wiki/Build-in-Public create flows are out.
- **Prior art.** No Vitest/Playwright suite yet. Contract tests with storage/CDN test doubles that still fail closed on revoke. Evidence binds to [Bağlantıyla paylaşım](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Her ikisi`). Accessibility: **yayın önizleme ve iptal** and **Dış yüzeyde parola, erişim, gezinme, dosya, süre dolumu, iptal ve hata**.
- **Required counterparts.** Unapproved relation absent; visitor cannot use palette/search; expired ≠ revoked; cache/range after revoke denied with empty-body `410 Gone` + `noindex`; YouTube click-to-load; founder cookie ≠ visitor cookie; Secret not in manifest; preview lists exact records, versions, fields, and files before mint; Yakalama/Taslak/Toplu Anlamlandırma never inherit scope.

## Out of Scope

- Bağlantıyı Hesap daveti, yazma yetkisi veya kimlik doğrulamalı özel paylaşım sayma.
- Süre dolumunu terminal iptal sayma.
- Ziyaretçiye kurucu paleti, arama veya Workspace yazması açma.
- Canlı kayıtları onaylı snapshot olmadan dışarı açma.
- Cache veya CDN'in iptali ezmesine izin verme.
- Redaksiyonu istemci gizleme sayma.
- Yer tutucu kontrolünü genel zorunlu alan veya AI doldurma sayma.
- Secret'ı serbest metin taramasıyla bulduğunu iddia etme.
- Wiki yayını ve Build in Public oluşturma akışları (74/75).
- Dış yüzey dizin yönetimi (76).

## Further Notes

- **Orient.** Glossary: Dış yüzey, Onaylı snapshot revizyonu, Paylaşım erişim oturumu, Bağlantı süre dolumu, Bağlantı iptali, Secret. Owning PRD: `docs/prd/14-sharing-and-public-publishing.md`. ADRs: 0001, 0002, 0003, 0019. Related: PRD 07 placeholders, PRD 08 YouTube, PRD 13 secrets/redaction, PRD 15 cache-must-not-skip-auth, PRD 16 Bağlantıyla paylaşım, PRD 19 (no comments, no authenticated private share, no view analytics).
- **Acceptance.** Bind to [Bağlantıyla paylaşım](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Negative bounds (no Account invite, no visitor writes, no cache-beats-revoke) are 19-class counterparts. Project-trash terminal revoke of surfaces is journey [Proje silme ve dış yüzey](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) — owned with 83, consumed here as access result.
- **Consumers.** 74 and 75 reuse the access adapter and placeholder check (not separate delivery cards). 76 indexes surfaces this feature creates. 01 must keep visitor sessions out of founder session APIs. 78 redaction must empty snapshot bytes this adapter already fail-closes.
