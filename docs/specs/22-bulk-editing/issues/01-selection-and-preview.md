# 01 — Seçim ve alan farkı önizlemesi

**What to build:** Kurucu liste, Kanban, Akıllı Koleksiyon ve benzeri çok kayıtlı yüzeylerde açıkça seçtiği İşlerin mevcut alanlarını toplu güncellemek için fark önizlemesi görür. Seçilmeyen kayıt dokunulmaz. Seçimsiz “bütün kayıtlar” yazması yoktur. Şema göçü, yeni alan ve içe aktarma yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Yalnız seçilen İşler hedef olur; filtre sonucu örtük seçim değildir.
- [ ] Önizleme uygulanacak mevcut alan değişikliklerini gösterir; onay olmadan yazma yoktur.
- [ ] Yeni alan tanımı, şema göçü ve kayıt oluşturma yoktur.
- [ ] `Closed` durumuna toplu geçiş kapanış sonucu adımını atlamaz; yaşam döngüsü kuralı çağrılır.
- [ ] İngilizce UI `Bulk Edit` kullanır.
- [ ] Kabul kanıtı Bulk Editing seam'inde: seçim, önizleme, seçilmeyene dokunmama, şema/import yokluğu.
