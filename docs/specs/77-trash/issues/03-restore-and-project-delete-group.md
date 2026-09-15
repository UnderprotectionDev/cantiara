# 03 — Geri yükleme, Proje silme grubu tek süre ve süre sonu

**What to build:** `Restore` aynı iç kimliği ve kapsamı getirir; kısmi çocuk silme veya başka hedefe otomatik taşıma yoktur. Korunan yüzey geri yüklemede otomatik bağlanmaz. Proje silme grubu 30 günü tek birim izler; çocuk ayrı sürede kalıcı silinemez. Süre sonunda grup veya kayıt kalıcı silinir; etkin Dış yüzey ve kaldırılmamış hassas içerik varken kalıcı silme engellenir. `Trash` restore-point kütüphanesi değildir. Arşive dönüş 83'ün restore kuralıdır; bu ticket yaşayan kaydı yaşayan kapsama, gruba giren Projeyi ise 83'ün beklediği Arşiv durumuna kimlik koruyarak getirir — yeniden yayınlamaz.

**Blocked by:** 01 — Desteklenen kaydı Çöp Kutusuna alma ve 30 günlük kimlik; 02 — Dış yüzey önizlemesi, varsayılan iptal ve Keep approved surface

**Status:** ready-for-agent

- [ ] `Restore` aynı iç kimliği ve sahiplik kapsamını getirir; başka Proje/Çalışma Alanına taşımaz, yeni kimlik üretmez. Test Oturumu geri yüklemesi üst–alt bütünlüğü atomik getirir.

- [ ] Korunan Dış yüzey restore'da otomatik bağlanmaz; yeniden yayın yeni bağlama ve onay ister.
- [ ] Proje silme grubu tek 30 günlük süre izler; çocuk kayıt ayrı sürede kalıcı silinemez; süre sonu bütün gruba uygulanır.
- [ ] Süre sonu kalıcı silme, kaydı kullanan etkin Dış yüzey iptal edilip hassas içerik kaldırılmadan uygulanmaz.
- [ ] Yaşayan ilişkinin çöpteki ucu silinmiş hedef işareti gösterir; restore aynı kimliği yeniden bağlar. `Trash` restore-point veya Arşiv olarak sunulmaz.
- [ ] Kalıcı silme Denetim kaydına yalnız takma kimlik, olay türü, zaman ve aktör yazar; secret'siz irreversible güvenlik olayına eklenir. GitHub dış kaydı tombstone'u içeriksizdir (sağlayıcı, kararlı repo/kaynak kimliği, zaman, yerel takma).
- [ ] Kabul kanıtı Trash seam'inde restore kimliği, otomatik bağlanmama, grup tek süre, çocuk kalıcı silme karşıtı, restore-point yokluğu. Erişilebilirlik yolculuğunun Çöp Kutusu ve geri yükleme dilimi bu yüzeyden yürür.
