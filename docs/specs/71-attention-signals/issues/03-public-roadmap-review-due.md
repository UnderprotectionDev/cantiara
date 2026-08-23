# 03 — İsteğe bağlı herkese açık Roadmap inceleme süresi

**What to build:** Kurucu Proje bazında aktif herkese açık Roadmap kayıtları için 7–180 tam gün aralığında isteğe bağlı inceleme süresi tanımlar. Varsayılan yoktur; değer girilmeden `public-roadmap-review-due` üretilmez. Son onaylı herkese açık snapshot süre boyunca yenilenmemişse sinyal `Action Required`'da durur. Aynı kayıt için yeni Onaylı snapshot revizyonu olmadıkça süre başına en fazla bir sinyal oluşur. Tamamlanmış veya kapatılmış herkese açık kayıtlar kapsanmaz. Sinyal iç durumu, herkese açık etiketi veya yayın snapshot'ını değiştirmez.

**Blocked by:** 01 — Kapalı registry ve Action Required / Information Flow

**Status:** ready-for-agent

- [ ] Süre yoksa sinyal yoktur; süre `[7, 180]` tam gündür.
- [ ] Yalnız aktif herkese açık etiketli Roadmap kayıtları adaydır; tamamlanmış/kapatılmış public kayıtlar kapsanmaz.
- [ ] Snapshot yenilenmeden süre başına en fazla bir `public-roadmap-review-due` oluşur; yeni onaylı snapshot sonraki süreyi sıfırlar.
- [ ] Sinyal iç İş akışı durumu, Herkese açık durum etiketi veya Onaylı snapshot revizyonunu yazmaz.
- [ ] Bu kimliğin üretim kuralı bu feature'dadır; diğer kimliklerin tetikleri kopyalanmaz.
- [ ] Kabul kanıtı Attention Signals seam'inde: sessizlik, aralık, tekilleştirme, kapanmış public karşıtı, mutasyon yokluğu. Yolculuk matrisinin isteğe bağlı public inceleme dilimidir.
