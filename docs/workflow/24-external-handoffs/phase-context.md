# Dış Yürütme Devirleri

Kurucu test dışı çalışmayı sürümlü bir İş bağlam paketiyle dış araca devreder ve dönen sonucu fark önizlemesiyle İş gerçeğine uzlaştırır.

Dış yürütme, Cantiara gerçeğini sessizce ezmez. Paket tarihli ve sürümlüdür; dönüş incelenmeden yazılmaz.

Bu feature dış yürütme devrini tamamlar. Test Handoff'ı, Dış Araca Kaçış olayı ve GitHub PR ayrı kalır.

## Alt Fazlar

### Devir paketi

Devir paketi kesin İş bağlamından tarihli ve sürümlü çıkar. Paket, o andaki bağlamın kapalı kopyasıdır.

Kurucu neyin gittiğini görür. Paket canlı senkron veya repository kopyası değildir.

Bu alt faz Test Handoff'ı değildir. Test dışı yürütme içindir.

### Dönüş ve uzlaştırma

Dönen içerik fark önizlemesiyle İş gerçeğine uzlaştırılır. Kaynak alanlar sessizce ezilmez.

Kurucu kabul, red veya parça seçimini açıklar. Kısmi yazma gizli kalmaz.

Uzlaştırma içe aktarma sihirbazı veya Git birleştirmesi değildir. İş bağlamına dönüştür.

## Tamamlanma Ölçütleri

- Kesin İş bağlamından tarihli ve sürümlü dış çalışma paketi oluşur.
- Dönen içerik kaynak gerçeği sessizce ezmeden incelenir ve uzlaştırılır.

## Kapsam Sınırları

- Devir paketini Test Handoff'ı veya yayın artefaktı sayma.
- Dönen dosyayı önizlemesiz ana gerçek yapmak.
- Dış araç oturumunu otomatik telemetry ile izleme.
