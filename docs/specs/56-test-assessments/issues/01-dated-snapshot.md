# 01 — Tarihli değerlendirme snapshot'ı

**What to build:** Kurucu seçili Özellik, Handoff veya Proje Sürümü bağlamı için Test değerlendirmesini isteğe bağlı tarihsel snapshot olarak kaydeder. Snapshot incelenen kesin Test Oturumlarını, açık Test Açıklarını, takip işlerini, bilinen sınırlamaları, değerlendireni ve zamanı taşır. Kayıt Test Oturumu sonucu değildir ve oturum inceleme durumunu yazmaz.

**Blocked by:** None — can start immediately. Session/Gap ids can be test doubles.

**Status:** ready-for-agent

- [ ] Snapshot tam olarak bir bağlam (Özellik, Handoff veya Proje Sürümü) ve kesin kaynak kimlikleri taşır.
- [ ] Oturum sonucu veya inceleme durumu yazılmaz.
- [ ] İngilizce UI `Test Assessment` kullanır; eksik etiket PRD sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Test Assessments seam'inde: tarihli kayıt, oturum yazmama. Kanıt [Test geçmişi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) değerlendirme snapshot testidir.
