# 02 — Review Later, Belge bölümü ve açık kalma koşulu

**What to build:** `Review Later` aynı Hatırlatma kaydıdır. Belgede isteğe bağlı hedef kararlı Markdown başlık kimliğidir; yeniden adlandırma kimliği izler, silinmiş bölüm sessizce başka başlığa kaymaz. Açık/çözülmüş yaşamı ürün tarafından tanımlı kaynakta kurucu `In any case` veya `Only if still open` seçer; varsayılan `In any case`’tir. Koşul genel sorgu oluşturucu değildir.

**Blocked by:** 01 — Desteklenen kayda kişisel hatırlatma

**Status:** ready-for-agent

- [ ] `Review Later` 01’deki aynı Hatırlatma satırını kullanır; oluşturan eylem `Review Later` olur; ikinci tür veya kuyruk açılmaz.
- [ ] Belge hedefi kararlı bölüm kimliğidir. Başlık adı veya konum değişince bağ aynı kimliği izler.
- [ ] Bölüm silinince veya çözülemeyince Belge açılır, kayıp hedef açıklanır, başka başlığa sessiz yönelme yoktur.
- [ ] `Only if still open` yalnız zamanı gelince kaynağın açık/çözülmüş yaşamını okur; varsayılan `In any case` mevcut koşulsuz semantiği korur.
- [ ] Proje Sürümü `Reassess impact` tarih seçince bu aynı `Review Later` çağrısını kullanabilir; gözlem alanları ve eksik-gözlem sinyali bu ticket’ta yoktur.
- [ ] Kabul kanıtı aynı seam’de: bölüm izleme, kayıp bölüm, varsayılan koşul, `Only if still open` tanımı. `Target date` ve Yeniden görünme tarihi hâlâ yazılmaz; `Review Later` `due-date` üretmez.
