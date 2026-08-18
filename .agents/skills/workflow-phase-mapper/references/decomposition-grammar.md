# Faz Ayrıştırma Dilbilgisi

Bu dosya kaynak otoritesi ve ana/alt faz kararlarının kanonik açıklamasıdır. Makine alanları `decomposition-decision-model.json` içindedir.

## 1. Kaynak otoritesi

| Karar ekseni | Otorite |
|---|---|
| Ürün kapsamı ve kullanıcı davranışı | PRD/ürün otoritesi |
| Teknik seçim ve kısıt | Teknik otorite; kabul edilmiş ADR kendi konusu için üstündür |
| Terminoloji | Kullanıcının verdiği hedef proje `CONTEXT.md` |
| Bugünkü uygulama durumu | Doğrulanmış repo/mevcut durum |

Repo kanıtı kapsam üretmez. Aynı eksendeki gerçek çatışma varsayılanlarla çözülemiyor ve yapıyı maddi değiştiriyorsa kullanıcıya tek soru sor.

## 2. Davranış envanteri

Kaynak destekli davranışları amaç, aktör/sistem, gözlenebilir sonuç, domain kuralları, kabul kanıtı ve kaynak ankrajıyla çıkar. Auth, hata ve toparlanmayı iç envanterde koru; bunları davranış kimliği veya görünür şablon alanı sayma.

## 3. Aday koruma

Ayrı kaynak amacı, ayrı ürün bölümü, bağımsız yolculuk, ayrı kabul sonucu veya eş düzey Feature Kimliği taşıyan adayları erken çatı altında eritme. Ad veya entity farkını tek başına kanıt sayma.

## 4. Teknik adayları ele

Entity, ekran, route, tablo, schema, provider, migration, servis, ortak CRUD, ekip veya teslim sırası tek başına feature değildir.

## 5. Bağımsız Feature Kapısı

Bir ana faz adayı aşağıdakilerin hepsini kaynakla savunur:

1. kaynak destekli bağımsız feature veya gözlenebilir ürün/sistem sonucu;
2. ayrı amaç;
3. bütünlüklü gözlenebilir sonuç;
4. kendi davranış ve kabul sınırı;
5. kardeş aday olmadan anlam.

Kapsam büyüklüğü, alt faz ağacı veya özgün durum sayısı önkoşul değildir. Bunlar yalnız diagnostic Kapsam Sinyalidir. Küçük fakat bağımsız feature ana fazdır.

## 6. Anti-merge ve birleşme

Birleştirmeden önce anti-merge kapısını uygula. Adaylar farklı Feature Kimliği, farklı kullanıcı/sistem yolculuğu veya farklı kabul sonucu taşıyorsa ortak veri modeli, CRUD, UI ya da teknik altyapıya rağmen birleştirme.

Yalnız şu koşulların hepsi sağlanırsa birleştir:

- aynı feature kimliği;
- aynı bütünlüklü değer;
- ayrıldıklarında yapay veya anlamsız kalma.

Birleştirme kanıtı eksikse varsayılan `Böl`.

## 7. Kesen feature

Bir aday ancak aşağıdakilerin hepsini sağlarsa `cross-cutting-feature` ana fazıdır:

- ayrı başlatılan veya algılanan amaç;
- birden fazla feature'ı kapsayan uçtan uca yolculuk;
- kendi gözlenebilir başarı sonucu ve kabul sınırı;
- feature-owned lifecycle davranışlarını çalmadan anlamlı kalma.

Ortak validasyon, model, CRUD servisi, helper veya UI kabuğunu ilgili feature'lara dağıt.

## 8. Gözlenebilir sistem yeteneği

Teknik ağırlıklı aday ancak kaynakça ayrı tanınan, bağımsız gözlenebilen, kendi kabul sınırı olan ve yalnız teknik mekanizmadan ibaret olmayan sonuçsa `observable-system-capability` ana fazıdır.

Provider, migration, tablo, schema, persistence adapter veya deployment hazırlığını kendi başına faz yapma.

## 9. Faz türü

Sınır kesinleştikten sonra tam bir gizli `phaseKind` ata:

- `product-feature`
- `cross-cutting-feature`
- `observable-system-capability`

Tür sınır yaratmaz, aday birleştirmez/bölmez ve kullanıcıya gösterilmez.

## 10. Alt faz kapısı

Görünür alt faz aşağıdakilerin hepsini taşır:

- kardeş davranıştan ayrılan tek amaç;
- ayrı gözlenebilir sonuç;
- uçtan uca ajan teslimatı olabilen davranış sınırı;
- ana feature'ın bütünlüklü değerine katkı.

Create/edit/delete gibi lifecycle davranışları bu kapıyı ayrı ayrı geçiyorsa ayrı alt fazdır. Endpoint, repository metodu, form veya hata hali tek başına alt faz değildir.

Bir alt faz birden fazla bağımsız amaç, lifecycle sonucu veya karar kümesi taşıyorsa böl. Parça Bağımsız Feature Kapısını geçerse ana faz testine geri gönder. Alt fazı olmayan geçerli ana fazı koru ve dekoratif tek alt faz üretme.

## 11. Requirement sahipliği

Her requirement'ı iç analizde tam bir ana veya alt faz sahibine bağla. Görünür HTML veya Markdown'a requirement kimliği, kaynak yolu ya da sahiplik envanteri dökme.

## 12. Önkoşul ve sıra

Sınırlar kesinleştikten sonra doğrudan sonuç tüketimini çıkar. Zorunluları `allOf`, aynı ihtiyacı karşılayan alternatifleri `anyOf` içinde tut. Döngüyü reddet ve topolojik sırayı üret. Graph'ın sahiplik, birleşme veya faz kimliği üretmesine izin verme.

## 13. Kanonik önizleme ve final

Ana faz kimliği/sırası/adı, alt faz kimliği/sırası/adı/sonucu ve gizli graph'ı tek semantik modelde kesinleştir. HTML'yi açık onaydan önce, final Markdown'ı aynı onaylı hiyerarşiden üret. Publisher ordered ad eşliğini deterministik doğrular.

## 14. Karar sırası

1. Kaynak eksenlerini ayır.
2. Davranışları çıkar.
3. Kaynak destekli adayları koru.
4. Teknik adayları ele.
5. Bağımsız Feature Kapısını uygula.
6. Zorunlu büyüklük eşiği uygulama.
7. Anti-merge kapısını uygula.
8. Yalnız aynı feature kimliğinde birleş.
9. Kesen-feature kapısını uygula.
10. Gözlenebilir-sistem kapısını uygula.
11. Sınır sonrası `phaseKind` ata.
12. Alt-faz kapısını uygula.
13. Geniş alt fazı böl ve gerekirse ana faz testine geri gönder.
14. Alt fazsız ana fazı koru.
15. Requirement sahipliğini iç modelde tamamla.
16. Bağımlılık graph'ını sınır sonrası kur.
17. Graph'ın sınır üretmesini engelle.
18. Kanonik hiyerarşi ve terminolojiyi kesinleştir.
19. HTML'yi aynı modelden üret.
20. Finali aynı onaylı modelden üret ve eşliği doğrula.
