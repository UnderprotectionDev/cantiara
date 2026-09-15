# Tekil Wiki Yayını

Kaynak: [`docs/workflow/74-wiki-publishing/phase-context.md`](../../workflow/74-wiki-publishing/phase-context.md)

## Problem Statement

Kurucu tek bir Wiki Belgesini, seçtiği gömülerle, Proje Build in Public sayfasından bağımsız herkese açık bir snapshot olarak yayımlamak ister. Canlı Kişisel Wiki kopyası, çok sayfalı bilgi tabanı veya bağlantıyla sınırlı bearer paylaşımı bu ihtiyaç değildir. Önizlenmeyen çocuk belge, geri bağlantı veya canlı blok sızmamalıdır. İptal ve redaksiyon cache'den sonra gelmemelidir. Yer tutucu ve anlık erişim kapısı ayrı teslim kartı değildir; aynı kapalı dünya sözleşmesidir.

## Solution

Kurucu bir Wiki Belgesini kapalı dünya önizlemesiyle onaylar. Yayın, Dış yüzey + Onaylı snapshot revizyonu olarak bağımsız herkese açık sayfadır. Seçilmemiş gömü örtük açılmaz; canlı bloklar onay anındaki tarih etiketli salt okunur snapshot olur. Varsayılan `noindex`, sitemap yok; indeksleme ayrı açıktır. Ziyaretçi yorum/oy/abonelik yapamaz. Erişim, yer tutucu ve cache fail-closed kuralı Link Sharing ile aynıdır ve bu feature'da yeniden kartlaştırılmaz.

## User Stories

1. As a founder, I want to publish one Kişisel Wiki Belge as its own public snapshot, so that a single page can leave without publishing the Proje.
2. As a founder, I want that publish to be independent of Project Build in Public, so that wiki and project public surfaces do not collapse.
3. As a founder, I want a preview that lists every exact record, version, field, and Dosya Eki that will leave, plus inline references, backlinks, attachments, child documents, live Smart Collection blocks, live content sections, and other embeds one by one, so that I approve each.
4. As a founder, I want unapproved embeds omitted, so that the rest of the Wiki cannot leak through a child or backlink.
5. As a founder, I want approved live blocks published as read-only snapshots with source and date labels, so that they cannot open private records.
6. As a founder, I want no surface until I approve, so that preview is not a visitor session.
7. As a founder, I want Secret, share token, and link password excluded, so that wiki publish is not a credential dump.
8. As a founder, I want unresolved `{{alan_adı}}` listed the same way as sharing, so that I can fix or confirm `Publish/share anyway`.
9. As a founder, I want the public page to show only the approved revision until I approve another, so that live Wiki edits do not stream out.
10. As a founder, I want default `noindex` and no sitemap entry, so that a URL-known page is not automatically searchable.
11. As a founder, I want optional indexing only after I enable it, with the warning that third-party caches cannot be fully recalled, so that discoverability is honest.
12. As a founder, I want revoke to fail-closed new HTML and asset requests before cache, so that unpublish is not cosmetic.
13. As a visitor, I want a read-only public page without comment, vote, feedback, subscription, or co-edit, so that wiki publish is not a community product.
14. As a founder, I do not want this to be a live Wiki clone or a multi-page public knowledge base, so that 19’s knowledge-base candidate stays out.
15. As a founder, I want YouTube on the public wiki page to be click-to-load as well, so that visitors are not tracked on paint.
16. As a founder, I want English UI copy, so that the product language stays English.
17. As a founder and visitor using only a keyboard or a screen reader, I want to complete wiki preview, publish, and unpublish, so that “yayın önizleme ve iptal” includes this slice.

## Implementation Decisions

- **Owning documents.** [Tekil Wiki belgesi yayınlama](../../prd/14-sharing-and-public-publishing.md#tekil-wiki-belgesi-yayınlama) plus the [ortak sözleşme](../../prd/14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi). Wiki scope: [Kişisel Wiki](../../prd/07-documents-and-knowledge.md#kişisel-wiki). ADR-0001, ADR-0002. No new ADR. Access/placeholder/cache are the shared adapter from Link Sharing, not a second policy.
- **Glossary.** Use Kişisel Wiki, Belge, Dış yüzey, Onaylı snapshot revizyonu. Do not introduce public wiki clone, knowledge base, or Project Build in Public alias. Do not call this Bağlantıyla sınırlı salt okunur paylaşım (no bearer password gate required; it is a public snapshot).
- **Single document.** One Wiki Belge root. Preview lists exact records, versions, fields, and files that will leave, then child documents, attachments, and embeds as separately approved snapshot members. Unpublished Wiki remainder does not leak.
- **Public, not bearer.** The URL is knowingly public once published (anyone who knows it). Default `noindex`, omitted from sitemap until the founder enables indexing. Enabling indexing warns that third-party copies cannot be fully withdrawn.
- **Live blocks freeze.** Approved live Smart Collection / live content sections become read-only snapshots with source and date label. They do not navigate into private records.
- **Reuse, do not re-card.** Placeholder syntax, fail-closed HTML/asset checks, CSP/referrer, YouTube click-to-load, redaction participation, and restore replay of revoke use the same adapter as 73. This feature’s tests still observe them *through the Wiki Publishing seam* (phase-context: not a separate delivery card — meaning not a third feature — but they are in-scope behavior here).
- **Metadata.** Published Wiki uses the Belge title plus optional document-specific public summary. Search title / meta description / slug may exist as snapshot fields; they do not make the page indexable by themselves and do not inherit from a Project public surface.
- **English UI labels.** `Publish Wiki Document`, `Unpublish`, `Publish/share anyway`, `Live external source`. Missing labels go to the term table when first shown.

## Testing Decisions

- **What a good test is.** Tests observe Wiki Publishing through its public interface: preview member list of exact records, versions, fields, and files, publish one document, visitor GET of approved snapshot, omit unapproved child, default noindex, revoke `410 Gone` fail-closed with no body, placeholder list with resolve-or-`Publish/share anyway`. They reuse the access adapter; they do not re-specify CDN internals. Expected values are “single wiki ≠ project public” and “live wiki does not stream.”
- **Seam (one).** Wiki Publishing — product-facing publish of one Wiki Belge. Access verification is an adapter shared with Link Sharing.
- **Modules under test.** Wiki Publishing only. Build in Public and link-share create flows are counterparts.
- **Prior art.** No Vitest/Playwright suite yet. Evidence binds to [Herkese açık yayın](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as the wiki slice (same journey, document-not-project). Accessibility: **yayın önizleme ve iptal**.
- **Required counterparts.** Unapproved child absent; live Wiki edit after publish unseen; Project Build in Public not created; cache after unpublish denied; multi-page knowledge base absent; preview lists exact records, versions, fields, and files; unresolved `{{alan_adı}}` listed with resolve-or-`Publish/share anyway`.

## Out of Scope

- Tekil yayını Proje Build in Public sayma.
- Canlı Wiki'yi public kopya gibi eşleme.
- Çok sayfalı yayımlanabilir bilgi tabanı (19 / 18).
- Anlık erişim kapısını veya yer tutucu kontrolünü ayrı teslim kartı / ayrı policy sayma.
- Cache veya CDN'in iptali ezmesine izin verme.
- Bağlantıyla sınırlı parola kapısını wiki public sayfasına zorunlu kılma.
- Ziyaretçi yorumu, oyu, aboneliği.

## Further Notes

- **Orient.** Glossary: Kişisel Wiki, Belge, Dış yüzey, Onaylı snapshot revizyonu. Owning PRD: `docs/prd/14-sharing-and-public-publishing.md` (tekil Wiki). ADRs: 0001, 0002. Related: PRD 07 Wiki, PRD 16 Herkese açık yayın, PRD 19 knowledge base / comments.
- **Acceptance.** Wiki slice of [Herkese açık yayın](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): source change does not appear without approval; cache does not beat unpublish. Dogfooding Wiki evidence is personal software knowledge, not Cantiara PRD files — this feature supplies the publish path that journey may use.
- **Consumers.** 76 lists the resulting Dış yüzey. 32 owns Wiki authoring, not publish.
