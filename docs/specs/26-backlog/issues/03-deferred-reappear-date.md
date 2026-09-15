# 03 — Deferred yeniden görünme tarihi

**What to build:** Gelecek `Reappear date` taşıyan İşler varsayılan Backlog görünümünde `Deferred` bölümündedir. Tarih İş durumunu, önceliğini veya proje aşamasını değiştirmez. Tarih gelince İş kaydedilmiş manuel sırasındaki konumuna döner ve Günlük Odak adayında görünebilir; aday olmak Backlog veya Odak üyeliği değildir.

**Blocked by:** 02 — Tek kalıcı manuel sıra

**Status:** ready-for-agent

- [ ] Gelecek tarih varsayılan görünümde `Deferred` bölümüne ayırır; durum yazılmaz.
- [ ] Tarih gelince İş saklı manuel konumuna döner; sıra kaybolmaz.
- [ ] Tarih gelişi Günlük Odak üyeliği veya Backlog’tan çıkarma yazmaz; aday görünümü Odak feature’ındadır.
- [ ] Kabul kanıtı seam’de saat ilerletme ile Deferred→sıra dönüşü ve durum karşıtı. Kanıt [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun tarih paketidir.
