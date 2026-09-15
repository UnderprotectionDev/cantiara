# 02 — Yayılım: güncel, geçmiş, yüzey, arama, export, cache

**What to build:** Onaylanan redaksiyon hassas değeri güncel içerikten, bütün kayıt geçmişi revizyonlarından, Dış yüzey Onaylı snapshot revizyonlarından, arama indekslerinden, dışa aktarma hazırlıklarından ve cache'lerden geri döndürülemez kaldırır. İçeriksiz işaret özgün olay türü, zaman ve aktörü korur; ad, e-posta, özgün mesaj veya secret yazılmaz. Dış yüzey redaksiyonu yayın erişimini yeniden açamaz. Kayıt kimliği bu işlemle durmak zorunda değildir.

**Blocked by:** 01 — Önizleme, grant tüketimi ve yazılan hedef adı

**Status:** ready-for-agent

- [ ] Apply sonrası değer güncel okuma, geçmiş revizyon, snapshot, arama sonucu, export hazırlığı ve cache yoluyla elde edilemez.
- [ ] Tombstone içeriksizdir: olay türü, zaman, aktör, gerekçe; ad/e-posta/mesaj/secret/alan değeri yoktur. Kırık referans son gövdeyi göstermez.
- [ ] Snapshot redaksiyonu Dış yüzeyi yeniden `Aktif` yapmaz, URL/token üretmez, ziyaretçiye eski değeri sunmaz.
- [ ] Secret sınıflı değer arama, export, paylaşım veya yayın yoluna hiç girmez; sızmış kopya da yayılım kümesindedir.
- [ ] Apply kaydı `Trash`'e almaz, Arşivlemez ve kimliği durdurmak zorunda değildir; redaksiyon Çöp Kutusu değildir.
- [ ] Kabul kanıtı Security Redaction seam'inde her yayılım hedefi için pozitif kaldırma ve yüzey-reaktivasyon karşıtı. Test geçmişi kanıt yasağı 03'tedir.
