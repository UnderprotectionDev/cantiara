# 01 — Yedek birimi: DB + nesne manifesti, RPO

**What to build:** Hizmet operasyonel yedeği veritabanı ile özgün nesnelerin kesin manifestini tek mantıksal birim olarak alır. Hedef `RPO ≤ 5 dakika`. Yedek anahtar kapsamı üretim ve export'tan ayrıdır. Kullanıcıya restore-point, yedek takvimi veya uygulama içi geri yükleme yoktur. Çıkış paketi (82) ve Çöp Kutusu (77) bu birim değildir. Sağlayıcı/topoloji ayrı ürün karar kapısı açmaz; hedefleri karşılayan normal mühendislik seçimidir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Yedek birimi DB satırları ile R2/nesne manifestini aynı mantıksal noktada doğrular; tek taraf "başarı" sayılmaz.
- [ ] RPO ≤ 5 dakika sentetik tatbikatta ölçülür; günlük-yalnız 24 saat kayıp kabul edilmez.
- [ ] Ürün API'sinde restore-point listesi, yedek takvimi ve kurucu restore komutu yoktur.
- [ ] 82 paketi ve 77 Trash bu yedek birimi olarak kaydedilmez.
- [ ] Yedek, üretim ve export'tan ayrı döndürülebilir veri anahtarı kapsamı kullanır; üst anahtar sürümü ciphertext ile durur, rotasyon yerinde yeniden yazmayı zorlamaz ([ADR-0019](../../../adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md)).
- [ ] Kabul kanıtı Operator Backup and Alarms seam'inde birim bütünlüğü ve RPO. [Operasyonel kurtarma](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yedek dilimi. Replay 02'dedir.
