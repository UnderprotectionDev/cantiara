# 02 — Atomik kesinleştirme

**What to build:** Çok adımlı yazma canlı kayıtlardan yalıtılmış hazırlama alanına alınır ve tek commit bariyerinde kesinleşir. Sonuç yalnız tam commit veya tam rollback makbuzudur. Retry aynı işlemi bulur; değişmiş payload açık çatışmadır. Bariyerden sonra sahte `Cancel` yerine `Finalizing` görünür. Başarısız atomik işlem kısmi kayıt, ilişki, sayaç veya indeks bırakmaz.

**Blocked by:** 01 — İnsan komutu: taban revizyonu ve idempotency

**Status:** ready-for-agent

- [ ] Kesinleştirme taban, anahtar, parmak izi, yetki, kapsam ve kotayı yeniden doğrular ([ADR-0004](../../../adr/0004-atomik-idempotent-kesinlestirme.md)).
- [ ] Sonuç tam commit makbuzu veya tam rollback makbuzudur; kısmi ana kayıt kalmaz.
- [ ] Aynı işlem retry’si önceki sonucu döndürür; payload değişimi çatışmadır.
- [ ] Bariyer sonrası UI `Finalizing` gösterir; `Cancel` uygulanmaz.
- [ ] İngilizce `Finalizing`, `Conflict`, `Retry` PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı aynı Mutation Contract seam'inde çok adımlı başarı, rollback, retry, parmak izi çatışması, bariyer-sonrası iptal karşıtı. Mutasyon sözleşmesi yolculuğunun atomik paketi.
