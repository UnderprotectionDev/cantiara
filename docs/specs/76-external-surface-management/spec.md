# Paylaşım ve Yayınları Yönetme

Kaynak: [`docs/workflow/76-external-surface-management/phase-context.md`](../../workflow/76-external-surface-management/phase-context.md)

## Problem Statement

Kurucu Çalışma Alanı ve Proje düzeyinde hangi Dış yüzeylerin ayakta, süresi dolmuş veya iptal olduğunu unutmamak ister. Oluşturma 73/74/75'te kalır; bu kart bir oluşturma sihirbazı değildir. Kaldırılan yüzey içerik, varlık veya görüntülenme analitiği sızdırmamalıdır. Dizin CDN panosu veya analitik ürünü değildir.

## Solution

`Shares and Publications` bütün Dış yüzeyleri — bağlantı paylaşımı, Wiki yayını, Build in Public — kaynak, görünürlük, erişim ve yaşam durumuyla tek dizinde listeler. Satır eylemleri duruma uygun `Open source`, `Review diff`, `Change expiry / Reactivate`, `Revoke / Unpublish`, `Move to Trash` sunar. Anonim görüntülenme veya son erişim toplanmaz. İndeksten kaldırılan yüzey genel `410 Gone`, `noindex`, sitemap dışı ve ürün kontrollü cache temizliğiyle hiçbir içerik sızdırmaz; URL yeniden kullanılmaz.

## User Stories

1. As a founder, I want one directory of every Dış yüzey in the Çalışma Alanı, so that link, wiki, and public Proje cannot hide in separate lists.
2. As a founder in a Proje, I want the same directory scoped to that Proje, so that I can manage one product’s surfaces.
3. As a founder, I want each row to show source record, visibility, password presence (not the secret), expiry, `Active` / `Expired` / `Revoked`, last approval time, and whether unpublished changes exist, so that I can act without opening the create flow.
4. As a founder, I want row actions appropriate to state (`Open source`, `Review diff`, `Change expiry / Reactivate`, `Revoke / Unpublish`, `Move to Trash`), so that the directory manages life-cycle rather than minting new kinds.
5. As a founder, I want create/publish flows to stay in Link Sharing, Wiki Publishing, and Build in Public, so that this directory does not become a second wizard.
6. As a founder, I want revoke/unpublish from the directory to use the same terminal Dış yüzey semantics as those features, so that policy is not forked.
7. As a founder, I want a removed surface’s old URL to answer generic `410 Gone` with `noindex`, so that neither content nor a new private redirect leaks.
8. As a founder, I want that URL never reused for a new surface, so that stale bookmarks cannot land on someone else’s snapshot.
9. As a founder, I want sitemap removal and a product-controlled cache/index purge request, with retry visible, so that hygiene is observable without being the security barrier.
10. As a founder, I want no view counter, last access, visitor identity, IP profile, or per-person history in this directory, so that management is not analytics.
11. As a founder, I want a Trashed surface to leak nothing while in Çöp Kutusu and after permanent delete, so that removal is complete for visitors.
12. As a founder, I do not want this directory to host CDN graphs or analytics dashboards, so that 19 holds.
13. As a founder, I want English UI copy, so that the product language stays English.
14. As a founder using only a keyboard or a screen reader, I want to scan the directory, open source, revoke, and confirm gone URLs, so that sharing + public journeys include the index.
15. As a founder, I want a redacted revision shown as redacted without the removed value, so that management is not a leak.
16. As a founder, I want a Dış yüzey kept when its single source is trashed to be listed as frozen and detached, so that I do not mistake it for a live-updating publish or a 410.

## Implementation Decisions

- **Owning documents.** [Paylaşım ve Yayınlar yönetimi](../../prd/14-sharing-and-public-publishing.md#paylaşım-ve-yayınlar-yönetimi) plus access results in the [ortak sözleşme](../../prd/14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi). ADR-0001 (surface identity), ADR-0002 (gone URL fail-closed). Create owned by 73/74/75. No new ADR.
- **Glossary.** Use Dış yüzey, Onaylı snapshot revizyonu, Bağlantı süre dolumu, Bağlantı iptali, Çöp Kutusu. Do not introduce analytics, CDN console, or a second publish wizard. Status labels: `Active`, `Expired`, `Revoked` (PRD `Aktif`, `Süresi doldu`, `İptal edildi`).
- **Index only.** The directory lists existing Dış yüzey rows. It does not mint share links, wiki pages, or Build in Public enables. Tests may fixture surfaces without driving full 73/74/75 UIs.
- **Row fields.** Source/scope, visibility kind (bağlantı / Wiki / Build in Public), password present boolean (never the secret), expiry, life status, last approval, unpublished-changes flag, redaction status without leaking redacted content, and whether a single-source-kept surface is frozen/detached from its source. Actions. No view counts or last-access.
- **Actions call shared lifecycle.** Expiry change, reopen-same-link (with its warning), revoke, unpublish, trash use the same Dış yüzey transitions as 73/74/75. Directory must not invent a softer revoke.
- **Removed surface.** Visitor GET/asset/range → generic `410 Gone`, `noindex`, not a redirect to private content or another surface. Sitemap drop + purge request with visible retry; purge failure does not re-open content. URL never reused. Third-party copies not promised gone. Directory copy does not claim those copies are gone.
- **Tekil kaynakta korunan yüzey.** Tekil kaynak Çöp Kutusuna alınırken korunan Dış yüzey, donmuş Onaylı snapshot revizyonunu sunduğu sürece dizinde kalır. Satır canlı kaynak bağını, yeni onayı veya canlı alan güncellemesini ima etmez. Ziyaretçi erişimi terminal iptale kadar donmuş snapshot'tır; korunan yüzey 410 değildir.
- **Trash.** İptal edilmiş Dış yüzey may enter ordinary 30-day Çöp Kutusu; permanent delete drops revision bytes; identity tombstones may remain. Visitors still see gone, never content.
- **English UI labels.** `Shares and Publications`, `Active`, `Expired`, `Revoked`, `Open source`, `Review diff`, `Change expiry / Reactivate`, `Revoke / Unpublish`, `Move to Trash`. Missing labels go to the term table when first shown. `Trash` already exists.

## Testing Decisions

- **What a good test is.** Tests observe External Surface Management through its public interface: list all kinds, filter by Proje, row fields without secrets, redaction status without content, frozen single-source-kept row, revoke from row → 410 and no body, unpublished flag, no counters. Expected values are directory completeness and leak-nothing on remove.
- **Seam (one).** External Surface Management — the product-facing index of Dış yüzey. Lifecycle mutations invoke the shared surface adapter; create commands are out of this suite.
- **Modules under test.** External Surface Management only. Create UIs of 73/74/75 are not required except as “not hosted here.”
- **Prior art.** No Vitest/Playwright suite yet. Evidence binds to [Bağlantıyla paylaşım](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [Herkese açık yayın](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as the directory half, plus gone-URL counterparts on [Proje silme ve dış yüzey](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) when 83 deletes a Proje.
- **Required counterparts.** Create wizard absent; view counter absent; revoked URL 410 with empty body and no redirect to a new surface; URL reuse rejected; password secret not in row; redaction status without content; a source-kept frozen surface is not presented as live.

## Out of Scope

- Dizini analitik ürünü veya CDN panosu sayma.
- Kaldırılan yüzeyden içerik veya görüntülenme sızdırma.
- Yüzey oluşturmayı bu dizinle karıştırma (73/74/75).
- Proje silme grubu ve Arşiv güvenlik istisnası (83) — dizin onların erişim sonucunu gösterir, silme akışını sahiplenmez.

## Further Notes

- **Orient.** Glossary: Dış yüzey, Onaylı snapshot revizyonu, Bağlantı iptali, Çöp Kutusu. Owning PRD: `docs/prd/14-sharing-and-public-publishing.md` (Paylaşım ve Yayınlar yönetimi). ADRs: 0001, 0002. Related: PRD 16 both external journeys, PRD 19 analytics.
- **Acceptance.** Directory completeness on Bağlantıyla paylaşım + Herkese açık yayın. Leak-nothing on remove is a 19-class plus security counterpart (PRD 15: revoked surface must not serve via cache/range/old session/origin URL).
- **Producers.** 73/74/75 create rows this index reads. 83 project trash terminal-revokes Proje-scoped rows; this directory must then show `Revoked` and 410.
