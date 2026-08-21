# Test Handoff'ları

Kurucu dış test çalışması için sürümlü Markdown ve JSON paketini yürütücüye göre ayrı Handoff yaşam döngüsünde hazırlar. Ürün testi başlatmaz veya izlemez.

Dış yürütücü neyi koşacağını donmuş paketten alır. Cantiara bu paketi izleme veya uzaktan koşturma platformu olmaz.

Bu feature test handoff'larını tamamlar. Dış yürütme devri, test raporu kabulü ve GitHub check özeti ayrı kalır.

## Tamamlanma Ölçütleri

- Sürümlü Markdown ve JSON paketi yürütücüye göre ayrı Handoff yaşam döngüsünde hazırlanır.
- Ürün testi başlatmaz, izlemez veya uzaktan koşturmaz.

## Kapsam Sınırları

- Handoff'ı CI orkestratörü veya test runner sayma.
- Paketi dış yürütme devri veya yayın artefaktı sayma.
- Handoff yaşamını Test Oturumu sayma.
