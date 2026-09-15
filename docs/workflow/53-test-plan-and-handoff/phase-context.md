# Planlı Test ve Handoff

Kurucu yeniden kullanılabilir test amacını sürümler. Test Oturumu bağlandığında tam olarak seçilen senaryo sürümünü tarihsel olarak korur. Dış test çalışması için sürümlü Markdown ve JSON paketini yürütücüye göre ayrı Handoff yaşam döngüsünde hazırlar. Ürün testi başlatmaz veya izlemez.

Senaryo yaşar, oturum o anki sürüme kilitlenir. Sonraki senaryo düzenlemesi geçmiş oturumu yeniden yazmaz. Dış yürütücü neyi koşacağını donmuş paketten alır. Cantiara bu paketi izleme veya uzaktan koşturma platformu olmaz.

Bu feature planlı test senaryolarını ve test handoff'larını tamamlar. Test raporu kabulü, inceleme ve test açığı ayrıdır.

## Alt Fazlar

### Planlı test senaryoları

Yeniden kullanılabilir test amacı sürümlenir. Bağlanan Test Oturumu tam olarak seçilen senaryo sürümünü tarihsel korur.

Senaryo düzenleyerek geçmiş oturumlar güncellenmez. Senaryo İş kontrol listesi değildir.

Senaryoyu Test Oturumu veya Handoff paketi sayma.

### Test handoff'ları

Sürümlü Markdown ve JSON paketi yürütücüye göre ayrı Handoff yaşam döngüsünde hazırlanır. Ürün testi başlatmaz, izlemez veya uzaktan koşturmaz.

Handoff CI orkestratörü veya test runner değildir. Paket dış yürütme devri veya yayın artefaktı sayılmaz.

Handoff yaşamı Test Oturumu değildir.

## Tamamlanma Ölçütleri

- Yeniden kullanılabilir test amacı sürümlenir.
- Bağlanan Test Oturumu tam olarak seçilen senaryo sürümünü tarihsel korur.
- Sürümlü Markdown ve JSON paketi yürütücüye göre ayrı Handoff yaşam döngüsünde hazırlanır.
- Ürün testi başlatmaz, izlemez veya uzaktan koşturmaz.

## Kapsam Sınırları

- Senaryoyu Test Oturumu veya Handoff paketi sayma.
- Senaryo düzenleyerek geçmiş oturumları güncelleme.
- Senaryoyu İş kontrol listesi yapmak.
- Handoff'ı CI orkestratörü veya test runner sayma.
- Paketi dış yürütme devri veya yayın artefaktı sayma.
- Handoff yaşamını Test Oturumu sayma.
