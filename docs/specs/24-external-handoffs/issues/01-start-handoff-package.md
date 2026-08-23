# 01 — Devir başlatma ve tarihli paket

**What to build:** Kurucu bir İşte `Start Handoff` ile test-dışı bir Dış yürütme devri başlatır. Devir o İşe ait sahipli bileşendir; amaç, beklenen çıktı, yürütücü görünen adı, kısıtlar ve seçilen kesin sürümler orada durur. Gidiş paketi yalnız seçilen manifestten okunabilir Markdown’dır; üretim zamanı, İş anahtarı, devir kimliği ve `Source of truth is in the app` taşır. Secret, erişilemeyen alan ve seçilmeyen kayıt girmez. Paket canlı senkron veya repository kopyası değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `Start Handoff` İş üzerinde Dış yürütme devri oluşturur; bağımsız aranabilir/paylaşılabilir Handoff ana kaydı oluşmaz.
- [ ] Amaç, beklenen çıktı veya kabul beklentisi, yürütücü görünen adı, kısıtlar ve seçilen kesin İş/Belge/Karar/Risk/Açık Soru/Kaynak sürümleri ile izinli GitHub bağlamı bileşende durur.
- [ ] Paket yalnız seçilen kesin sürüm manifestinden Markdown üretir; secret ve seçilmeyen ilişki kapsama katılmaz.
- [ ] Paket üretim zamanı, İş anahtarı, devir kimliği ve `Source of truth is in the app` taşır; İngilizce UI `External Execution Handoff` ve `Start Handoff` kullanır.
- [ ] Durum `Open` olur; ürün harici ajan, IDE, terminal, repository veya CI başlatmaz ve dış araç oturumunu otomatik telemetry ile izlemez.
- [ ] Paket canlı senkron, repository kopyası veya yayın artefaktı değildir.
- [ ] Kabul kanıtı External Execution Handoff seam’inde: bileşen İşe bağlıdır, paket seçim dışını içermez, ana kayıt oluşmaz. Kanıt [Dış yürütme devri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun gidiş paketine bağlanır.
