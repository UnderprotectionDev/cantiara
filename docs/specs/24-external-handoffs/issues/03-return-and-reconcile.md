# 03 — Dönüş kaydı ve uzlaştırma

**What to build:** Dış çalışma dönünce kurucu yürütücü özetini, değişen varsayımları, üretilen kanıt veya izinli dış bağlantıları ve kapanmamış soruları aynı devre kaydeder; durum `Result returned` olur. `Reconcile` ana kayıtlara kurulacak kesin ilişkileri ve açıkça oluşturulacak takip İşlerini önizler. Devir metni onaydan önce Karar, Risk, İş, ilişki veya kanıt üretmez. Onay seçilen bağları tarihsel uzlaştırma kararıyla `Reconciled` yapar; red yazmaz. Bu uzlaştırma içe aktarma sihirbazı veya Git birleştirmesi değildir.

**Blocked by:** 01 — Devir başlatma ve tarihli paket

**Status:** ready-for-agent

- [ ] Dönüş kaydı aynı devirde durur ve durumu `Result returned` yapar; İş akışı durumunu değiştirmez.
- [ ] `Reconcile` kurulacak ilişkileri ve takip İşlerini önizler; onaylanmayan parça yazılmaz.
- [ ] Onaysız devir metni Karar, Risk, İş, ilişki veya kanıt üretmez.
- [ ] Önizlemesiz dönen dosya veya metin ana kayıt, alan veya ilişki yazmaz.
- [ ] Onay atomiktir: seçilen küme yazılır ve durum `Reconciled` olur, ya da hiçbir kayıt oluşmaz.
- [ ] Uzlaştırma içe aktarma sihirbazı veya Git birleştirmesi değildir; kısmi yazma gizli kalmaz.
- [ ] Kabul kanıtı seam’de geç dönüş, önizleme, kısmi seçim, onay ve red. Kanıt [Dış yürütme devri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun uzlaştırma paketidir.
