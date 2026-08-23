# 02 — İsteğe bağlı kimlik ve İşe dönüşüm

**What to build:** Geri Bildirim isteğe bağlı Contact ve Company taşıyabilir; bilinmeyen gönderen Contact oluşturmaya zorlanmaz. Birden fazla Geri Bildirim aynı İşe ayrı köken olarak bağlanabilir; oy veya otomatik öncelik değildir. `Convert to Work` tam olarak bir İşi, hedef Projeyi, başlık/gövde eşlemesini ve `Kökeni` bağını önizler; onay kaydı silmeden tek İş üretir.

**Blocked by:** 01 — Geri Bildirim ana kaydı

**Status:** ready-for-agent

- [ ] Contact/Company isteğe bağlıdır; kayıt Contact olmadan kaydedilir.
- [ ] Aynı İşe birden fazla Geri Bildirim ayrı köken olarak bağlanır; sayı oy veya öncelik talimatı değildir.
- [ ] `Convert to Work` önizlemesiz ana kayıt üretmez; onay tam olarak bir İş açar ve Geri Bildirimi silmez veya arşivlemez.
- [ ] AI yoktur; tek eylemde çoklu gizli kayıt yoktur; İş alan kuralları atlanmaz.
- [ ] Kabul kanıtı aynı seam'de: Contact zorunluluğu karşıtı, çoklu köken, dönüşüm önizlemesi, kayıt kalıcılığı.
