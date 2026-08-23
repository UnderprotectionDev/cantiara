# 02 — Çözüm, yeniden etkinleştirme ve kaynak kapanışı

**What to build:** `Mark blocker resolved` çözüm tarihi ve isteğe bağlı not kaydeder; çözülmüş ilişki tarihsel kalır ve yeniden `Active` yapılabilir. Kaynak İş/Karar/Açık Soru kapanışı ilişkiyi otomatik çözmez; yalnız gerekçesi görünür bir çözüm önerisi üretebilir. GitHub PR birleşmesi sessiz çözüm değildir.

**Blocked by:** 01 — Aktif engelleme ilişkisi

**Status:** ready-for-agent

- [ ] `Mark blocker resolved` `Resolved` yazar; tarih ve isteğe bağlı not kaydedilir; aktif blokaj sinyalinden çıkar, geçmişte kalır.
- [ ] Çözülmüş ilişki yeniden `Active` yapılabilir; bu yeni sessiz gerçek değil aynı ilişkinin yaşamıdır.
- [ ] Kaynak kapanışı ilişkiyi `Resolved` yapmaz; öneri yazma değildir.
- [ ] GitHub merge, otomasyon veya üst İş kapanışı sessiz çözüm değildir.
- [ ] `Remove relation` çözümün yerine kullanılmaz; çözüm geçmişi ayrıdır.
- [ ] Kabul kanıtı Work Blockers seam'inde: çöz, yeniden etkinleştir, kaynak kapanışında Active kalma, merge karşıtı. Asgari kanıt [Blokaj](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ilişki yaşamıdır.
