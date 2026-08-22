# PostgreSQL Şeması ve Migration Artefaktları

Kurucu Veri Modeli Diyagramının kesin sürümünden PostgreSQL DDL ve iki kesin sürüm arasındaki schema-only Migration Artefaktını statik olarak doğrular. Ürün canlı veritabanına bağlanmaz veya uygulanmışlık iddia etmez.

Şema taslağı güvenle incelenir. Yıkıcı etki önizlenir; onaylı Up ve varsa güvenli Down değişmez manifestle kalır. Varlık modelleme Veri Modeli Diyagramındadır; burada tekrar edilmez.

Bu feature PostgreSQL şeması ve migration artefaktlarını tamamlar. Canlı migrate, Prisma runtime ve veri geri doldurma burada yoktur.

## Alt Fazlar

### DDL üretimi ve statik doğrulama

DDL üretimi tam şemayı invariant ve disposable veritabanı doğrulamasıyla birlikte geçer. Biri düşerse artefakt kesinleşmez.

Kurucu üretilen SQL'i görür. Üretimde çalıştırma bu feature'ın işi değildir.

Doğrulama canlı hedefe bağlanmaz. Atılabilir ortam statik kontrol içindir.

### Şema değişiklik taslağı

Şema değişiklik taslağı iki kesin sürüm arasındaki operasyonları yıkıcı etkileriyle önizler. Silme ve daraltma gizlenmez.

Kurucu neyin yıkıcı olduğunu onaylamadan artefakt kesinleşmez.

Diff, veri göçü planı veya ORM migrate değildir. Schema-only operasyon listesidir.

### Migration Artefaktı

Migration Artefaktı onaylı Up ve varsa Güvenli Down SQL'ini değişmez kaynak manifestiyle korur.

Kurucu bu paketi dışarı taşır. Ürün uygulandı demez ve hedef şema sürümü iddia etmez.

Down yoksa bu açıkça görünür. Güvensiz down uydurulmaz.

## Tamamlanma Ölçütleri

- Tam şema DDL'i invariant ve disposable doğrulamayı birlikte geçer.
- İki kesin sürüm arasındaki operasyonlar yıkıcı etkileriyle önizlenir ve onaylı artefakt korunur.

## Kapsam Sınırları

- Ürünü canlı veritabanına bağlayıp migrate etme.
- Uygulanmışlık veya drift iddiası.
- Veri backfill veya ORM senkronunu artefakt sayma.
- Şema modellemeyi bu kartta Veri Modeli Diyagramından kopyalama.
