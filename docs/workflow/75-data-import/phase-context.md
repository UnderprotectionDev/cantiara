# Standart Dosyalardan İçe Aktarma

Kurucu desteklenen Markdown, JSON ve CSV girdilerini eşleme ve fark önizlemesinden sonra atomik olarak uygular. Kimlik diriltme ve kısmi başarı oluşmaz.

Dış dosya şaşırtmadan girer. Eşleme görünürdür; başarısız satır bütün işlemi durdurur veya hiçbir kayıt yazılmaz.

Bu feature standart dosyalardan içe aktarmayı tamamlar. Test raporu zarfı, Mermaid dönüşümü ve yedekten kurtarma ayrıdır.

## Tamamlanma Ölçütleri

- Desteklenen Markdown, JSON ve CSV eşleme ve fark önizlemesinden sonra atomik uygulanır.
- Kimlik diriltme ve kısmi başarı oluşmaz.

## Kapsam Sınırları

- Silinmiş kimliği diriltme.
- Kısmi satır yazıp başarı sayma.
- İçe aktarmayı yedek restore veya GitHub senkronu sayma.
