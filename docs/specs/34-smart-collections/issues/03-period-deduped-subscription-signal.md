# 03 — Dönem tekilli abonelik sinyali

**What to build:** Kullanıcı kaydın koleksiyona ilk girişinde Bildirim Merkezi sinyali açabilir; çıkış ayrıca seçilebilir. Aynı üyelik dönemi boyunca sinyal tekrarlanmaz. Üretim kayıtlı `smart-collection-entry` `Information flow` kimliğini kullanır; çıkış opt-in’i aynı kimlikte açıklanabilir ayrılma nedeni taşır, yeni kayıtsız tür basmaz. Abonelik kaydı koleksiyonun çocuğu yapmaz ve kaynak alanlarını yazmaz. Merkez kabuğu 71’dedir; e-posta özeti yoktur.

**Blocked by:** 01 — Canlı üyelik, manuel pin yok

**Status:** ready-for-agent

- [ ] İlk girişte tam olarak bir `smart-collection-entry` doğar; çırpınma aynı dönemde çoğalmaz.
- [ ] Çıkış opt-in kapalıyken ayrılma sinyal basmaz; açıksa ayrı üyelik-dönemi başına birdir.
- [ ] Abonelik kaydı koleksiyonun çocuğu yapmaz ve kaynak alanlarını yazmaz.
- [ ] Kayıtsız sinyal kimliği yoktur; 71 listesi bu ticket’ta kurulmaz.
- [ ] Kabul kanıtı seam’de dönem tekilliği ve kayıtsız tür karşıtı. Üretim [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) paketidir; gösterim Dikkat sinyalleri yolculuğundadır.
