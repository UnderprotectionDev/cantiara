# Mimari Kararlar

Bu dizin yalnız değiştirilmesi maliyetli, koddan tek başına anlaşılmayacak ve gerçek bir ödünleşme içeren mimari kararları tutar. Ürün davranışı, kullanıcı akışı ve kabul ölçütleri kendi PRD'lerinde; domain terimleri ise [`CONTEXT.md`](../../CONTEXT.md) içinde yaşar.

## Kararlar

| ADR | Karar | Temel ödünleşme |
| --- | --- | --- |
| [0001](0001-dis-yuzey-ve-snapshot-kimligi.md) | Dış yüzey ve snapshot kimliği | Kararlı bağlantı ile değişmez onay geçmişi |
| [0002](0002-dis-erisim-guvenlik-siniri.md) | Dış erişim güvenlik sınırı | Cache kolaylığı ile anlık iptal güvenliği |
| [0003](0003-restore-guvenlik-olay-gunlugu.md) | Restore güvenlik olay günlüğü | Eski yedeğin erişim ve secret'ları diriltmemesi |
| [0004](0004-atomik-idempotent-kesinlestirme.md) | Atomik ve idempotent kesinleştirme | Basit istek modeli ile veri bütünlüğü |
| [0005](0005-json-tasinabilirlik-sozlesmesi.md) | JSON taşınabilirlik sözleşmesi | Uzun vadeli uyumluluk ile bakım yükü |
| [0006](0006-github-entegrasyon-guven-siniri.md) | GitHub entegrasyon güven sınırı | Gerekli sağlayıcı izni ile en az veri erişimi |
| [0007](0007-surum-kaniti-guven-modeli.md) | Sürüm kanıtı güven modeli | Kolay raporlama ile doğrulanabilir kabul |
| [0008](0008-dis-url-onizleme-yalitimi.md) | Dış URL önizleme yalıtımı | Zengin önizleme ile ağ güvenliği |
| [0009](0009-ab-veri-siniri.md) | AB veri sınırı | Kullanılabilirlik ile veri bölgesi garantisi |
| [0010](0010-felaket-veri-kaybi-butcesi.md) | Felaket veri kaybı bütçesi | Kurtarma maliyeti ile kabul edilen veri kaybı |
| [0011](0011-prd-izlenebilirligini-anlamsal-baglantilarla-koru.md) | PRD izlenebilirlik modeli | Mekanik kapsama güvencesi ile bakım yükü |
| [0012](0012-prd-belge-sinirlarini-urun-alanlarina-gore-kur.md) | PRD belge sınırları | Doğal okuma akışı ile tek normatif sahiplik |
| [0013](0013-gelecek-yonlerini-cekirdek-kabulden-ayir.md) | Gelecek yönleri ile çekirdek kabul ayrımı | Gelecek esnekliği ile dürüst ilk ürün kapsamı |
| [0014](0014-ticari-genisleme-kabulunu-acik-adayla-etkinlestir.md) | Ticari genişleme kabulünün etkinleşmesi | Kararlaştırılmış sonraki alan ile ilk ürün kabulünün bağımsızlığı |
| [0015](0015-dis-yurutme-devrini-ise-ait-bilesen-olarak-tut.md) | Dış yürütme devrinin İşe ait bileşen olması | Bağlamı İşte tutmak ile yinelenen dış çalışma geçmişini ezmemek |
| [0016](0016-ekrani-ana-kayit-wireframei-surumlu-yuzey-olarak-tut.md) | Ekranın ana kayıt, Wireframe'in sürümlü yüzey olması | Bağımsız Ekran yaşamı ile yinelenen tasarım kaydı oluşturmamak |
| [0017](0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md) | Bitiriş efektlerinin özgün birinci taraf katalogla sınırlanması | Güçlü kişiselleştirme ile hak, dağıtım ve kalıcı asset yükümlülükleri |
| [0018](0018-kaynak-kodu-apache-2-0-ile-lisansla.md) | Kaynak kodunu Apache-2.0 ile lisansla | Açık yeniden kullanım ve katkı ile açık patent hibesi |
| [0019](0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md) | Güvenlik olay günlüğü ve üst anahtar güven alanı | Tek işletim birimi ile restore sonrası güvenlik bütünlüğü |
| [0020](0020-semayi-urun-icinde-tasarlayip-dogrulanmis-ddl-uret.md) | Şemayı üründe tasarlayıp doğrulanmış DDL üretmek | Şemayı proje bağlamında tutmak ile generator ve doğrulama hattının yükü |
| [0021](0021-icerigi-yalniz-veritabaninda-tut.md) | İçeriğin yalnız veritabanında yaşaması | Tanıdık harici editörler ile tek doğruluk kaynağının bütünlüğü |
| [0022](0022-wireframe-motorunu-kendimiz-yaz.md) | Wireframe motorunu kendimiz yazmak | Hazır kütüphane hızı ile öğe semantiği ve sürüm değişmezliği |

Yeni bir ADR ancak bu dizindeki üç ölçütü birlikte karşılayan bir karar için eklenir. Mevcut ürün sözleşmesini tekrar eden açıklamalar ADR oluşturmaz.
