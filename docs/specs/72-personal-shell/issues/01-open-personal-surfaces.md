# 01 — Kabuk dört kişisel yüzeyi konum kaybetmeden açar

**What to build:** Kurucu uygulamanın her yerinden Günlük Odak, Favoriler, Birleşik Bildirim Merkezi ve vadesi gelen `Look again` öğelerini açık Proje, kayıt ve kaynak görünüm konumunu kaybetmeden açar. Varsayılan geçici paneldir; `Open full page` vardır. Öğeyi seçmek kaynak kaydın kendi bağlamına döner. Kabuk üyelik yazmaz: Favori ekleme/çıkarma, Günlük Odak üyeliği, bildirim durumu ve Yeniden bak kaydı kendi feature'larındadır. Panel sıralaması planlama sırası üretmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Dört yüzey mevcut konum kaybolmadan açılır; varsayılan panel, açık eylem `Open full page`.
- [ ] Öğeyi seçmek kaynak bağlamına döner; kabuk kayıt kopyası veya ikinci liste yazmaz.
- [ ] Kabuğu açmak, dört yüzey arasında geçmek veya `Open full page` kullanmak Favori, Günlük Odak, bildirim veya Yeniden bak üyeliği yazmaz ve bildirimi okundu yapmaz; add/remove/read kendi feature listesinde kalır, kabuk chrome'u ikinci bir üyelik yazıcı değildir.
- [ ] Kabuk Akıllı Koleksiyon, çapraz Proje listesi veya ikinci Backlog değildir.
- [ ] İngilizce UI `Daily Focus`, `Favorites`, `Notification Center`, `Look again`, `Open full page` kullanır; eksik etiketler terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Personal Shell seam'inde: açma, konum korunumu, üyelik yazmama. Kanıt [kişisel bağlam](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun kabuk dilimidir.
