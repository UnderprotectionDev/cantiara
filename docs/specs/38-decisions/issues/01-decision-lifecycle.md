# 01 — Karar yaşamı Geçerli, yerine geçilmiş, geri çekilmiş

**What to build:** Kurucu Kararı başlık, hüküm ve gerekçeyle kaydeder. Yaşam `Valid`, `Superseded`, `Withdrawn`. `Superseded` yalnız sonraki ticket’taki açık ilişkiyle oluşur; ilişkisiz seçilemez. `Withdrawn` halef gerektirmez. İş kapanması Kararı sessizce geri çekmez. Durumsuz içe aktarılan kayıt `Valid` sayılır.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Karar Proje ana kaydıdır. İngilizce UI `Decision`, `Valid`, `Withdrawn`; eksik etiket terim sözlüğüne eklenir.
- [ ] `Superseded` doğrudan durum seçimiyle ilişkisiz üretilemez. `Withdrawn` isteğe bağlı tarihli gerekçeyle açık eylemdir.
- [ ] İş, Risk veya Varsayım kapanışı/değişimi Karar yaşamını yazmaz.
- [ ] Yapılandırılmış alternatif seti, oylama ve otomatik kazanan yoktur.
- [ ] Kabul kanıtı Decisions seam’inde: oluşturma, geri çekme, ilişkisiz superseded reddi, İş kapanışı karşıtı. [Karar ve belirsizlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
