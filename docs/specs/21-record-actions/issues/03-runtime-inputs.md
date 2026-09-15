# 03 — Çalışma anı girdileri

**What to build:** Eylem tanımı çalışma anında yalnız `Date`, `Number`, `Select` veya mevcut ana kayıtla `Relation` isteyebilir. Girdiler tasarımda önceden tanımlanır. Kurucu çalıştırmadan önce seçtiği değerleri ve hedef kayıtta oluşacak kesin değişiklikleri birlikte önizler. Formül, serbest metin makro veya yeni kayıt seçimi yoktur.

**Blocked by:** 01 — Kapalı katalog ve adlandırılmış eylem tanımı; 02 — Önizleme ve tek atomik uygulama

**Status:** ready-for-agent

- [ ] Girdi türleri kapalıdır: `Date`, `Number`, `Select`, `Relation` (mevcut ana kayıt).
- [ ] Çalıştırma öncesi değerler ve kayıt farkı birlikte görünür; girdi olmadan yazma yoktur.
- [ ] Girdi yeni kayıt üretmez, script çalıştırmaz veya ikinci hedef seçmez.
- [ ] Kabul kanıtı Record Actions seam'inde: dört girdi türü, önizleme birliği, yasak girdi karşıtı.
