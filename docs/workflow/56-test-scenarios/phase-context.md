# Planlı Test Senaryoları

Kurucu yeniden kullanılabilir test amacını sürümler. Test Oturumu bağlandığında tam olarak seçilen senaryo sürümünü tarihsel olarak korur.

Senaryo yaşar, oturum o anki sürüme kilitlenir. Sonraki senaryo düzenlemesi geçmiş oturumu yeniden yazmaz.

Bu feature planlı test senaryolarını tamamlar. Test Handoff'ı, oturum kabulü ve test açığı ayrıdır.

## Tamamlanma Ölçütleri

- Yeniden kullanılabilir test amacı sürümlenir.
- Bağlanan Test Oturumu tam olarak seçilen senaryo sürümünü tarihsel korur.

## Kapsam Sınırları

- Senaryoyu Test Oturumu veya Handoff paketi sayma.
- Senaryo düzenleyerek geçmiş oturumları güncelleme.
- Senaryoyu İş kontrol listesi yapmak.
