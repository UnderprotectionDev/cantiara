# 02 — Blokaj rozeti, planlanmamış adaylar, Sunum Kipi

**What to build:** Roadmap aktif blokajı kompakt rozetle gösterir; seçince engellenen kayıt ve kesin engel kaynağı açılır. Sürekli ağ, otomatik yeniden zamanlama veya kritik yol yoktur. Varsayılan daraltılmış `Unplanned candidates` görünüm filtrelerine uyan fakat tarih ve ufku olmayan İşleri canlı gösterir. Plana alırken değişecek tarih veya ufuk önizlenir ve onay istenir; durum örtük yazılmaz. `Presentation Mode` mevcut adlandırılmış görünümü salt okunur tam ekranda açar; ikinci kopya, slayt veya sunum kaydı yoktur. Herkese açık snapshot bu ticket’ta yoktur.

**Blocked by:** 01 — Ufuk yerleşimi durum ve sıra yazmaz

**Status:** ready-for-agent

- [ ] Rozet iki kaynağı açar; yeni blokaj ilişkisi veya kritik yol üretmez.
- [ ] Adayı plana alma önizlemeli onaydır; Parked durumu veya ikinci üyelik oluşmaz.
- [ ] `Presentation Mode` çıkışta aynı görünüm ve konuma döner; içerik kopyası yoktur.
- [ ] Public HTML, public durum etiketi ve PNG/Gantt export yoktur.
- [ ] Kabul kanıtı seam’de rozet, aday onayı, Sunum Kipi kopya karşıtı. Bu [Roadmap](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun rozet ve kip paketidir.
