# 02 — Üç triage çıkışı

**What to build:** Mevcut Gelen Kutusu öğeleri tam olarak üç çıkıştan biriyle tüketilir: tek yeni kalıcı kayda dönüşüm (sahiplik ilgili kayıt feature’ına geçer), mevcut kayda köken veya kanıt olarak bağlama/birleştirme, ya da silme. Proje+tür kesin doğrudan `Create Bug` yolu ticket 01’dedir; Inbox öğesi bırakmaz. Bu ticket yalnız Inbox öğelerini tüketir. Sistem tür tahmin edip kayıt açmaz. İsteğe bağlı benzer kayıt önerisi dayanağını gösterir; onaysız birleştirmez. Dönüşüm önizlemesi özgün metinle önerilen kaydı karşılaştırır. Birleştirmeyi geri alma özgün Inbox alanlarını döndürür ve hedeften sonraki ilgisiz düzenlemeyi silmez.

**Blocked by:** 01 — Hızlı yakalama ve Gelen Kutusu

**Status:** ready-for-agent

- [ ] Üç çıkıştan tam biri öğeyi tüketir; dördüncü örtük durum yoktur.
- [ ] Proje+tür kesin `Create Bug` doğrudan İş yoludur (01); bu ticket Inbox öğesi bırakmaz ve triage çıkışı uygulamaz.
- [ ] Dönüşüm tek onayda tam bir yeni ana kayıt ister ve Work/Document/File feature komutuna el verir; bu ticket o kaydı tamamlamış saymaz.
- [ ] Öneri görünür dayanak taşır; onay olmadan birleştirme, ilişki veya hedef değişimi yoktur.
- [ ] Başka Projedeki kayda bağlama önizlemesiz uygulanmaz; aynı Proje önerileri birincil, diğer Projeler adlı ikincil gruptadır.
- [ ] Dönüşüm önizlemesi özgün metin/bağlantı/görüntü ile önerilen kaydı ve mini şablon alan eşlemesini onaydan önce gösterir.
- [ ] Birleştirmeyi geri alma özgün Inbox alanlarını (metin, bağlantı, ek, tarih, köken) triage’a döndürür; hedeften yalnız bu birleşmenin yazdığı bağ/alan kalkar, sonraki ilgisiz düzenleme kalır.
- [ ] Kabul kanıtı Capture Inbox seam'inde üç çıkış, otomatik triage karşıtı, köken korunumu, birleştirme geri alması. Yakalama yolculuğunun triage paketi.
