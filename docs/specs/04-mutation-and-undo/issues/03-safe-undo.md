# 03 — Güvenli geri alma

**What to build:** Güvenli geri alma yalnız tersi deterministik hesaplanan alan, ilişki, görünüm üstverisi ve atomik dönüşümlerde çalışır. İlgisiz sonraki değişikliği silmez; aynı alandaki daha yeni değerde durur ve açıklar. Kalıcı silme, güvenlik redaksiyonu, dış sistem mutasyonu ve yayınlanmış statik export otomatik geri alınamaz. Birleştirmeyi geri alma özgün kimliği ayırır; birleştirmeden sonraki ilgisiz yazmaları silmez.

**Blocked by:** 01 — İnsan komutu: taban revizyonu ve idempotency; 02 — Atomik kesinleştirme

**Status:** ready-for-agent

- [ ] Deterministik tersi olan alanda `Undo` uygulanır; ilgisiz sonraki düzenleme aynı kalır.
- [ ] Genel undo yığını her eyleme yayılmaz; yalnız tersi deterministik hesaplanan işler `Undo` alır.
- [ ] Aynı alandaki daha yeni değerde undo durur ve çatışmayı gösterir; sessiz ezme yoktur.
- [ ] Kalıcı silme, redaksiyon, dış sistem ve yayınlanmış export undo komutuyla uygulanmaz.
- [ ] Birleştirme geri alması emekli kimliği ana kayıt yapar ve yalnız birleştirmeye atfedilen değer/ilişkiyi ayırır.
- [ ] İngilizce `Undo` PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Mutation Contract seam'inde sarmama, aynı-alan çatışması, yasak sınıfların reddi, birleştirme geri alması. Kapalı erişilebilirlik yolculuğu **kayıt oluşturma, düzenleme, çatışma, geri alma** bu yüzeyden yürür.
