# 03 — Kilometre Taşı ara sonuçtur

**What to build:** Kilometre Taşı başlık, açıklama, isteğe bağlı hedef tarihi ve `Planned` / `Reached` / `Abandoned` taşır. İşler `Contributes to milestone` ile bağlanır. Taşa ulaşmak bağlı İşleri kapatmaz; bütün bağlı İşlerin kapanması Taşı otomatik `Reached` yapmaz. Durum yalnız açık eylemle değişir. Kilometre Taşı Odak Dönemi, Proje Sürümü, sprint, proje aşaması veya Hedefe katkı değildir.

**Blocked by:** 01 — Ufuk yerleşimi durum ve sıra yazmaz

**Status:** ready-for-agent

- [ ] Milestone ana kaydı oluşur; ulaşma/vazgeçme İş kapanışı yazmaz.
- [ ] Bütün bağlı İşler `Closed` olsa bile Taş kendiliğinden `Reached` olmaz.
- [ ] `Contributes to milestone` Hedefe katkı veya Proje Sürümü kapsamı değildir; Odak Dönemi penceresi veya yayın kapsamı bu kayıtta üretilmez.
- [ ] İngilizce UI `Milestone`, `Planned`, `Reached`, `Abandoned` kullanır.
- [ ] Kabul kanıtı seam’de ulaşma/kapanmama matrisi ve noun ayrımı. Kanıt [Roadmap](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
