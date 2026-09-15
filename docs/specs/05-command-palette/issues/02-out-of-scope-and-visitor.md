# 02 — Kapsam dışı başarısızlık ve ziyaretçi yokluğu

**What to build:** Desteklenmeyen veya bu bağlamda çalışmayan komut açıkça başarısız olur; gizli no-op ve yazma yoktur. Dış yüzey ve Paylaşım erişim oturumu kurucu paletini yüklemez. Yalnız klavye ile açma, süzme, çalıştırma ve kapatma tamamlanır.

**Blocked by:** 01 — Her kurucu bağlamından palet komutları

**Status:** ready-for-agent

- [ ] Kapsam dışı komut görünür hata verir (`Can’t run this here` / `No matching command`) ve yazmaz.
- [ ] Ziyaretçi Dış yüzey şablonunda ve Paylaşım erişim oturumunda palet yoktur.
- [ ] Palet IDE pazarı, script veya otomasyon kuralı sunmaz.
- [ ] Yalnız klavye yolculuğu paleti açar, komut süzgeçler, çalıştırır ve kapatır.
- [ ] Kabul kanıtı aynı Command Palette seam'inde no-op karşıtı, ziyaretçi yokluğu, klavye. Komut Paleti yolculuğunun kapsam ve erişilebilirlik paketi; kapalı **Proje gezinme ve arama** palet yarısı.
