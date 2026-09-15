# 01 — Kapalı katalog ve adlandırılmış eylem tanımı

**What to build:** Kurucu kapalı alan/üyelik adımlarından tek kayıt üzerinde çalışan adlandırılmış kayıt eylemi tanımlar. İlk örnek `Start Work`: durumu `In Progress` yap ve Günlük Odak'a ekle. Serbest script, harici çağrı, yeni kayıt üretimi ve çok kayıtlı düğme yoktur. Çöpteki tanım etkin çalışmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Adım kataloğu kapalıdır; JS, HTTP, yeni kayıt ve GitHub mutasyonu seçilemez.
- [ ] Eylem tek hedef kayıt içindir; çok kayıtlı birleşik düğme yoktur.
- [ ] Toplu alan düzenleme (22) bu katalogla karışmaz: çok kayıtta mevcut alan güncellemesi burada adlandırılmış birleşik eylem olmaz.
- [ ] `Start Work` durumu `In Progress` yapıp Günlük Odak üyeliğine ekler; Günlük Odak yüzeyi 27'dedir.
- [ ] Aktör `User` kalır; otomasyon kuralı gibi zincirlenmez.
- [ ] İngilizce UI `Record Action` ve `Start Work` kullanır.
- [ ] Kabul kanıtı Record Actions seam'inde: tanım, yasak adım karşıtı, tek hedef, toplu alan düzenleme yokluğu.
