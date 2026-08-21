# Mermaid'den Teknik Diyagrama Dönüşüm

Kurucu Belge içindeki kesin Mermaid bloğunu kayıp ve otorite etkisi önizlemesinden sonra atomik olarak yeni Teknik Diyagrama dönüştürür. Kaynak blok ve yeni kayıt köken bağıyla ayrı doğruluk kaynakları olarak kalır.

Eskiz, diyagram kaydına bilinçli geçer. Dönüşüm bloğu silmez ve canlı round-trip senkron kurmaz.

Bu feature Mermaid'den teknik diyagrama dönüşümü tamamlar. Diyagram düzenleme ve şema DDL üretimi ayrıdır.

## Tamamlanma Ölçütleri

- Kesin Mermaid bloğu kayıp ve otorite etkisi önizlendikten sonra atomik yeni Teknik Diyagrama dönüşür.
- Kaynak blok ile yeni kayıt köken bağıyla ayrı doğruluk kaynakları olarak kalır.

## Kapsam Sınırları

- Canlı Mermaid round-trip senkronu.
- Bloğu silip tek gerçeğe indirgeme.
- Dönüşümü içe aktarılmış dosya veya repository türevi sayma.
