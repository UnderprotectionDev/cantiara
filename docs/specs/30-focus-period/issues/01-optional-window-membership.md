# 01 — 1–8 haftalık pencere, üyelik durum yazmaz

**What to build:** Kurucu amaç ve başlangıç/bitiş tarihiyle 1–8 haftalık isteğe bağlı `Focus Period` açar. Farklı Projelerden İş eklemek durum veya proje aşamasını değiştirmez. Kullanım zorunlu değildir; kadans, velocity veya kapasite puanı yoktur. Dönem Kilometre Taşı, Proje Sürümü veya Günlük Odak değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Dönem 1–8 hafta dışında oluşturulamaz; amaç ve tarihler durur.
- [ ] Üyelik ekleme/çıkarma İş akışı durumunu ve proje aşamasını yazmaz.
- [ ] Yaşam `Planned` / `Active` / `Closed` / `Canceled` ile yürür; sprint semantiği yoktur. `Planned` → `Active` başlangıç anı gelince olur (pencere o anda çalışma penceresidir); üyelik yine İş durumunu yazmaz. `Closed` kapanış-kapsamı snapshot’ı ve açık-iş toplu kararını çalıştırır. `Canceled` (`Planned` veya `Active`’ten) kapanış-kapsamı snapshot’ı ve leftover toplu kararını yazmaz; varsa başlangıç snapshot’ı tarihsel kalır; üyelikler İş durumu yazmadan tarihsel kalır; İş artık etkin dönemde değildir.
- [ ] Kabul kanıtı Focus Period seam’inde süre sınırı ve üyelik karşıtı. Kanıt [Odak Dönemi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
