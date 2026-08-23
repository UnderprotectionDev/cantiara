# 04 — Gerekçeli iptal ve otomatik kapanmama

**What to build:** Kurucu `Cancel Handoff` ile gerekçeyi kaydederek devri `Canceled` yapar. Geçmiş silinmez. Aynı çalışma yeniden başlarsa eski devir açılmaz; yeni devir oluşur. Commit veya PR bağlanması, dış sonuç geldi sinyali veya İş durumunun değişmesi devri otomatik kapatmaz. Formel test Test Handoff’unda kalır; Dış Araca Kaçış ve yayın artefaktı yazılmaz. Dış insana görev verme yoktur.

**Blocked by:** 01 — Devir başlatma ve tarihli paket

**Status:** ready-for-agent

- [ ] `Cancel Handoff` gerekçe ister, durumu `Canceled` yapar ve geçmişi korur.
- [ ] İptal sonrası aynı iş için `Start Handoff` yeni bileşen üretir; iptal edilen devri yeniden açmaz.
- [ ] Commit/PR bağlama, “sonuç geldi” ve İş `Closed` geçişi `Reconciled` veya `Canceled` yazmaz.
- [ ] Bu yüzey Test Handoff paketi, Test Oturumu, yayın artefaktı veya Dış Araca Kaçış olayı üretmez; kodlama dönüşündeki serbest test notu resmî test geçmişine girmez.
- [ ] Dış insana inceleme veya görev verme bu bileşende açılmaz.
- [ ] Yalnız `Reconciled` ve `Canceled` terminaldir; `Open` ve `Result returned` açık kalır.
- [ ] Kabul kanıtı seam’de gerekçeli iptal sonrası yeni devir, PR/durum karşıtı ve Test Handoff ayrımı. Bu [Dış yürütme devri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun terminal ve ayrım paketidir.
