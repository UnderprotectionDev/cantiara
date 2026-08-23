# 02 — Proje Etkinliği, filtre ve önceki–sonraki değer

**What to build:** Kurucu mevcut kayıt geçmişlerinden türetilen `Project Activity` görünümünde kim, ne, eski değer, yeni değeri inceler. Görünüm İş, Belge, Karar, Risk, otomasyon ve GitHub kaynak türlerine; oluşturma, alan değişikliği, durum, arşiv, ilişki ve otomasyon olay türlerine göre filtrelenir. Her satır aktörü (kullanıcı, Sistem otomasyonu, GitHub) gösterir ve kaynak kaydı açar. Yeni kalıcı olay deposu, ikinci Denetim kaydı veya Bildirim Merkezi bölümü oluşmaz. Görünüm varsayılan Proje açılışı değildir.

**Blocked by:** 01 — Gerçekleşen olaylar zaman çizelgesi

**Status:** ready-for-agent

- [ ] `Project Activity` mevcut Kayıt geçmişini projekte eder; yeni kalıcı olay türü veya ikinci audit deposu yazmaz.
- [ ] Filtre kaynak türü ve olay türüne göre çalışır; satır aktör, zaman, kaynak ve desteklenen alanlarda önceki–sonraki değeri gösterir.
- [ ] İnsan, otomasyon ve GitHub aktörleri ayrı kalır; satır `Open source record` ile kaynağı açar.
- [ ] Secret önceki–sonraki olarak görünmez; redakte geçmiş içeriksiz işaret taşır.
- [ ] Etkinlik satırı Dikkat sinyali veya `Story Timeline` olayı üretmez; `Project Activity` varsayılan Proje açılışı veya `Notification Center` bölümü değildir.
- [ ] GitHub Activity veya e-posta günlüğü yüzeyi yoktur; GitHub satırları yalnız bağlı GitHub dış kaydı geçmişinden gelir.
- [ ] Kabul kanıtı aynı seam'de: filtre, aktör, önceki–sonraki, sinyal yokluğu, hikâyeden ayrılık. `What changed?` İngilizce etiketi terim sözlüğüne aynı değişiklikle eklenir.
