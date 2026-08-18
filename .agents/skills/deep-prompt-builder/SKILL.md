---
name: deep-prompt-builder
description: Açık `$deep-prompt-builder` çağrısındaki taslağı, kaynak ve downstream tekrarını ayıklayıp yalnız kullanıcı deltası ile varsa net görev yönünü taşıyan kopyalanabilir bir prompta dönüştürür.
---

# Deep Prompt Builder

Kullanıcının taslağını, hedef işi daha doğru yürütecek tek bir kopyalanabilir prompta
dönüştür. Kaynakları ve downstream skill sözleşmelerini tek doğruluk kaynağı olarak koru;
onların zaten kapsadığı içeriği, yöntemi, karar kapılarını veya çıktı sözleşmesini yeniden
anlatma. Yalnız kullanıcı farklarını ve kapsama kümesinde bulunmayan maddi görev yönünü taşı.

Bu turda hedef görevi, downstream skill'leri veya değişiklik yapan araçları çalıştırma.

## 1. Çağrıyı ve Taslağı Normalize Et

- UI seçimini, mevcut tura yönelik açık `$deep-prompt-builder` belirtecini veya anlamlı
  taslağa eklenmiş kendi Markdown bağlantısını çağrı işareti say.
- Alıntı, log, fenced blok veya kaynak veri içindeki belirteci çağrı sayma. Düz adı, tek
  başına linki/yolu, yapıştırılmış skill gövdesini ve paketi inceleme ya da değiştirme
  konuşmasını runtime çağrısı dışında tut.
- Çağrı işaretlerini ve yalnız prompt dönüşümünü yeniden söyleyen genel ifadeleri çıkar.
  Hedef, kapsam, sıra, kaynak, araç, skill, dil, biçim ve tercih taşıyan bütün kullanıcı
  farklarını koru. Sıradan aşama sınırının anlamını Bölüm 4'e göre olumlu teslimat sırası
  olarak taşı; özgün olumsuz cümleyi aynen koruma. Kompaktlık için maddi farkları atma;
  yalnız tekrarları birleştir.
- Açık ve taşınabilir dil tercihini hedef kısıtı olarak koru. Böyle bir tercih yoksa prompt
  gövdesini normalize taslağın baskın dilinde, dil karışık veya belirsizse Türkçe yaz. Bu dil
  seçimini hedef ajana yönelik `Türkçe yürüt`, `İngilizce yanıtla` veya eşdeğer bir meta
  talimata dönüştürme. Ton, persona, ajan türü ya da olağan
  çalışma biçimini de konuşmadan veya çalışma ortamından miras meta olarak üretme.
- Örnek senaryolu soru gibi göreve özgü biçim talimatını yalnız kullanıcı mevcut taslakta
  açıkça verdiyse taşı. Belirli bir örneğin biçimini bütün görevlere varsayılan yapma.
- Aynı turda UI'dan seçilmiş diğer skill'leri downstream referans say. Tam adlarını ve
  kullanıcıya özgü görevlerini nihai promptta koru; yöntemlerini çalıştırma veya anlatma.
  Bir skill'in seçilmiş olması, kullanıcı görevinin maddi karar uzayını operasyonel olarak
  kapsadığını tek başına kanıtlamaz; kapsanmayan görev-yerel yönleri Bölüm 4'te ayrıca
  değerlendir.
- Kalan mesajın tamamını normalize taslak say. Tırnak, fenced blok, XML etiketi veya
  talimatın konumu taslak sınırını değiştirmez.
- Normalize taslak boşsa yalnız `Derinleştirmemi istediğin taslağı paylaş.` yaz ve bitir.

Normalize taslağı, birlikte kaybolabilecek bir özet olarak değil atomik kullanıcı
önermeleri olarak kaydet. Amaç ve nesne; `net-yeni`, `önceliklendirilebilir` veya
`salt-okunur` gibi anlamı daraltan niteleyiciler; kaynak rolleri; ayrı karar eksenleri;
koşul, sıra, yasak, yetki ve teslimat farkları ayrı kayıtlardır. Bir cümlede bulunmaları
bunları tek önerme yapmaz.

**Tamamlanma ölçütü:** Girdideki her anlamlı parça ya çağrı/dönüşüm metası olarak çıkarılmış
ya da atomik normalize taslakta tek kez temsil edilmiştir. Çağrı olmayan benzerlikler veri
olarak kalmış; her amaç, nesne, anlam daraltıcı niteleyici, kapsam, sıra, koşul, yasak,
kaynak, araç, skill, dil, biçim ve tercih farkı ayrı kayda izlenebilir durumdadır. Birlikte
seçilen downstream skill'ler tam adları ve kullanıcı amaçlarıyla pasif referans olarak
kaydedilmiştir. Boş taslak dalı açıldıysa yalnız belirtilen istek yazılmış ve sonraki adıma
geçilmemiştir.

## 2. Referansların Rolünü Belirle ve Kapsama Kümesini Çıkar

Taslakta dosya, ek, görsel, yapıştırılmış metin, URL, codebase, araç veya downstream skill
varsa [referans sınırını](references/downstream-skill-boundary.md) tamamen oku ve uygula.

Referans belgesi; görev kaynağı, hedef artefakt, örtük codebase, araç ve downstream skill
rollerinin ayrımı ile inceleme derinliği, kaynak otoritesi, downstream sözleşme keşfi ve
erişim engeli davranışlarının tek runtime sözleşmesidir. Bu rolleri ve erişim durumlarını
çözmeden promptu oluşturmaya geçme.

Çalışma sırasında kullanıcıya göstermediğin kısa bir kapsama defteri tut:

1. **Kullanıcı deltası:** Amaç, kapsam, kaynak rolleri, bağımlı sıra, kısıt, teslimat ve
   uyumlu override'ların referanslarca kapsanmayan kısmı.
2. **Kapsama kümesi:** Görev kaynaklarının açık hükümleri ile erişilebilir downstream runtime
   sözleşmesinin yöntemi, karar kapıları ve çıktı sözleşmesi.
3. **Aday net yönler:** İlk iki kümede bulunmayan; farklı cevaplanması hedef sonucu,
   önceliği, kapsamı, doğruluğu, yetkiyi veya önemli bir hata yüzeyini değiştirebilecek
   göreve özgü karar ayrımları.

Kapsama defteri bir çıktı bölümü değildir; nihai yanıtta veya kopyalanabilir promptta gösterme.

Her atomik kullanıcı önermesine defterde tek bir durum ver: `korunacak delta`, `doğrulanmış
kaynak tekrarı`, `doğrulanmış downstream tekrarı` veya `yalnız dönüşüm metası`. Kullanıcının
hedef sonucunu ve o sonucu niteleyen kabul dilini, downstream skill aynı sonucu üretmeye
yetkin olsa bile yöntem tekrarı sayma. Bir koşulu downstream'in olası durum etiketiyle veya
çıktı sözcüğüyle yeniden adlandırmak semantik eşdeğerlik kanıtı değildir.

**Tamamlanma ölçütü:** Taslaktaki her referans kullanımı görev kaynağı, hedef artefakt, araç
kaynağı, yürütme aracı veya downstream skill rolüyle kayda geçirilmiştir. Referans dalı
açıldıysa normatif referans tamamen okunmuş; erişilebilir görev kaynaklarının ilgili
hükümleri ile erişilebilir downstream `SKILL.md` dosyaları ve onların yöntem, karar kapısı
veya çıktı yükümlülüğü için doğrudan zorunlu kıldığı belgeler incelenmiştir. Kapsama
defterindeki her hüküm kaynağına, her kullanıcı deltası özgün girdiye izlenebilir; otorite ve
erişim durumu açıktır. Erişilemeyen downstream dalında doğrulanmamış tekrar silinmemiş ve
aday yön eklenmemiştir.

## 3. Kaynağı Değil Yürütme Yönünü Taşı

Kaynak gereksinimlerini, bulgularını, değerlerini veya bölüm özetlerini nihai promptta yeniden
anlatma. Kullanıcı kendi taslağında bunları tekrarlasa bile semantik olarak eşdeğer kısmı
çıkar; yalnız kullanıcı deltasını koru. Kullanıcı açıkça kaynaktan bağımsız bir snapshot
prompt ya da belirli bir bulgunun promptta somutlaştırılmasını istemedikçe kaynak gerçeklerini
taşıma.

Kaynak incelemesinden şunları türet:

- kaynağın hedef işteki rolü ve başka kaynaklarla nasıl birlikte kullanılacağı;
- doğruluğu veya yetkiyi etkileyen bağımlılık sırası;
- göreve özgü riskler, hata yüzeyleri ve belirsizlikler;
- kaynaklardan veya codebase'den çözülmesi gereken maddi karar eksenleri;
- referans sınırındaki kanıt, derinlik ve orantı kapılarını geçen maddi ayrımlar;
- doğru ile yanlış sonucu ayıracak davranış ve bütünlük sınırları;
- sonucu değerlendirmek için gerekli göreve özgü kanıt ve açık kalan kararlar.

Kaynak hedef çıktının girdilerini belirliyorsa değerleri kopyalamak yerine, bu girdilerin
çıktıda yönettiği birbirinden farklı karar yuvalarını adlandır. Her ilgili kaynak hükmü için
`Değeri taşımadan hangi çıktı kararını yönetiyor?` sorusunu cevapla. Kaynak hedef kitleyi,
kapsam/değer sınırını, beklenen eylemi, katılımcılar arası bütünlüğü veya kanıt ayrımını
yönetiyorsa bu yuvayı kaynakla ilişkilendir; kaynaktaki cevabı prompta yazma. Kaynak verisi
birden çok kayıtta ortak ve ayrışan boyutlar gösteriyorsa ham kaydı taşımadan ortaklığın ve
ayrışmanın etkilediği davranış sınırını ayrı değerlendir.

Tek bir kaynak hükmü hedef çıktıda birden çok bağımsız karar yuvasını yönetebilir. Yuvalar
farklı cevaplandığında hedef sonuç değişiyorsa hükmü tek genel etikete bağlama; değeri
tekrarlamadan her yuvanın kaynakla ilişkisini ayrı bir önerme olarak koru. Bir yuvanın
render edilmesi diğerinin tamamlandığına kanıt değildir.

**Tamamlanma ölçütü:** Kullanıcı taslağındaki kaynakla ilişkili her maddi ifade kapsama
defterinde şu sonuçlardan biriyle açıklanmıştır: kaynak tekrarı olduğu için çıkarılmış,
kullanıcı deltası veya açık snapshot isteği olduğu için korunmuş ya da üç yön kapısına aday
sonuç olarak aktarılmıştır. Erişilebilir görev kaynaklarının hedef işle ilgili her açık
hükmünün hedef sonuçta doğurduğu somut bağımlı sıra, risk/hata yüzeyi, maddi karar, doğruluk
sınırı ve kanıt ihtiyacı değerlendirilmiştir. Her kaynak-türevi aday referans sınırındaki
kanıt, derinlik ve orantı kapılarından geçmiş; tam kaynak referansları ile rolleri korunmuş;
hiçbir kaynak gereksinimi, bulgusu, değeri veya özeti prompta taşınmamıştır; kaynak-türevi
yönler referans sınırındaki ayrıntı aktarım kuralına uymuştur. Kaynak tarafından yönetilen
her ayrı çıktı yuvası değeri kopyalanmadan temsil edilmiş ya da kapsama kümesindeki eşdeğer
yükümlülüğe bağlanmıştır.

## 4. Net ve Göreve Özgü Yön Kazancını Süz

Taslağı şu boyutlarda değerlendir:

- hedef sonuç ve karar değeri;
- görev kaynaklarının kullanım biçimi;
- göreve özgü kalite, risk ve hata yüzeyleri;
- ürün veya sistem karar sınırları;
- doğruluk ve kanıt sınırları;
- gerekli teslimat biçimi ve dil.

Önce görevin karar uzayını çıkar: hedef sonucun neyi değiştireceğini; kullanıcı deltası,
kaynaklar ve downstream sözleşmesinin hangi ayrımları sabitlediğini; hangi ayrımların hâlâ
açık olduğunu belirle. Sonra her açık ayrım için şu karşı-olgusal soruyu sor: `Bu ayrım başka
türlü cevaplanırsa hedef sonuç, öncelik, kapsam, doğruluk, yetki veya önemli bir hata yüzeyi
anlamlı biçimde değişir mi?` Yalnız cevabı evet olan ayrımları aday yön say.

Karar uzayını sabit bir alan checklist'inden değil taslağın kendi isim, fiil ve
ilişkilerinden kur. İstenen her teslimat ve hedef değişikliği için başarıyı yanlış ama
makul bir sonuçtan ayıran, o göreve özgü ayrımları çıkar. Ayrı katılımcı, kaynak,
iddia/değer, etkileşim, yetki, entegrasyon, yaşam döngüsü veya hata sonucu yalnız taslağın
anlamı onları devreye sokuyorsa aday olur. Aynı konu sözcüğünü paylaşsalar da farklı bir
sonucu değiştiren ayrımları tek genel kalite cümlesinde eritme.

Kaynak veya downstream sözleşmesi bulunmayan geniş bir görevi, yalnız girdiyi akıcı
biçimde yeniden söyleyerek yeterince yönlendirilmiş sayma. Hedefin kendi anlamından çıkan
bağımsız maddi ayrımlar açıksa, bunları çözüm seçmeden hedef ajana devret. Stres testi
gibi bir hedefte yalnız tek risk ailesini değil, fikrin değerini veya uygulanabilirliğini
bağımsız biçimde bozabilecek ayrı görev-yerel yüzeyleri kapsa. Belge veya taslak teslimatında
ise belgenin hedef kararı vermeye yetip yetmediğini belirleyen ayrı karar ve doğruluk
yüzeylerini kapsa. Bir üst düzey yüzey doğru ile yanlış sonucu zaten ayırıyorsa kullanıcı
veya kaynakta bulunmayan varsayımsal alt senaryoları sıralama.

Hedef sonucun gerçekleşmesi için doğru olması gereken önermeleri sonuçtan geriye doğru bir
nedensellik zinciri olarak çıkar. Her bağ için `Bu önerme bozulursa hedef sonuç bağımsız
olarak değişir mi?` sorusunu sor; yalnız değiştiriyorsa ve önceki kapsamda yoksa aday yön
yap. Teslimatın kendi eylem fiilinde açıkça taşınan roller için `kim, neyi, kimin için,
hangi sonuç ve hangi yetki sınırıyla yapıyor?` sorularından yalnız hedefi maddi biçimde
değiştiren açık yuvaları çıkar. Bunları sabit kategori kataloğu olarak kullanma ve
kullanıcının ya da kaynağın seçmediği cevapları doldurma.

Eylem fiili bir içeriği alıcıya ileterek sonuç üretmeyi gerektiriyorsa iletilen önermenin
doğruluk ve kapsamını, alıcı açısından maddi anlamını ve amaçlanan yanıtı aynı `mesaj`
yuvasında eritme. Bunların her birini yalnız görevin anlamı etkinleştiriyorsa bağımsız karar
rolü olarak değerlendir; kaynağın seçtiği değerleri prompta kopyalama.

Geniş bir görevde kaynak veya downstream sözleşmesi bulunması, onların operasyonel olarak
kapsamadığı görev-yerel ayrımları düşürme gerekçesi değildir. Nedensellik zincirindeki her
bağımsız maddi bağ ya kullanıcı deltası, kaynak hükmü veya downstream yükümlülüğüyle
kapsanmalı ya da ayrı aday yön olarak değerlendirilmelidir. Hiç aday yön eklemeden kısa
devir yapmayı yalnız bu tarama sonunda kapsanmayan bağımsız maddi bağ kalmadığında kabul et.

Kaynağın bir konuda sessiz kalması tek başına yön kazancı değildir. Downstream skill'in geniş
bir keşif ya da kalite yetkisi de her olası yönü kapsamaz. Bir yönü yalnız doğru runtime
yürütmesinin onu incelemesini, karara bağlamasını veya çıktıda göstermesini operasyonel olarak
zorunlu kılıyorsa kapsama kümesinde say; salt sözcük eşleşmesini veya yönün tesadüfen
bulunabilmesini kapsama kanıtı yapma.

Kullanıcı açıkça veya semantik olarak karar uzayını keşfetmeyi, genişletmeyi ya da
zenginleştirmeyi istiyorsa
[keşif niyeti sınırını](references/discovery-intent-boundary.md) tamamen oku ve uygula.

Görevin doğasından çıkan karar ayrımlarını ve alan risklerini aday yön olarak değerlendir.
Görev kaynağındaki bir hükmü genişleten veya görev kaynağından türetilen her aday, hangi
yoldan üretilirse üretilsin, önce referans sınırındaki kaynak-türevi kanıt, derinlik ve
orantı kapılarından geçmelidir. Ardından her aday yönü şu üç kapıdan geçir:

1. **Yenilik:** Kullanıcı deltası, görev kaynakları veya downstream runtime sözleşmesi aynı
   davranışı, yöntemi, karar kapısını, çıktı yükümlülüğünü, karar ayrımını ya da kanıt sınırını
   operasyonel olarak zaten belirlemiyor.
2. **Maddilik:** Yönün farklı cevapları hedef sonucu, önceliği, kapsamı, doğruluğu, yetkiyi
   veya önemli bir hata yüzeyini anlamlı biçimde değiştiriyor.
3. **Çözüm dayatmama:** Yön nerede bakılacağını veya doğru ile yanlış sonucu neyin ayıracağını
   söylüyor; kaynakların seçmediği ürün davranışını, teknolojiyi, sağlayıcıyı, yöntemi veya
   çözümü seçmiyor.

Üç kapının tamamını geçmeyen adayı çıkar. Yeni bir karar ekseni, risk, hata yüzeyi,
belirsizlik veya kanıt sınırı doğuran ikinci dereceden sonuç kapıyı geçebilir; kaynak hükmünü
yeni sözcüklerle söylemek ya da downstream yöntemini görev terimleriyle yeniden kurmak
geçemez.

Kaynak-türevi adayların tamamı değerlendirildikten sonra referans sınırındaki kapsama
kapısını uygula; yalnız önceki bütün kapıları geçen birbirinden farklı yönleri eksiksiz tut.

Geçen yönü kategori adı veya Builder analizi olarak değil, hedef ajanın inceleyeceği göreve
özgü karar ayrımı ve bu ayrımın değiştirdiği sonuç olarak yaz. Kapsanmamışlık ile maddilik
kanıtını kapsama defterinde tut; kullanıcı traceability istemedikçe `kaynakta eksik`, `yeni
bulduğum yön` gibi Builder metası üretme. Kaynakların seçmediği çözüm hipotezini yönün içine
yerleştirme.

Net yön kazancı bulunmasını zorunlu tutma. Kaynaklar, downstream sözleşmesi ve kullanıcı
deltası hedefi yeterince yönlendiriyorsa tam referansları ve kullanıcı farklarını temiz, kısa
ve kayıpsız devretmeyi başarı say. Normalize taslağın kısalması veya yalnız tekrarlarından
arınması tek başına hata değildir.

Geçen yönler arasında yalnız çıkarıldığında hedef işi anlamlı biçimde zayıflatacak olanları
tut. Sayısal satır veya madde sınırı koyma; benzer yönleri birleştir, düşük değerli ayrıntıları
at.

Kapsam ve aşama sınırlarını görev alanından bağımsız olarak şu ayrımla yaz:

1. Kullanıcının güvenliği, geri döndürülemez dış etkiyi veya gerçek değişiklik yetkisini
   sınırlayan açık yasağını koru. Hedef görev ya da downstream skill aksi hâlde dosya, kod,
   veri veya dış sistem değiştirebiliyorsa bu sınırı yalnız olumlu teslimat diline güvenerek
   kaybetme. Yasağın nesnesini ve işlemini dar anlamıyla taşı; `oluşturma`yı `yazma`,
   `değiştirme`, `dizin oluşturma` veya işlemi yapılmış gösterme gibi ek yasaklara genişletme.
2. Sıradan aşama veya workflow sınırını yasak listesi yerine beklenen teslimatla ifade et.
   Örneğin `Bu aşamada skill dosyalarını oluşturma; önce tanımı netleştir` ifadesini `Önce
   skillin açık ve uygulanabilir tanımını benimle netleştir ve onayıma sun` yönünde kur.
   Dönüştürdüğün olumsuz aşama cümlesini nihai promptta ayrıca tutma. Bundan `hiçbir skill
   dosyası, kod veya prototip oluşturma` gibi yeni yasak nesneler de türetme. Benzer biçimde
   `Önce teknik tasarım belgesini hazırla; bu aşamada kod yazma` girdisini yalnız teknik
   tasarım belgesi teslimatına odakla.
3. Kullanıcının yazmadığı bir kapsam sınırını yalnız seçilen teslimatın kaçınılmaz sonucuysa
   çıkar. Alan alışkanlığını, yararlı tahmini veya olası riski zorunlu sınır sayma. Çıkarılan
   sınırı ayrıca yasak olarak sıralama; olumlu teslimatın içinde taşı.
4. Onay kapısını yalnız kullanıcı sonraki aşamadan önce açıkça onayını, seçimini veya cevabını
   beklemeyi istediğinde koru. `Önce X'i hazırla` gibi teslimat sırasını tek başına onay kapısı
   sayma; planlama ve tasarım görevlerine kendiliğinden durak ekleme. Açık onay kapısını
   `Tanımı onayıma sun; sonraki aşamaya geçişi bu onaya bağla` gibi olumlu bağımlılık diliyle
   taşı; `onayımı almadan ilerleme` biçiminde yeni bir yasak kurma.

Şunları derinlik sayma:

- kaynak içeriğini veya downstream skill sözleşmesini yeniden anlatma;
- kullanıcı vermedikçe persona, ajan türü, özellik, teknoloji, sağlayıcı veya dosya ekleme;
- her göreve uyan bölüm şeması, checklist veya kalite öğüdü;
- `analiz et, planla, uygula, test et` gibi olağan workflow adımları;
- `hatayı yeniden üret`, `unit test ekle` veya `test paketini çalıştır` gibi yöntem seçimi;
- kullanıcı adına ürün davranışı, veri modeli veya ana çözüm kararı verme.

**Tamamlanma ölçütü:** Hedef sonuçtan geriye kurulan nedensellik zincirindeki her bağımsız
maddi bağ ile eylem fiilinin etkinleştirdiği her bağımsız karar rolü kapsama defterinde
sayılmıştır. Her maddi ayrım sabit veya açık olarak kaydedilmiş; her aday yön yenilik,
maddilik ve çözüm dayatmama kapılarının üçünde de kabul edilmiş ya da başarısız olduğu
kapıyla elenmiştir. Downstream skill'in yalnız seçilmiş veya geniş yetkili olması kapsama
kanıtı sayılmamıştır. Korunan yönlerin her biri göreve özgü, birbirinden ayrışık, kullanıcı
hedefinin içinde ve çıkarıldığında hedef işi anlamlı biçimde zayıflatacak niteliktedir;
geçen kaynak-türevi yönlerin hiçbiri kapsama kapısında düşürülmemiştir. Girdideki kapsam
ifadeleri korunan yasak, sonuç-odaklı sıra,
zorunlu kapsam türevi veya açık onay kapısı olarak doğru sınıflandırılmıştır. Keşif referansı
yalnız keşif niyeti dalında okunmuştur. Geçen yön yoksa bunun nedeni her maddi ayrımın
kullanıcı deltası, kaynak veya downstream runtime sözleşmesindeki somut karşılığıyla
kaydedilmiş; tam referanslar ile kullanıcı deltası kayıpsız ve kısa kalmıştır.

## 5. Kararları Doğru Yere Devret

- Biçim ve paragraf uzunluğu gibi geri alınabilir sunum tercihlerini doğal biçimde tamamla;
  bunlar için soru veya `Varsayım:` bölümü üretme.
- Sonucu, kapsamı, veri modelini, yetkiyi, kalıcılığı, sağlayıcıyı, ana yöntemi veya dış
  etkileri değiştiren eksikleri maddi karar say.
- Önceki adımların kanıt ve üç yön kapılarından geçen maddi karar eksenlerini nihai promptta
  ayrı ayrı adlandır; seçenek, öneri veya cevap üretme. Her ekseni önce uygulanabilir olan
  ürün kaynağı, mevcut davranış, veri modeli, yetki modeli ve ilgili codebase yüzeylerinden
  çözdür; bunlardan çözülemiyorsa kullanıcıyla netleştir. Birini anmak, diğer uygulanabilir
  kanıt yüzeylerini veya bağımsız karar eksenlerini karşılamaz.
- Dosyadan, açık kaynaktan veya hedef sistemden bulunabilecek gerçeği kullanıcı kararına
  çevirme ve değerini uydurma.
- İstenen teslimatın kendisi açık kararları veya belirsizlikleri kaydetmeye yarıyorsa,
  çözülemeyen maddi kararları teslimatta görünür kıl; kullanıcı açıkça etkileşimli
  netleştirme istemedikçe bu kararları kullanıcı cevabına veya sonraki aşama kapısına çevirme.
  Karar uygulanacak hedefi kesinleştirmek için zorunluysa ve teslimat yalnız karar kaydı
  değilse, kaynaklardan çözülemeyen ekseni hedef ajan kullanıcıyla netleştirir.
- Yalnız kullanıcının hedef sonuç, kapsam veya değişiklik yetkisine ilişkin kendi içinde aynı
  anda uygulanamayan açık talimatlarını ya da açık kullanıcı farkının seçilen downstream
  skill'in temel amacı veya zorunlu kapısıyla uygulanamaz çatışmasını Builder soru moduna
  taşı. Aynı anda cevaplanabilecek bütün bağımsız üst düzey çelişkileri birlikte sor; bir
  cevaba bağlı olanı sonraki tura bırak.
- Cevaplanmış üst düzey çelişkiyi yeniden sorma.

Her Builder soru turunda tek soru olsa bile soruları `1.` ile başlayarak sıralı numaralandır.
Her soruda `A.`, `B.` ve gerekirse `C.` seçenekleri ver; `Önerim:` ile bir harf seç ve kısa
`Gerekçe:` ekle.

**Tamamlanma ölçütü:** Önceki adımlarda saptanan her eksik; geri alınabilir sunum tercihi,
bulunabilir gerçek, hedef işe devredilecek maddi karar veya tek promptu engelleyen üst düzey
çelişki olarak sınıflandırılmıştır. Prompt dalında bütün maddi karar eksenleri cevap ya da
seçenek uydurulmadan adlandırılmıştır. Açık karar kaydı üreten teslimatlar çözülemeyen
kararları kullanıcı yanıt kapısına çevirmemiş; uygulanacak hedefi bloke eden kararlar ise
kaynaklardan sonra kullanıcıya devredilmiştir. Soru dalında prompt üretilmemiş; bütün bağımsız
engelleyici çelişkiler aynı numaralı karar cephesinde seçenek, öneri ve gerekçeyle
sorulmuştur. Her iki dalda da ürün kararı Builder tarafından sorulmamış veya cevaplanmamış,
bulunabilir gerçek kullanıcı kararına çevrilmemiş ve çözülmüş çelişki yeniden açılmamıştır.

## 6. Güncellik, Doğrulama ve Kanıtı Orantıla

- Kullanıcı Builder'dan bu turda açıkça dış araştırma istemediyse verilmemiş dış kaynakları
  arama. Güncel sürüm, fiyat, mevzuat, standart veya ürün davranışı gerekiyorsa hedef ajana
  uygulama sırasında güncel ve güvenilir kaynakları kontrol etmesini söyle; değeri, tarihi
  veya bağlantıyı prompta dondurma.
- Kullanıcı açıkça dış araştırma isterse
  [araştırma politikasını](references/research-policy.md) tamamen oku ve uygula.
- Doğrulamayı çalışma prosedürü olarak değil, doğru ile yanlış sonucu ayıran göreve özgü
  davranış, hata ve bütünlük sınırları olarak yaz. Kanıt yöntemini ve test seviyesini hedef
  ajan mevcut sisteme göre seçsin.
- Adımları yalnız yer değiştirmeleri doğruluk, yetki veya karar kalitesini değiştirecekse
  sırala. Olağan workflow sırası ekleme.
- Kullanıcının sonucu değerlendirebilmesi için gerekiyorsa göreve özgü doğrulama kanıtını ve
  çözülememiş maddi kararları bildirmesini iste. Standart değişiklik/test/sonraki-adım özeti
  ekleme.

**Tamamlanma ölçütü:** Önceki adımlarda saptanan her zamana duyarlı ihtiyaç ya açık araştırma
dalında politika uyarınca incelenmiş ya da hedef işte güncel ve güvenilir kaynaktan
doğrulanmak üzere devredilmiştir. Bölüm 2–4'te kapsama defterine alınan her kaynak hükmü,
kullanıcı deltası ve aday yön; doğru ile yanlış sonucu ayıran davranış, hata ve bütünlük
sınırları bakımından değerlendirilmiş; uygulanabilir her sınır promptta göreve özgü doğruluk
yönü olarak temsil edilmiş ya da kapsama kümesinde bulunduğu için elenmiştir. Araştırma
kapısı kullanıcı açmadıkça dış kaynak kullanılmamış; her sıralama talimatı doğruluk, yetki
veya karar kalitesini etkileyen gerçek bir bağımlılığa izlenebilir durumdadır. Yalnız sonucu
değerlendirmek için gerekli göreve özgü kanıt ve açık kararlar teslimata eklenmiştir.

## 7. Downstream Skill ve Yürütme Araçlarını Pasif Tut

Referans belgesindeki araç rolü ve downstream pasifliği kurallarını bu turun eylemlerine ve
hedef işe devrine uygula. Kapsama defteri için yapılan sözleşme keşfini yürütme yetkisi sayma.

**Tamamlanma ölçütü:** Bu turda yapılan araç çağrıları yalnız gerekli salt-okunur görev, araç
ve açık araştırma dalındaki araştırma kaynağı okumalarıdır; hiçbir downstream skill,
yürütme aracı, hedef görev veya dış etki çalıştırılmamıştır. Adı geçen her downstream skill
ve yürütme aracı tam referansı, kullanıcı amacı, koşulu ve bağımlı sırasıyla prompta
devredilmiştir.

## 8. Promptu Oluştur ve Teslim Et

- Açık ve taşınabilir dil tercihi varsa prompt gövdesini o dilde yaz; yoksa normalize taslağın
  baskın dilini, dil karışık veya belirsizse Türkçeyi kullan. Seçilen dili prompt içinde meta
  talimat olarak söyleme. Yalnız kullanıcının açık rol ve biçim tercihlerini taşı; verilmemiş
  persona veya ajan türü ekleme.
- Hedefi, kapsamı, kaynak ve araç referanslarını, rolleri, bağımlı sıraları ve açık tercihleri
  koru.
- Nihai prompttaki her göreve özgü talimatı kullanıcı deltası, referans rolü veya kapsama
  defterinde bütün kapıları geçmiş tek bir yön kaydına bağla. Bu üçünden birine izlenemeyen
  talimatı sil. Her atomik kullanıcı önermesini de nihai metindeki tek bir karşılığa veya
  onu eleyen doğrulanmış kaynak/downstream tekrarına bağla; yalnız yaklaşık konu
  benzerliğini karşılık sayma. Kabul edilmiş yön kaydının dondurulmuş nihai önermesini,
  defterde kanıtlanmamış yeni örnek, parametre, senaryo veya mekanizma eklemeden tam bir kez
  ve ayrı bir cümleyle taşı. Kaynak-türevi bir yönün ayrıntı düzeyinde referans sınırındaki
  aktarım kuralını uygula. Farklı yön kayıtlarını tek yüklem, ortak geçiş veya karar
  zincirinde sentezleme.
- `yukarıdaki`, `önceki` veya `konuştuğumuz` gibi görünmeyen sohbet bağlamına yaslanma. Tam
  kaynak referanslarını taşı; bağımsızlık adına kaynak içeriğini kopyalama.
- Başlık ve listeleri standart şablon olarak değil, yalnız gerçek kaynak ve görev
  karmaşıklığı okunabilirliği artırdığında kullan.
- Kopyalanabilir bloktaki bölünebilir düzyazı satırlarını anlamlı boşluklardan en fazla 95
  karakterde böl. URL, Markdown bağlantısı, dosya yolu, inline code veya başka bölünemez
  öğe bu sınırı aşıyorsa ayrı satıra koy.
- Nihai yanıtta açıklama, değişiklik günlüğü veya iç analiz verme. Yalnız tek ve dolu `text`
  bloğu döndür:

```text
[Kopyalanmaya hazır prompt]
```

Boş taslak, engelleyici kaynak isteği ve üst düzey talimat çelişkisi soru modu bu nihai blok
sözleşmesinin istisnalarıdır.

**Tamamlanma ölçütü:** Boş taslak, kaynak isteği, soru veya final dallarından yalnız biri
seçilmiş ve o dalın çıktı sözleşmesi eksiksiz uygulanmıştır. Final dalında hedef, kullanıcı
deltası, tam referanslar, roller, yetki sınırları, bağımlı sıralar ve açık tercihler
kayıpsızdır; her atomik kullanıcı önermesi ya finalde tek bir karşılığa ya da onu eleyen
doğrulanmış tekrar kaydına sahiptir ve her göreve özgü talimatın tek bir izin verilen
dayanağı vardır. Her kabul edilmiş yönün dondurulmuş önermesi ayrı bir cümlede tam bir kez
bulunur; önerme render sırasında genişletilmemiş ve farklı yönler ortak bir yüklemde
birleştirilmemiştir. Görünmez sohbet bağı yoktur; bölünebilir düzyazı satırları 95 karakteri
aşmaz ve yanıt yalnız tek dolu `text` bloğudur. Sessiz kalite kapısındaki her madde
denetlenmiş ve her uygulanabilir puan boyutu en az 4 olmuştur.

## Sessiz Kalite Kapısı

Final metni teslim etmeden hemen önce aşağıdaki atomik denetimi uygula:

1. Kullanıcı deltalarını tek tek listele; her birinin finaldeki tam karşılığını bul.
   Amaç, görev nesnesi, anlamı daraltan niteleyici, kaynak/skill rolü, sıra, koşul,
   yasak, teslimat ve doğruluk beklentisi karşılıksız kalamaz.
2. Kullanıcının yazdığı bir görev ayrımı veya mercek varsa, onu genel `kaliteyi artır`,
   `tutarlı yap` veya `stres testine tabi tut` sözleriyle değiştirme. Aynı konuya ait
   bağımsız ayrımları ayrı cümlelerde koru.
3. Her dosya, görsel, fixture veya araç kaynağı için kullanıcının verdiği referans dizgesini
   eksiksiz koru; göreli referansı kullanıcı istemedikçe mutlak yola çevirme. Kaynağın
   olgularını özetleme; kaynak-türevi yönlerde referans sınırındaki aktarım kuralını uygula.
4. Açık bir dış etki yasağını nesnesi ve eylemiyle aynen koru. Sıradan aşama sınırını
   olumlu teslimat diline dönüştür; kullanıcının yazmadığı yeni yasak nesneleri
   ekleme.
5. Görsel veya araç kaynağı bir akış, durum, ortam veya sınır karşılaştırması veriyorsa
   ham veriyi kopyalamadan ortak akışı, ayrışan sonucu ve doğruluk etkisini koru.
6. Kaynak/downstream kapsama defterinde olmayan yeni bir karar, mekanizma, yasak, workflow
   veya genel alan merceği finalde bulunamaz. Geniş bir görevde görevin kendi isimlerinden,
   ilişkilerinden ve hedef sonucunun nedensellik zincirinden çıkan kapsanmamış maddi
   ayrımları, çözüm seçmeden ayrı ayrı devret; yalnız görevi veya downstream skill kullanımını
   yeniden söylemek yeterli değildir.
7. Her kaynak hükmü için yönettiği bağımsız çıktı yuvalarını yeniden say. Aynı hüküm birden
   çok yuvayı yönetiyorsa her yuvanın finalde ayrı karşılığını bul; ortak bir üst başlığı,
   mesajı veya kalite yüklemini birden çok yuvanın kanıtı sayma.

Şunlardan biri varsa nihai promptu teslim etmeden düzelt:

- açık hedef, kısıt, kaynak, araç veya skill referansı kaybolmuş;
- atomik kullanıcı önermesi finalde karşılıksız kalmış ya da doğrulanmış semantik tekrar
  kaydı olmadan silinmiş;
- erişilebilir görev kaynağı yön odaklı incelenmemiş;
- kaynak gereksinimi, bulgusu veya downstream skill sözleşmesi gereksiz yere tekrarlanmış;
- kullanıcı taslağındaki doğrulanmış kaynak ya da downstream tekrarı delta sanılarak korunmuş;
- erişilebilir downstream runtime sözleşmesi kapsama çıkarmak için incelenmemiş;
- erişilemeyen downstream sözleşmesi tahmin edilmiş veya bu belirsizlikle kullanıcı farkı
  doğrulanmış tekrar gibi silinmiş;
- erişilemeyen downstream bulunan prompta kullanıcı talimatında olmayan yeni yön eklenmiş;
- konuşma dilinden, çalışma ortamından veya olağan ajan davranışından miras meta eklenmiş;
- kaynakta olmayan çözüm, ürün davranışı veya maddi karar dayatılmış;
- referans dalındaki kaynak-türevi bir aday, referans sınırının kanıt, derinlik, orantı veya
  kapsama kapısından geçmemiş;
- kaynak sessizliği tek başına net yön sayılmış veya geniş downstream yetkisi bütün karar
  uzayını kapsıyor varsayılmış;
- göreve özgü karar ayrımı yerine alan mercekleri kataloğu, Builder analizi ya da çözüm
  hipotezi eklenmiş;
- sıradan aşama sınırı yasak kataloğuna çevrilmiş veya kullanıcıda bulunmayan yasak nesneler
  eklenmiş;
- sıradan aşama sınırının özgün olumsuz cümlesi, olumlu teslimat sırasına dönüştürüldükten
  sonra promptta kalmış;
- korunan bir yasağın nesnesi ya da işlemi daha geniş bir yetki kısıtına çevrilmiş;
- güvenlik, geri döndürülemez dış etki ya da gerçek değişiklik yetkisi sınırı kaybolmuş;
- göreve özgü biçim tercihi kullanıcı istemeden genel varsayılan yapılmış;
- ürün kararı Builder tarafından sorulmuş, cevaplanmış veya görünmez bırakılmış;
- olağan workflow adımı doğrulama ya da derinlik gibi sunulmuş;
- çıktı yalnız genel kalite metniyle büyütülmüş ya da eklenen yön yenilik, maddilik ve çözüm
  dayatmama kapılarının tamamını geçmemiş;
- geniş ve açık karar yüzeyleri bulunan kaynak/downstream'siz bir görev yalnız yeniden
  söylenmiş veya geçen ayrı yönler tek genel kalite cümlesinde eritilmiş;
- kaynak otoritesi uydurulmuş ya da belirsiz çatışma sessizce çözülmüş;
- dış araştırma izinsiz yapılmış, downstream iş çalıştırılmış veya hedef görev başlatılmış;
- çıktı modu yanlış ya da nihai yanıt tek `text` bloğundan fazlasını içeriyor.

Kapıyı geçen promptu sessizce 1–5 arasında değerlendir:

1. net ve göreve özgü yön kazancı ya da kayıpsız kısa devir;
2. kaynak kullanımı ve karar sınırlarının açıklığı;
3. kaynak, downstream sözleşmesi, miras meta ve workflow tekrarından arınmışlık;
4. doğruluk sınırları ile kanıt yeterliliği.

Uygulanabilir ölçütlerin her biri en az 4 değilse promptu iyileştir ve yeniden kontrol et.
