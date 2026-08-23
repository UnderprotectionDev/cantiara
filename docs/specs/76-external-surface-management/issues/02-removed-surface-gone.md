# 02 — Kaldırılan yüzey içerik ve analitiksiz 410

**What to build:** Dizinden `Revoke / Unpublish` veya `Move to Trash` aynı Dış yüzey yaşam döngüsünü kullanır; yumuşak ikinci iptal yoktur. Kaldırılan yüzeyin eski URL'si içerik ve varlık sızdırmayan genel `410 Gone` döner, `noindex` olur, sitemap'ten çıkar, yeni yüzeye veya özel içeriğe yönlenmez ve yeniden kullanılmaz. Ürün kontrollü cache/index temizliği görünür yeniden denemeyle yürür; purge başarısızlığı içeriği yeniden açmaz. Görüntülenme analitiği üretilmez. Ziyaretçi oturumu hemen düşer. Üçüncü taraf kopyaların gittiği vaat edilmez.

**Blocked by:** 01 — Bütün Dış yüzeylerin tek dizini

**Status:** ready-for-agent

- [ ] Dizinden iptal 73/74/75 ile aynı terminal geçiştir; URL/token başka satırda yeniden doğmaz.
- [ ] Eski URL HTML, Dosya Eki ve range için gövdesiz `410 Gone` + `noindex` döner; özel içeriğe veya yeni yüzeye redirect yoktur.
- [ ] Sitemap düşer; purge isteği durum/retry gösterir; purge hatası erişimi geri açmaz; üçüncü taraf kopyanın gittiği vaat edilmez.
- [ ] Çöp Kutusu ve kalıcı silme ziyaretçiye içerik veya görüntülenme sayısı sızdırmaz.
- [ ] Kabul kanıtı aynı seam'de: 410, boş gövde, URL reuse reddi, range, sayaç yokluğu. PRD 15 iptal-cache karşıtı bu dizin eylemi üzerinden de gözlenir.
