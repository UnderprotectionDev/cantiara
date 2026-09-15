# 02 — WireframeDocument motoru ve semantik düzenleme

**What to build:** Kalıcı doğruluk sürümlü `WireframeDocument`'tir; Konva JSON'u belge formatı değildir. Semantik bileşenler (Button, Input, Card, Table, Navigation, Chart) kanonik geometri ve anlam taşır; Rough.js yalnız çizimdir. Proje kapsamlı bağlı block'lar kaynak tanımını paylaşır; değişiklik etkilenen Ekranları önizler; `Detach Link` o andaki içeriği bağımsız block'a dondurur. Metin block'u yer tutucu veya canlı Markdown bölüm referansı olabilir; kırık referans boşalmaz. Tiptap ikinci metin modeli değildir. Production component, token ve Figma yoktur.

**Blocked by:** 01 — Ekran ana kayıt yaşamı

**Status:** ready-for-agent

- [ ] `WireframeDocument` yuvarlak gezi kalıcıdır; `Konva.Stage.toJSON()` kabul edilen format değildir.
- [ ] Semantik bileşenler rastgele primitive grup değildir; hit-test ve snap kanonik geometri ve sabit seed kullanır.
- [ ] Bağlı block değişikliği etkilenen Ekranları önizler; `Detach Link` bağımsız kopya üretir; çapraz proje canlı kütüphane yoktur.
- [ ] Canlı metin referansı kırıkta boşalmaz; kaydedilmiş sürüm o anki metni tarihsel tutar.
- [ ] Excalidraw/tldraw/Tiptap belge modeli yoktur; Shantell Sans canvas tipografisidir, ürün UI'ı değildir.
- [ ] Kapalı animasyon kümesi (göster/gizle, sabit süreli iki durum, hover/press, sıralı adım, Ekran geçişi) dışındaki timeline/keyframe yoktur.
- [ ] Kabul kanıtı aynı seam'de: belge round-trip, Konva JSON reddi, detach önizlemesi, kırık metin, yasak motor yokluğu.
