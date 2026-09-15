# 02 — Atomik, döngüsüz, tek halef yerine geçirme

**What to build:** `Supersede another decision` yeni veya mevcut `Valid` Kararı bir veya birden fazla eski Kararın doğrudan ve tek halefi yapar. Önizlemeden sonra tek atomik işlem ilişkiyi kurar ve eskileri `Superseded` yapar. Döngü, öz-bağ ve çelişkili fork reddedilir. İlişkiler yeni Karara kopyalanmaz veya taşınmaz; bağlı kayıtların durumu yazılmaz.

**Blocked by:** 01 — Karar yaşamı Geçerli, yerine geçilmiş, geri çekilmiş

**Status:** ready-for-agent

- [ ] Önizleme yeni/eski gerekçe-kanıt özeti, değişecek yaşamlar ve isteğe bağlı geçiş gerekçesini gösterir; onay taban revizyonu ve idempotency anahtarıyla tek commit’tir (ADR-0004).
- [ ] Her eski Kararın en fazla bir doğrudan halefi vardır; yeni Karar uyumlu birden fazla eskiye aynı commit’te tamamen yerine geçebilir.
- [ ] Döngü, kendine bağ ve çelişkili fork uygulanmadan reddedilir. Kısmi değişiklik tam yerine-geçme değildir.
- [ ] Yerine geçme bağlı İş/Risk/Varsayım/test/sürüm ilişkilerini kopyalamaz veya taşımaz; onların durumu, önceliği, planlaması değişmez. `Contradicting` kanıt bu akışı başlatmaz.
- [ ] İlişki kaldırma önizlemelidir; eski Karar yalnız başka doğrudan halefi yoksa açık onayla yeniden `Valid` olur. Yeni Karar silinmez.
- [ ] Kabul kanıtı aynı seam’de: atomik başarı, iki güncel Karar bırakmama, döngü/fork reddi, durum yazmama, idempotent tekrar.
