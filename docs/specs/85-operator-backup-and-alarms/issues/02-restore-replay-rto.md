# 02 — Restore, güvenlik günlüğü replay, RTO, erişim kapısı

**What to build:** Geri yükleme birincil DB+manifest sonrası, ayrı kimlik bilgili append-only güvenlik olay günlüğünü (ADR-0019, aynı AB bölgesi) güncel sınıra kadar replay eder: kalıcı silme, redaksiyon, Dış yüzey/token/parola, kimlik doğrulamalı ve ziyaretçi oturum iptali, entegrasyon/anahtar rotasyonu. Replay ve bütünlük bitene kadar bütün dış erişim fail-closed. `RTO ≤ 8 saat`. Yeni irreversible eylem eşleşen restore kuralı ve testi olmadan yayımlanamaz. Günlük secret veya kullanıcı içeriği taşımaz. Hesap silme tombstone'u en uzun backup/restore penceresi + 30 gün sonra fiziksel silinir.

**Blocked by:** 01 — Yedek birimi: DB + nesne manifesti, RPO

**Status:** ready-for-agent

- [ ] Restore tatbikatı eski yedek + daha yeni iptal/redaksiyon/silme olayında erişimi kapalı tutar, replay eder, sonra hâlâ yetkisiz bırakır.
- [ ] Günlük birincil Neon restore ile geri alınmaz (ayrı proje/kimlik); AB bölgesindedir; secret/içerik yazmaz.
- [ ] Replay tamamlanmadan Dış yüzey, ziyaretçi oturumu veya origin/asset açılmaz.
- [ ] Restore mevcut ciphertext'i yerinde yeniden yazmaz; anahtar sürümü ciphertext ile durur (ADR-0019).
- [ ] RTO ≤ 8 saat aynı tatbikatta ölçülür. Kayıtlı olay tipleri (01/77/78/14/84/rotasyon) runner'a kayıtlıdır; kayıtsız yeni eylem kapı testini kırar.
- [ ] Kabul kanıtı restore tatbikatı + replay bütünlüğü. [Operasyonel kurtarma](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Ürün sürüm adayı kanıt madde 12 bu dilimi zorunlu kılar.
