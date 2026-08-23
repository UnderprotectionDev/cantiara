# 01 — Ürün Boşluğu yaşam döngüsü

**What to build:** Kurucu `Record Product Gap` (`Ürün boşluğu kaydet`) ile Çalışma Alanı ana kaydı Ürün Boşluğu oluşturur. Durum PRD 02 ile eşlenir: `Açık`/`Open`, `Değerlendiriliyor`/`Evaluating`, `Karşılandı`/`Met`, `Bilinçli sınır`/`Conscious boundary`; kurucu durumu kendisi değiştirir. Tekrar sayısı (02'de olaylardan türetilir) durumu yazmaz. Boşluk İş değildir; isteğe bağlı önizlemeli takip İşi veya Özellik ilişkisi açılabilir, kendiliğinden dönüşmez. Benzer başlıklar birleşmez. Durum değişimi geçmiş kaçış olaylarını veya bağlı kayıt yaşamını yazmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `Record Product Gap` Workspace kapsamında Ürün Boşluğu yazar; otomatik telemetry veya tarayıcı izleme yoktur.
- [ ] Kapalı durum kataloğu PRD 02 ile birebir eşlenir: `Açık`/`Open`, `Değerlendiriliyor`/`Evaluating`, `Karşılandı`/`Met`, `Bilinçli sınır`/`Conscious boundary`; tekrar sayısı durum yazmaz.
- [ ] Durum değişimi geçmiş kaçış olaylarını yeniden yazmaz ve bağlı Proje/İş/Özellik/Karar yaşamına yazmaz.
- [ ] Boşluk İş/özellik isteği değildir; takip İşi yalnız önizleme ve onayla oluşur.
- [ ] Benzer başlık birleştirilmez; paylaşım kapalı dünya önizlemesi olmadan görünmez.
- [ ] Boşluk ve olay normal arama, ilişki, geçmiş ve içe/dışa aktarmaya katılır; ikinci indeks yoktur.
- [ ] İngilizce etiketler PRD terim sözlüğüne ilk gösterimde eklenir; Türkçe PRD terimi UI copy olmaz.
- [ ] Kabul kanıtı Product Gaps and Tool Escapes seam'inde: oluşturma, durum matrisi, otomatik dönüşüm yokluğu. [Dogfooding](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) boşluk paketidir.
