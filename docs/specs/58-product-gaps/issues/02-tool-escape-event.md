# 02 — Dış Araca Kaçış olayı

**What to build:** `Record Product Gap` tarihli Dış Araca Kaçış olayı yazar; kurucu yeni boşluk açar veya mevcut boşluğa bağlar. Olay gerçekleşme zamanı, kaynak Proje/kayıt bağlamı, yapılmak istenen iş, dış araç, kapalı nedenler (`Missing capability`, `Faster`, `More reliable`, `Usability`, `Habit`) ve isteğe bağlı not taşır. Dış içerik kopyalanmaz; dış oturum izlenmez. Olay GitHub bağlantısı, Test Handoff'u veya Dış yürütme devri değildir. Aynı boşluktaki tekrar sayısı yalnız kayıtlı olaylardan türetilir ve o kesin kümeyi açar; öncelik, puan, İş veya bildirim yazmaz. Dogfooding özeti araç, neden, proje ve duruma göre filtreler.

**Blocked by:** 01 — Ürün Boşluğu yaşam döngüsü

**Status:** ready-for-agent

- [ ] Her kaçış boşluğa bağlı tarihli olaydır; gerçekleşme zamanı, kaynak bağlam, yapılmak istenen iş, dış araç, kapalı nedenler ve isteğe bağlı not korunur; dış içerik ve oturum kopyası yoktur. Etki ayrı şiddet/`High-impact` bayrağı olarak saklanmaz.
- [ ] Yeni boşluk veya mevcut boşluğa bağ bilinçli seçimdir; başlık benzerliği birleştirmez.
- [ ] Olay 61/53/24 yazmaz; karşıt test bu seam'lerin çağrılmadığını gösterir.
- [ ] Tekrar sayısı kesin olay kümesini açar; karar veya sıralama gerçeği değildir.
- [ ] Kabul kanıtı aynı seam'de: olay alanları, bağ seçimi, türetilmiş sayı, GitHub/Handoff/devr karşıtı.
