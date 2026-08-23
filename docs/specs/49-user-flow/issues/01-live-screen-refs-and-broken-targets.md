# 01 — Canlı Ekran referansları ve kırık hedefler

**What to build:** Kullanıcı Akışı Proje tasarım ana kaydıdır. Ekranı temsil eden düğüm aynı Ekran kimliğine canlı kullanım bağı verir; kopya Ekran üretmez ve `Kökeni` değildir. Varsa seçilen güncel Wireframe sürümünün küçük önizlemesi ve tek eylemle o Ekranın Wireframe editörünü açma vardır. Akışa özgü metin düğümde kalır. Arşivli Ekran `Archived` ile açılır. Çöp, kalıcı silme veya erişilemezlikte kırık hedef içerik sızdırmaz ve başka Ekrana bağlanmaz.

**Blocked by:** None — can start immediately. Screen ids come from 48; a test double Screen is enough until that feature exists.

**Status:** ready-for-agent

- [ ] Düğüm Ekran kopyası üretmez; canlı kimlik referansıdır ve kullanım bağıdır, `Kökeni` değildir.
- [ ] Arşivli kaynak `Archived` gösterilir ve kaynağı açar.
- [ ] Kırık hedef boşalmaz, başka Ekrana kaymaz, gövde sızdırmaz; ortak kırık referans sunumu kullanılır; geri yükleme aynı kimliği çözer.
- [ ] Kırık referans arama sonucu, koleksiyon üyeliği, hesaplanmış sayı veya export içeriğine girmez.
- [ ] İngilizce UI `User Flow`, `Archived`, `Open Source Record` kullanır.
- [ ] Kabul kanıtı User Flow seam'inde: referans matrisi, arşiv ve kırık uç. Kanıt [Kullanıcı Akışı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğudur.
