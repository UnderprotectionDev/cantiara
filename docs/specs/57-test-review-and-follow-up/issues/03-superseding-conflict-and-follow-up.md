# 03 — Yerine geçme, çelişki, bağlam değişikliği ve takip işi

**What to build:** Kurucu kesin Oturum Testleri arasında döngüsüz `Supersedes` / `Superseded` ilişkisi kurar; yeni sonuç eskisini silmez. Aynı senaryo sürümünde farklı normalize sonuç ve açık yerine-geçme yoksa `test-result-conflict` doğar; sistem kazanan seçmez ve metin benzerliğiyle eşlemez. Kullanıcı geçerli sonucu bağlayınca sinyal kapanır. Bağlı spec sürümü veya kayıtlı branch/commit/build uyuşmazlığında `Context changed` görünür; salt zaman veya ilgisiz commit staleness değildir; otomatik Test Açığı veya Handoff oluşmaz. `Failed` / `Blocked` / `Inconclusive` otomatik Bug/İş üretmez. `Create follow-up work` hedefi, `Originates from` ve `Origin Location` bağlarını onaydan önce gösterir.

**Blocked by:** 01 — Oturum ve madde incelemesinin bağımsız yaşamı

**Status:** ready-for-agent

- [ ] `Supersedes` aynı uzman türde döngüsüzdür; her iki tarihsel sonuç ve teknik bağlam farkı özetlenir, silinmez.
- [ ] Aynı kesin senaryo sürümünde farklı normalize sonuç + ilişki yokluğu `test-result-conflict` üretir; last-write-wins yoktur; benzer başlık eşlemez; kullanıcı geçerli sonucu bağlayınca sinyal kapanır.
- [ ] Çelişki, bağlam değişikliği veya olumsuz sonuç Test Açığı üretmez; açık 55'te kullanıcı işidir.
- [ ] `Context changed` yalnız açıklanabilir spec/commit/build farkındadır; eski sonucu failed/stale yapmaz; yeni Handoff üretmez.
- [ ] Olumsuz sonuç otomatik kayıt veya öncelik yazmaz; takip İşi yalnız önizlemeli açık eylemdir; `Originates from` sahip Test Oturumuna, Köken konumu kesin Oturum Testi öğesine kilitlenir.
- [ ] Birden fazla sonuç aynı kök nedene ait tek mevcut İşe bağlanabilir; o İşin kapanışı tarihsel sonucu `Passed` yapmaz; doğrulama yeni Test Oturumu ve isteğe bağlı yerine-geçme ister.
- [ ] Kabul kanıtı Test Review seam'inde: yerine-geçme, çelişki, last-write-wins karşıtı, bağlam sinyali, takip önizlemesi, otomatik açık yokluğu.
