# Cantiara — Kişisel Proje İşletim Sistemi PRD Dizini

Bu dosya normatif ürün davranışı tanımlamaz. Cantiara'nın güncel PRD belge setinin okuma sırasını, her belgenin tekil amacını ve kapsam belgeleri arasındaki ilişkiyi gösterir. Belgeler birlikte tek ürün sözleşmesini oluşturur.

## Belge haritası

| Sıra | Belge | Tekil amacı |
| --- | --- | --- |
| 01 | [Ürün Vizyonu ve Kapsamı](prd/01-product-vision-and-scope.md) | Ürün amacı, hedef kullanıcı, ilk ürünün bütünlük sınırı ve tamamlanma koşulları |
| 02 | [Domain Modeli ve Yaşam Döngüsü](prd/02-domain-model-and-lifecycle.md) | Ortak kimlik, sahiplik, ilişki, geçmiş, birleştirme ve yaşam döngüsü kuralları |
| 03 | [Hesap, Platform ve Operasyonlar](prd/03-account-platform-operations.md) | Hesap ve oturumlar, çalışma modeli, dağıtım bölgeleri, işletim, yedek ve kurtarma |
| 04 | [Çalışma Alanı ve Projeler](prd/04-workspace-and-projects.md) | Proje kabuğu, yapılandırma, gezinme, bildirimler ve kişisel çalışma bağlamı |
| 05 | [Yakalama ve Girdi Yönetimi](prd/05-capture-and-intake.md) | Hızlı yakalama, tarayıcı uzantısı, triage ve tamamlanmamış taslaklar |
| 06 | [İş Yönetimi ve Planlama](prd/06-work-management-and-planning.md) | İş yaşam döngüsü, planlama yüzeyleri, tarihler, blokajlar ve otomasyonlar |
| 07 | [Belgeler ve Bilgi](prd/07-documents-and-knowledge.md) | Belgeler, sürümler, dosya ekleri, şablonlar ve Kişisel Wiki |
| 08 | [Arama, İlişkiler ve Kanıt](prd/08-search-relations-and-evidence.md) | Arama, geri bağlantılar, kaynaklar, geri bildirim ve kişi/şirket kayıtları |
| 09 | [Keşif, Kararlar ve Tasarım](prd/09-discovery-decisions-and-design.md) | Kararlar, riskler, varsayımlar, araştırma ve tasarım çalışma yüzeyleri |
| 10 | [Test ve Doğrulama](prd/10-testing-and-validation.md) | Test planlama, güvenli rapor kabulü, sonuç yaşam döngüsü ve tarihsel bütünlük |
| 11 | [Teknik Diyagramlar ve Şema Artefaktları](prd/11-technical-diagrams-and-schema-artifacts.md) | Teknik Diyagram türleri ve otoritesi, PostgreSQL şeması, DDL ve migration artefaktları |
| 12 | [GitHub ve Proje Sürümleri](prd/12-github-and-project-releases.md) | Repository bağlantısı, GitHub kayıtları, Proje Sürümü, yayın hazırlığı ve Üretim Olayı öğrenimi |
| 13 | [Veri Güvenliği ve Taşınabilirlik](prd/13-data-security-and-portability.md) | Veri sınırları, saklama, silme, redaksiyon ve kontrollü içe/dışa aktarma |
| 14 | [Paylaşım ve Herkese Açık Yayın](prd/14-sharing-and-public-publishing.md) | Dış görünürlük, onaylı snapshot, bağlantıyla paylaşım, Wiki yayını ve Build in Public |
| 15 | [Ürün Kalitesi](prd/15-product-quality.md) | Performans, erişilebilirlik, kullanılabilirlik, güvenlik ve gözlemlenebilirlik hedefleri |
| 16 | [Ürün Kabulü](prd/16-product-acceptance.md) | Test yöntemleri, kabul yolculukları ve Ürün sürüm adayı kanıt paketi |
| 17 | [Ticari Genişleme](prd/17-commercial-expansion.md) | İlk ürün tamamlandıktan sonra yapılacak müşteri teklifi, Invoice ve sunum alanı |
| 18 | [Gelecek Yönleri](prd/18-future-directions.md) | Yalnız yeni kanıt ve açık ürün kararıyla kapsama alınabilecek adaylar |
| 19 | [Kapsam Dışı Hükümler](prd/19-out-of-scope.md) | Mevcut üründe uygulanmayacak davranışların açık sınırı |

## Kapsamı okuma kuralı

İlk ürün aşamalı bir özellik seçkisi değildir. 01–15 numaralı belgelerde tanımlanan davranışlar, kısıtlar ve güvenlik sınırları birlikte tamamlanır; 16 numaralı belge bunların nasıl kanıtlanacağını tanımlar. 17 numaralı ticari genişleme ilk üründen sonra yapılması kararlaştırılmış ayrı alandır. 18 numaralı adaylar kanıt ve yeni karar olmadan teslim kapsamına girmez. 19 numaralı hükümler mevcut kapsamın dışında kalır ve kendiliğinden gelecek taahhüdü oluşturmaz.

Davranışın normatif sahibi ilgili ürün alanı belgesidir. Ortak invariantlar Domain Modeli ve Yaşam Döngüsünde, ölçülebilir kalite hedefleri Ürün Kalitesinde, test yöntemi ve kanıt Ürün Kabulünde, tamamlanma kapısı ise Ürün Vizyonu ve Kapsamında tek kez tanımlanır. Başka belgeler aynı sözleşmeyi yeniden anlatmak yerine bu kaynağa bağlantı verir.

Kabulün birimi tek tek vaat değil, Ürün Kabulü belgesindeki uçtan uca kabul yolculuğudur. Her yolculuk hangi normatif kaynakları kapsadığını, test odağını, asgari kanıtını ve kanıt ortamını kendi satırında taşır; `Gerçek proje` ve `Her ikisi` işaretli yolculuklar birlikte tamamlanma kapısını oluşturur. Doğal adlı vaat yazımı, kararlı bölüm anchor'ları ve tek normatif sahiplik kuralı bu setin okunabilirliğini koruyan yazım disiplinidir. Bu disiplini bir doğrulayıcı ve sürümlü referans envanteri denetliyordu; ikisi de kaldırıldı ve gerekçesi [ADR-0011](adr/0011-prd-izlenebilirligini-anlamsal-baglantilarla-koru.md) içinde kayıtlıdır. Bunun sonucu olarak kırık bağlantı, yinelenen vaat adı ve kapsam boşluğu artık elle gözden geçirmeyle yakalanır; yeni veya değişen bir normatif bölüm aynı değişiklikte ilgili kabul yolculuğuna bağlanır.

## Destekleyici belgeler

- [Teknoloji yığını](tech-stack.md)
- [Domain sözlüğü](../CONTEXT.md)
- [Mimari karar kayıtları](adr/README.md)
