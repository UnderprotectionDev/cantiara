# Kaynaklar ve Kanıt Tazeliği

Kaynak: [`docs/workflow/44-sources-and-freshness/phase-context.md`](../../workflow/44-sources-and-freshness/phase-context.md)

## Problem Statement

Kurucu dış bilginin kimliğini, kökenini ve tarihli sürümünü canlı sayfa gibi kaybetmeden tutmak ister. Önizleme iç ağı açarsa veya HTML ikinci doğruluk kaynağı olursa ürün güvenilmez. Yeniden kontrol kullanımları sessizce yeni sürüme taşırsa eski kanıt yalan söyler. Uzun gövde feed’i Geri Bildirim feature’ındadır. Kaynağın varlığı otomatik Kanıt bağı değildir.

## Solution

Kaynak Proje ana kaydıdır; URL/başlık, erişim zamanı, yakalanan içerik ve tarihli sürümler. Akıllı bağlantı önizlemesi ADR-0008 yalıtılmış egress ile başlık/alan adı/güvenli görseldir; dış HTML gömülmez. Canlı oynatıcı yalnız YouTube’dur, tıklanınca yüklenir, autoplay yoktur. `Recheck source` aday snapshot üretir, onaylı sürümü kendiliğinden değiştirmez; her kullanım kendi `Keep current version` veya `Rebind to new version` kararını verir. Toplu “hepsini güncelle” örtük çalışmaz.

## User Stories

1. As a founder, I want a Source with address, title, access time, and captured content, so that an outside page is a dated record, not a live mirror.
2. As a founder, I want short excerpts, screenshots, and attachments on the Source, so that origin is inspectable.
3. As a founder, I want optional provider, external record type, and external id only when URL shape or my explicit entry resolves them, without credentials, sync, or turning the URL into Work.
4. As a founder, I want a new fetch not to delete an old Source version, so that historical capture stays.
5. As a founder pasting a public HTTP(S) URL, I want a scannable preview of title, domain, and optional safe image, without that preview itself creating a Source.
6. As a founder, I want preview to refuse other protocols, private/link-local/loopback/reserved targets, >20 MB responses, and executable content, leaving a safe text link.
7. As a founder, I want preview and recheck to run on an unprivileged egress path that re-validates DNS and every redirect (ADR-0008), with no user credentials or session cookies.
8. As a founder, I want `Save as Source` to turn a preview into a Source, visually separating live preview from the historical snapshot.
9. As a founder, I want YouTube as the only live player: labeled `Live external source`, click-to-load, no autoplay, original URL visible, third-party warning remaining; removed/private/age/region-restricted videos fall back to a safe link plus error, not a broken embed.
10. As a founder, I want a YouTube card not to be historical evidence; once saved as Source, live player and captured-at-access content stay distinct.
11. As a founder, I want Vimeo and other providers to stay safe rich previews, never players; pasted iframe/embed code refused.
12. As a founder, I want `Recheck source` to preview the address, current approved version, and that a third-party fetch will occur, with no background polling or time-only refresh.
13. As a founder, I want each check to store a dated Source Check event (time, user, start and final URL, HTTP result, content type, fingerprint) and, on success, a sanitized candidate snapshot that does not become the approved version by itself.
14. As a founder, I want failure (auth, deleted, blocked, unsupported) not to display old content as current; the failure stays on the event.
15. As a founder, I want side-by-side compare, and line/section diff when structure allows, including missing pin matches shown as `No match in candidate version` without silent semantic rebind.
16. As a founder, I want `Keep current version` to keep the check in history without changing the approved Source version.
17. As a founder, I want `Save as new Source version` after preview to add a version; old version and its Decision/Work/Feedback pins stay; the new version does not inherit binds or create Work/Risk/Test Gap.
18. As a founder, I want each evidence use to show exact Source version, access date, and range, plus `Newer Source version exists` with compare, without labeling the old version silently false.
19. As a founder, I want per-use `Reviewed; keep current version` or `Rebind to new version` with preview of only that bind; other uses keep their own decision. No implicit update-all.
20. As a founder, I want `source-version-in-use` when a newly approved version still has active evidence binds on older versions, grouped per Source, each use separate; ordinary `İlgili`, live card, or viewing does not emit it; Source age or failed check alone does not.
21. As a founder, I want recheck not to be a gate or auto impact analysis: unread new versions do not write Work/Decision/Risk/test/Release status.
22. As a founder, I want Source Check events not to appear as independent Universal Search hits that duplicate current Source body.
23. As a founder, I want share/publish to preview candidate, diff, and each new version as separate closed-world items; an old public snapshot does not change because of a new check.
24. As a founder, I want English UI `Source`, `Save as Source`, `Recheck source`, `Keep current version`, `Save as new Source version`, `Newer Source version exists`, `Reviewed; keep current version`, `Rebind to new version`, `Live external source`, `No match in candidate version`.
25. As a founder using only a keyboard or a screen reader, I want to save a Source, run recheck, compare, and decide per use.
26. As a founder, I do not want this feature to own the long-body Feedback/Source Feed (47) or to treat Source presence as an evidence bind (45).
27. As a consuming attention center (71), I want `source-version-in-use` production rules to stay here.

## Implementation Decisions

- **Owning documents.** [Kaynak kaydı](../../prd/08-search-relations-and-evidence.md#kaynak-kaydı-ve-köken-bilgisi), [Akıllı bağlantı önizlemesi](../../prd/08-search-relations-and-evidence.md#akıllı-bağlantı-önizlemesi), [Kaynağı yeniden kontrol etme](../../prd/08-search-relations-and-evidence.md#kaynağı-yeniden-kontrol-etme-ve-sürüm-karşılaştırması), [Bilgi güncelliği](../../prd/08-search-relations-and-evidence.md#bilgi-güncelliği). Isolation: [ADR-0008](../../adr/0008-dis-url-onizleme-yalitimi.md). Tech: `undici`, `htmlparser2`, `ipaddr.js`, `diff` (jsdiff). Signal `source-version-in-use` registry in PRD 04; production here. Feed body: 47. Evidence binds: 45. No new ADR.
- **Glossary.** Use Kaynak, Akıllı bağlantı önizlemesi, Kanıt bağı (do not auto-create), Dikkat sinyali. Avoid bookmark, live web mirror, preview-as-Source, Vimeo player.
- **Source module.** Project-scoped versions; new fetch does not delete old. Helper: Source Check event + candidate snapshot. Approved version changes only on explicit save.
- **Preview adapter.** Separate unprivileged egress. DNS and redirect re-check every hop; block loopback/private/link-local/reserved; HTTP(S) only; no credentials; tight redirect/time/byte/CPU limits; sanitize; fail to plain link. YouTube click-to-load iframe only after explicit click and visible third-party warning; no autoplay. No other live player. No user iframe paste.
- **Recheck.** User-started only. Per-use rebind via 45’s explicit rebind; this feature must not batch-rebind. `source-version-in-use` when new approved version × remaining old binds; closes when every use is reviewed. Not a gate.
- **English UI labels.** As in stories. Add when first shown.
- **Consumers.** 71 presents the signal. 47 feed reads the same Source body. 45 owns Kanıtı relation.

## Testing Decisions

- **What a good test is.** Tests observe Sources and Freshness through Source CRUD, isolated preview, recheck/compare, and per-use keep/rebind. They go red on silent rebind, private-IP preview success, or treating preview HTML as a Source version. Expected values come from the freshness journey (one Source, three targets, two versions, partial review), not from fetch implementation.
- **Seam (one).** Sources and Freshness — Source CRUD, preview, recheck/compare, per-use decision, signal production. Egress is an adapter (real vs double that still enforces deny-private).
- **Modules under test.** Sources and Freshness only. Evidence rebind and Notification Center are consumers/counterparts.
- **Prior art.** First contract tests at this seam with an egress test double. Journey: [Kanıt tazeliği](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Adversarial preview: private IP, redirect-to-private, oversized, non-HTTP.
- **Required counterparts.** Preview is not a Source; YouTube-only player; no silent rebind; no update-all; Source existence is not Kanıtı; feed UI absent; no background poll.

## Out of Scope

- Geri Bildirim ve Kaynak Feed gövdesi (47).
- Kanıt ilişkisi UI’si (45) — yeniden bağlama bu seam’den 45’i çağırır.
- Dosya Eki depolama (14-file-attachments), bookmark, canlı web aynası.
- Vimeo/diğer canlı oynatıcı, iframe yapıştırma.
- Periyodik tarama, zamanlı staleness, otomatik yenileme.

## Further Notes

- **Orient.** Glossary: Kaynak, Akıllı bağlantı önizlemesi, Kanıt bağı. Owning PRD: 08. ADR: 0008. Journey: Kanıt tazeliği. Related: ADR-0002 for shared candidate snapshots, PRD 19 staleness.
- **Acceptance.** Bind to [Kanıt tazeliği](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
