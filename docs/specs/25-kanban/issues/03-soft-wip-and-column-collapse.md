# 03 — Soft WIP, odak eşiği ve sütun daraltma

**What to build:** Devam eden İş sayısı ve aktif kartların mevcut durumda geçirdiği süre görünür. İsteğe bağlı kişisel odak eşiği ve durum bazlı soft WIP sınırı aşıldığında nötr, yalnız renge dayanmayan işaret durur; kart hareketi engellenmez, bildirim veya sağlık hükmü üretmez. Kullanıcı sütunu yalnız görünümü sıkıştırmak için daraltır; ad, kart sayısı ve açık blokaj gibi sinyaller kalır. Daraltma filtre veya durum yazmaz.

**Blocked by:** 01 — Durum sütunları ve kart hareketi

**Status:** ready-for-agent

- [ ] Aktif kartlarda mevcut durumda geçen süre ve devam eden İş sayısı görünür.
- [ ] Soft WIP ve odak eşiği aşımında hareket uygulanır; bildirim, sağlık skoru veya otomatik alan yazımı yoktur.
- [ ] Daraltılmış sütun ad, sayı ve önemli sinyali göstermeye devam eder; üyelik ve durum değişmez.
- [ ] Kabul kanıtı seam’de eşik aşımında sürüklemenin uygulanması ve daraltmanın filtre olmaması.
