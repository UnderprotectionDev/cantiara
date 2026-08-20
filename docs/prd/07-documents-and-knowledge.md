# Belgeler ve Bilgi

Bu belge Markdown Belgesi, belge sürümü, metnin belge sürümüne sabitlenmesi, Dosya Eki, klasör, hiyerarşi, şablon, arşiv ve Kişisel Wiki davranışlarının tek normatif sahibidir. Kanıt ilişkisinin semantiği, rolü ve üstverisi [Arama, İlişkiler ve Kanıtta](08-search-relations-and-evidence.md) yaşar. Ortak kapsam ve yaşam döngüsü [Domain Modeli ve Yaşam Döngüsünde](02-domain-model-and-lifecycle.md), güvenli kalıcı silme [Veri Güvenliği ve Taşınabilirlikte](13-data-security-and-portability.md) yaşar.

## Belgeler ve ekler

### Yapılandırılmış kayıtların metin gövdeleri

- **İş, Geri Bildirim, Karar, Risk, Varsayım, Açık Soru ve benzeri yapılandırılmış kayıtların çok satırlı gövdeleri ana Markdown'ın güvenli bir alt kümesini kullanır.** Araç çubuğu paragraf, kalın, italik, bağlantı, satır içi kod, madde/numara listesi ve alıntıyı destekler. Yapıştırılan zengin içerik bu alt kümeye temizlenir; çalıştırılabilir HTML saklanmaz veya işlenmez.

- **Tablo, büyük görsel yerleşimi, fenced code block, Mermaid, LaTeX ve uzun spesifikasyonlar tam Markdown Belgelerinde tutulur ve kayda kalıcı ilişkiyle bağlanır.** Görseller gövde içine ikinci bir dosya kopyası olarak gömülmez; bağlı ana Dosya Eki kaydını kullanır.

### Uygulama içi Markdown belge yönetimi

- **Markdown belgeleri uygulama içinde oluşturulur ve düzenlenir.** Ana belge içeriği veritabanında yaşar; kullanıcı bilgisayarında canlı fiziksel `.md` dosyası tutulmaz.

- **Editör Markdown girişine ek olarak tabloları ve fenced code block’ları destekler.** Kod blokları seçilen veya algılanan dile göre syntax highlighting ile okunabilir sunulur; tablo ve kod gösterimi dışa aktarılan Markdown’ın anlamını korur.

- **Fenced `mermaid` kod blokları diyagram olarak, satır içi ve blok LaTeX ifadeleri matematik olarak işlenir.** Kaynak metin her zaman korunur; işleme hatasında bozuk veya boş çıktı yerine hata ve düzenlenebilir kaynak gösterilir. Markdown dışa aktarımı özgün kaynak sözdizimini, PDF dışa aktarımı okunabilir işlenmiş sonucu korur. Draw.io, keyfî iframe/embed, çalıştırılabilir HTML ve AI tarafından çalışan belge blokları ilk ürün editörüne girmez.

- **Belge içi Mermaid sahipliği:** Fenced `mermaid` bloğu Belgenin sahipli içeriğidir; bağımsız kimlik, ilişki, arşiv veya yaşam döngüsü kazanmaz. Projede yeniden kullanılacak teknik model gerektiğinde kullanıcı açık `Teknik Diyagrama dönüştür` eylemini başlatır; önizleme kaynak Belge ve sürümünü, blok konumunu, hedef Teknik Diyagram türünü, parse edilemeyen veya kaybolacak satır/öğeleri, oluşacak köken ilişkisini ve özgün bloğun canlı Teknik Diyagram referansına mı dönüşeceğini yoksa bilinçli bağımsız içerik mi kalacağını gösterir. Kullanıcı geçersiz her öğeyi düzeltir veya nihai kapsamdan açıkça çıkarır. Onay yeni kimlikli `İçe aktarılmış bağımsız kopya`, köken ilişkisi ve seçilen kaynak blok sonucunu tek atomik işlemde oluşturur; hata hiçbir kısmi kayıt, ilişki veya blok değişikliği bırakmaz ve aynı onayın güvenli yeniden denemesi ikinci Teknik Diyagram üretmez. Bağımsız bırakılan özgün blok dış dosya, eşit otorite veya canlı senkronizasyon kaynağı değildir.

- **Teknik Diyagram canlı referansı:** Belge, mevcut bir Teknik Diyagramı veya Diyagram Görünümünü salt okunur canlı blok olarak gösterebilir ve kaynağı açabilir. Blok yerinde düzenleme yüzeyi değildir; kaynak arşivlenir, silinir veya erişilemez olursa eski içeriği güncelmiş gibi göstermeden [ortak kırık referans sunumuna](02-domain-model-and-lifecycle.md#kirik-referans-sunumu) döner. Kesin anlatı veya kanıt gerektiğinde kullanıcı canlı blok yerine adlandırılmış Diyagram Sürümünü sabitler; canlı ve kesin gösterim aynı etiketle sunulmaz.

- **Belge içinde isteğe bağlı İçindekiler bölümü Markdown başlık hiyerarşisinden canlı türetilir.** Başlık yeniden adlandırıldığında veya taşındığında gezinme güncellenir; ayrı başlık kopyaları ya da ikinci bir belge yapısı saklanmaz.

- **Uzun belgelerde belge içi arama ve başlıklardan türeyen gezinti taslağı bulunur.** Kullanıcı gezinti taslağında desteklenen bir başlığı `Bölüme odaklan` ile açabilir. Odak görünümü aynı Belge kaydının kararlı bölüm kimliğiyle çözümlenen başlık ve alt içeriğini düzenler; ayrı Page, belge veya içerik kopyası oluşturmaz. Kaynak belge yolu ve `Tam belgeye dön` eylemi görünür kalır. Başlık yeniden adlandırıldığında veya belge içinde taşındığında odak aynı kimliği izler; bölüm silinir ya da çözümlenemezse tam Belge açılır ve kayıp odak açıklanır.

- **Belge içi arama güvenli `Bul ve değiştir` davranışı sunar.** Varsayılan kapsam yalnız açık Belgedir; kullanıcı açıkça seçtiğinde o Belgenin bütün alt Belgeleri de kapsama girer. Önizleme eşleşmeleri Belge ve başlık bağlamına göre gruplar, toplam sayıyı gösterir ve kullanıcının tek tek eşleşme veya Belgeleri işlemden çıkarmasına izin verir. Çok Belgeli değişiklik tek atomik işlem ve ilişkilendirilmiş Belge sürümleri olarak uygulanır; kısmi hata hiçbir Belgeyi sessizce yarım durumda bırakmaz ve bütün işlem tek eylemle geri alınabilir.

- **Bul/değiştir varsayılan olarak düz metin kullanır; kullanıcı açıkça `Gelişmiş` modu seçtiğinde regex eşlemesi açılır.** Desteklenen regex lehçesi görünür biçimde belgelenir, geçersiz kalıp uygulanmaz ve açıklanabilir hata gösterir. Kalıp uzunluğu, çalışma süresi ve karmaşıklığı güvenli motor veya eşdeğer katı sınırlarla korunur; süre sınırını aşan işlem hiçbir değişiklik yapmadan durur.

- **Editör geçici `Focus Mode` sunar.** Bu mod uygulama kabuğunu azaltır fakat Belgenin kapsamını, içeriğini, odaklanılan bölümünü veya kaynak yolunu değiştirmez; `Esc` ve görünür bir çıkış eylemiyle kapanır. Mod, açık sekme, scroll, panel veya son çalışma bağlamını oturumlar arasında saklamaz ve kapsam dışı recent-context geri yükleme özelliğine dönüşmez.

- **Editör çağrı kutusu, alıntı bloğu, yatay ayraç, metin vurgusu, açılıp kapanabilir bölüm, görsel hizalama ve görsel altyazısı gibi okunabilirliği artıran sunumları destekler; bunlar dışa aktarılan Markdown’da anlamlı ve okunabilir bir karşılık taşır, ayrı içerik kaydı oluşturmaz.** Bu sunumlar satır içi yorum veya ortak review dizisi oluşturmaz.

- **Kullanıcı belge metnine mevcut İş, Belge, Karar, Risk, Varsayım, Açık Soru, Kaynak, Geri Bildirim, Kilometre Taşı, Proje Sürümü ve Üretim Olayını okunabilir adıyla satır içi referans olarak ekleyebilir.** Referans kararlı iç kimliği hedefler, kaynağı açar ve hedef kayıtta [kullanım bağı](02-domain-model-and-lifecycle.md#kullanim-baglari) oluşturur; standart ilişki kurmaz ve içeriği belgeye kopyalamaz. Markdown dışa aktarımı okunabilir ad ve anahtarı korurken kesin kimlik eşlemesini manifestte taşır. Referans ilişkili kaydın özel veya herkese açık görünürlüğünü belgeye miras bırakmaz.

- **Mevcut İş ayrıca Belgeye sınırlı, eyleme açık `Canlı İş bloğu` olarak eklenebilir.** Blok iş anahtarı, başlık, tür, durum, öncelik ve varsa planlanan başlangıç/hedef tarihini aynı kaynak kayıttan gösterir. `Durumu değiştir`, `Kapat` ve `Kaynak kaydı aç` eylemleri normal İş yetkilerini, durum semantiğini, kapanış sonucu seçimini ve kapanış kontrollerini kullanır; Belgeye özgü checkbox, görev kopyası veya ikinci yaşam döngüsü oluşturmaz.

- **Canlı İş bloğunun bağlantıyla sınırlı paylaşım, herkese açık yayın ve export kapsamı ayrı öğe olarak önizlenir.** Markdown export okunabilir iş anahtarı, başlık, son görülen temel alanlar ve kaynak referansı taşır; manifest kararlı iç kimliği korur. Salt okunur çıktıda eylemler çalışmaz ve blok ilişkili özel alanlara görünürlük kazandırmaz.

- **Kullanıcı seçtiği bir belge metnini önizlemeden sonra tam olarak bir yeni İş, Karar, Risk, Varsayım veya Açık Soru kaydına dönüştürebilir.** Özgün metin belgede kalır; yeni kayıt seçilen kesin belge sürümündeki metin parçasına kanıt ilişkisiyle bağlanır. Tek eylem birden fazla kayıt üretmez ve kullanıcı kayıt türünü, başlığı, hedef projeyi ve oluşacak ilişkiyi kaydetmeden önce görür.

- **Seçim yalnız madde işaretli veya numaralı bir liste içeriyorsa kullanıcı normal tek-kayıt dönüşümünden ayrı `Toplu dönüştür` eylemini başlatabilir.** Önizleme her liste satırını ayrı İş adayı olarak gösterir; kullanıcı adayın başlığını, türünü ve hedef projesini düzenleyebilir, geçersiz adayı düzeltebilir veya açıkça kapsamdan çıkarabilir. Tek açık onaydan sonra seçilen nihai küme atomik ve idempotent uygulanır: bütün adaylar bağımsız İş olur ve kendi liste maddesinin bulunduğu kesin Belge sürümüne köken ilişkisiyle bağlanır ya da hiçbir İş oluşturulmaz. Kayıt bazlı kısmi başarı ve aynı satırı sessizce tekrar oluşturma yoktur.

- **Mevcut bir Akıllı Koleksiyonun adlandırılmış görünümü belgeye canlı blok olarak eklenebilir.** Blok kaynak koleksiyonun üyelik koşullarını ve kaynak görünümün sunum ayarlarını kullanır; ayrı sorgu, üyelik kuralı, kayıt kümesi veya kopyalanmış içerik oluşturmaz ve kaynağı görünür biçimde açar. Dışa aktarılan Markdown okunabilir bir görünüm snapshot’ı, manifest ise kaynak koleksiyon ve görünüm tanımını taşır. Özel veya herkese açık paylaşımda blok yalnız ayrıca paylaşılmasına izin verilen kayıt ve alanları gösterebilir; gömme işlemi görünürlüğü ilişkiler üzerinden genişletmez.

- **Bir Markdown Belgesindeki adlandırılmış bölüm, başka Markdown Belgelerine ve desteklenen yapılandırılmış kayıt gövdelerine `Salt okunur canlı içerik bölümü` olarak eklenebilir.** Gömülü bölüm ayrı içerik kopyası oluşturmaz; kararlı kaynak belge ve bölüm kimliğini hedefler, güncel içeriği gösterir ve kaynak Belgeyi, son güncelleme zamanını ve ortak `Kaynak kaydı aç` eylemini görünür tutar. İçerik yalnız kaynak Belgede düzenlenir; gömülü örnekten yapılan düzenleme kaynağı sessizce değiştirmez.

- **Kaynak Belge kapsam değiştirdiğinde aynı iç kimlikle bağ korunur; bölüm yeniden adlandırıldığında veya belge içinde taşındığında kararlı bölüm kimliği izlenir.** Kaynak bölüm silinir, erişilemez olur veya artık güvenle çözümlenemezse gömülü yüzey sessizce eski içerik göstermez ve açık bir kırık/erişilemez referans durumu sunar. Doğrudan veya dolaylı döngüsel canlı bölüm gömmeleri uygulanmadan önce engellenir.

- **Canlı bölüm gömme işlemi kaynak görünürlüğünü, paylaşım veya yayın iznini miras bırakmaz.** Bağlantıyla sınırlı paylaşım, herkese açık yayın ve export önizlemesi gömülü kaynağı ayrı kapsam öğesi olarak listeler; onaylı export okunabilir anlık görünümü, manifest ise kaynak belge/bölüm kimliğini taşır. Canlı bölüm güncellenmeye devam ederken `Sürüme sabitlenmiş metin parçası kanıtı` seçilmiş kesin belge sürümünü korur; iki mekanik kullanıcı arayüzünde birbirinin yerine sunulmaz.

- **İlk ürün belge türleri `Genel`, `PRD`, `Plan`, `Spec`, `Araştırma Notu` ve `Persona`dır.** Kullanıcı belge oluştururken türü seçebilir veya sonradan değiştirebilir; tür değişikliği içeriği, kimliği ya da ilişkileri değiştirmez. İlk ürün kullanıcı tanımlı belge türü oluşturmaz. Araştırma belgesi bir Araştırma İşinin çıktısı olabilir ancak İşin kendisi değildir. Karar kayıtları belge alanında genel belge türü değil, karar alanındaki özelleşmiş kayıtlardır.

- **Dışa aktarmada belgeler insan tarafından okunabilir `.md` dosyalarına dönüştürülür.**

### Belge kapsamı, taşıma ve kopyalama

- **Her Belge tam olarak bir ana kapsamda yaşar:** bir Proje veya Kişisel Wiki. `Taşı` yalnız kaynak Proje etkin durumdayken başlatılabilir. Kullanıcı kök Belgeyi, açıkça seçtiği çocuk Belgeleri ve yalnız bu kaynakların sahip olduğu Dosya Eklerini aynı iç kimlik, sürüm geçmişi ve arşiv durumuyla hedef kapsama taşır. Seçilmeyen çocuklar, başka kapsamın sahip olduğu ekler ve ilişki grafiğindeki diğer kayıtlar sürüklenmez; ilişkiler korunabiliyorsa kapsamlar arası ilişki olarak kalır, aksi durumda etki önizlemesinde çözüm ister.

- **İşlemden önce hedef kapsam, seçimin tamamı, görünürlük, çözülemeyecek referanslar ve dış yayın etkisi gösterilir.** Etkin bir Dış yüzeyi bulunan Belge taşınmadan önce yüzey açıkça iptal edilmelidir. İptal edilen eski yüzey ve revizyon zinciri özgün kapsamda tarihsel kalır; hedef kapsamda paylaşım/yayın yeni Dış yüzey, URL, token ve revizyon zinciri oluşturur. Taşıma hiçbir içeriği kendiliğinden herkese açık yapmaz.

- **`Kopyala` ayrı ve açık bir eylemdir.** Yeni iç kimliğe sahip bağımsız bir belge üretir, kaynak belgeyi köken olarak kaydeder ve başlangıç içeriğini kopyalama anındaki seçili sürümden alır. Sonraki düzenlemeler iki belge arasında eşzamanlanmaz; sürüm geçmişi, ilişkiler, geri bağlantılar, paylaşım/yayın durumu ve proje kapsamı yeni belgeye kopyalanmaz.

### Belge şablonları

- **Kullanıcı proje veya Kişisel Wiki kapsamında sıfırdan yeniden kullanılabilir belge şablonu oluşturabilir ya da mevcut belge üzerinde açık `Şablona dönüştür` eylemini başlatabilir.** Dönüşüm önizlemesi şablona alınacak içerik iskeletini ve basit metin yer tutucularını gösterir; kaynak belgeyi taşımaz, arşivlemez veya değiştirmez. Yer tutucular şablondan belge oluşturulurken kullanıcıdan değer ister, ancak özel alan, form şeması, formül veya canlı bağlantı oluşturmaz.

- **Şablondan üretilen belge yeni iç kimlikli bağımsız ana kayıttır; yalnız şablon içeriğini, yer tutucular için girilen değerleri ve açıkça desteklenen başlangıç sunumunu alır.** Kaynak belgenin ve şablonun geçmişi, ilişkileri, yayın/paylaşım durumu, arşiv durumu ve proje kapsamı yeni belgeye taşınmaz. Şablonda daha sonra yapılan değişiklikler daha önce üretilmiş belgeleri güncellemez.

- **Ürün kullanımı varsayılan olarak isteğe bağlı hazır `Personal Review` Belge şablonu sunar.** Şablon sırasıyla `Period`, `What changed?`, `What worked?`, `What was difficult?`, `Decisions and learnings`, `What will I change next?` ve `Related records` bölümlerini taşır. Kullanıcı şablonu kullanabilir, bütün bölümleri değiştirebilir/silebilir, kopyalayabilir veya görmezden gelebilir. Bu şablon ayrı toplantı/review kayıt türü, katılımcı, davet, katılım takibi veya zorunlu kullanım sıklığı oluşturmaz. Review metninden İş, Karar, Risk, Varsayım veya Açık Soru üretmek yalnız mevcut açık metinden-kayıta dönüşüm eylemleriyle, kesin kaynak Belge sürümü ve köken/kanıt bağı korunarak gerçekleşir.

### Çözülmemiş yer tutucu kontrolü

<a id="yer-tutucu-soz-dizimi"></a>
- **Çözülmemiş yer tutucu yalnız `{{alan_adı}}` söz dizimidir.** `alan_adı` küçük harf, sayı ve alt çizgiden oluşur ve harfle başlar. Kod bloğu ve satır içi kod içindeki eşleşmeler uyarı üretmez. Başka süslü parantez veya doğal dil eksikliği yer tutucu sayılmaz.

- **Ürün, kendi tanımladığı açık yer tutucu sözdizimini kullanan çözülmemiş metin alanlarını herkese açık yayın ve dış salt okunur paylaşım öncesinde denetler.** Kontrol şablondan gelmiş yer tutucularla sınırlı değildir; desteklenen yayımlanacak veya paylaşılacak metindeki aynı açık sözdizimini kullanır. Eşleşmeler kaynak kayıt, alan ve metin bağlamıyla önizlemede listelenir.

- **Kullanıcı içeriğe dönüp yer tutucuyu çözebilir veya ayrı `Yine de yayımla/paylaş` onayıyla işlemi sürdürebilir.** Sistem normal cümlelerden anlamsal eksiklik tahmin etmez, AI kullanmaz, yer tutucuyu kendiliğinden doldurmaz ve bu kontrolü genel zorunlu alan, belge tamamlama puanı ya da kullanıcı tanımlı süreç kapısına dönüştürmez.

### Belge arşivi

- **Kullanıcı güncel çalışmada görünmesini istemediği belgeyi silmeden arşivleyebilir.** Arşiv çöp kutusundan ayrıdır; belge kimliğini, sürüm geçmişini, ilişkileri, geri bağlantıları ve çocuk bağlarını korur, normal gezinme ve aramada varsayılan olarak gizlenir ve arşiv filtresinden geri yüklenebilir. Üst belgeyi arşivleme veya geri yükleme öncesinde çocuk belgelere etkisi gösterilir; çocuklar kullanıcı onayı olmadan silinmez ya da başka kapsama taşınmaz.

### Tek belge dışa aktarma

- **Kullanıcı tek bir belgeyi Markdown veya PDF olarak dışa aktarabilir.** Canlı Akıllı Koleksiyon blokları ve diğer canlı kaynak blokları dışa aktarma anının tarihli, kaynağı etiketlenmiş salt okunur snapshot’ına dönüşür; çıktı canlı erişim ya da gizli kayıt yetkisi taşımaz.

- **Markdown çıktısı tek bir `.md` dosyasında başlık hiyerarşisini, tabloları, fenced code block’ları, Mermaid ve LaTeX kaynak sözdizimini, görsel/ek referanslarını ve asıl kayıtların okunabilir ad/anahtarlarını korur.** Dosyanın sonundaki okunabilir manifest her referansın kararlı ürün kimliğini, özgün dosya adını, kesin Dosya Eki sürümünü ve ayrı indirilen binary için güvenli göreli yolunu taşır. Binary içerik Markdown'a gömülmez; kullanıcı seçerse özgün dosyalar ayrıca indirilir. Çıktı süresi dolan Cantiara URL'sine bağımlı bırakılmaz ve ayrı dosya alınmadıysa eksik eki okunabilir ad/manifest referansıyla açıklar. PDF çıktısı başlık seviyelerini, tabloları, syntax-highlight edilmiş kod bloklarını, işlenmiş Mermaid/LaTeX sonuçlarını ve erişim izni bulunan görselleri sayfa düzeni içinde okunabilir biçimde korur. İşlenemeyen teknik blok boş bırakılmaz; hata etiketiyle birlikte okunabilir kaynak fallback’i gösterilir. Word dışa aktarımı ilk üründe yoktur.

- **Belge PDF çıktısının erişilebilirlik sınırı ortak export sözleşmesini izler.** Etiketli PDF/WCAG garantisi, kullanıcıya gösterilecek uyarı ve erişilebilir Markdown alternatifi yalnız [standart dışa aktarma sözleşmesinde](13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma) tanımlanır.

### Belge sürüm geçmişi

- **Kullanıcı bir Belgenin önceki sürümlerini karşılaştırabilir ve seçtiği sürümü geri yükleyebilir.** Sürüm geçmişi veritabanı içindeki uygulama değişikliklerine dayanır; harici editör senkronizasyonu veya eşzamanlı ortak düzenleme sunmaz.

- **Güncel olmayan taban revizyonuyla Belge kaydetme mevcut sürümün üzerine yazmaz.** Reddedilen metin, Belgeyle aynı kapsam ve yaşam döngüsünde yaşayan Çakışma Taslağı olarak korunur. Kullanıcı güncel sürüm ile taslağı karşılaştırır; seçtiği parçaları uygulayıp yeni Belge sürümü kaydeder, taslağın seçtiği veya bütün içeriğinden kullanıcı başlıklı yeni kimlikli bağımsız Belge oluşturur ya da taslağı siler. Yeni Belge aynı kanonik kapsamda yaşar ve kaynak Belge/Taslağa görünür köken bağı taşır; kaynak geçmişini, çocukları, Dosya Eklerini, ilişkileri, yayın veya paylaşım durumunu miras almaz. Başarılı uygulama, yeni Belge oluşturma veya silme taslağı çözer. Taslak otomatik yeniden denenmez; çözülmeden önce arama, paylaşım, yayın, export veya Belge geçmişine girmez.

- **Online-only bağlantı kesildiğinde editör mevcut bellek tamponundan sonra yeni düzenleme kabul etmeyi durdurur; son başarılı kayıt ve henüz gönderilmemiş içerik riski bloklayıcı biçimde görünür, `Kopyala` ve `İndir` kurtarma eylemleri sunulur.** Yeniden bağlanınca son taban revizyonuyla kayıt denenir ve gerekirse Çakışma Taslağı oluşur. Uygulama ya da cihaz kaybında sunucuya gönderilmemiş tamponun korunacağı vaat edilmez.

### Spec değişikliği inceleme kuyruğu

- **Bir Özelliğin `Birincil spec` Belgesinde yeni sürüm kaydedildiğinde kullanıcı, önceki sürümle kesin farkı ve değişiklikten etkilenme adayı olan ana kayıtları `Spec değişikliği inceleme kuyruğu`nda birlikte inceleyebilir.** Adaylar yalnız Birincil spec bağı, kararlı Belge bölümü referansı, satır içi referans, canlı içerik kullanımı, sürüme sabit kanıt ve diğer açık kayıtlı ilişkilerden deterministik olarak bulunur. Sistem metinden anlamsal etki tahmin etmez, AI kullanmaz ve yalnız başlık ya da metin benzerliğiyle kayıt eklemez.

- **Kuyruk değişen bölümü, önceki ve yeni Belge sürümünü, aday kaydı ve neden aday olduğunu gösterir.** Kesin bölüm bağı bulunmayan fakat Belgenin tamamına Birincil spec veya standart ilişkiyle bağlı kayıtlar `Belge düzeyinde aday` olarak ayrıca işaretlenir; belirli bir metin değişikliğinden etkilenmiş gibi sunulmaz.

- **Kullanıcı her adayı `Bekliyor`, `Gözden geçirildi` veya `Etkilenmedi` olarak işaretleyebilir ve isteğe bağlı kısa not ekleyebilir.** Bu değerler yalnız kesin spec sürüm değişikliği ile aday kayıt arasındaki inceleme üstverisidir; aday kaydın durumunu, içeriğini, önceliğini, ilişkilerini veya planlama üyeliğini değiştirmez. Yeni spec sürümü önceki açık incelemeyi ezmez; her değişiklik kendi kesin sürüm çifti, adayları ve inceleme sonuçlarıyla korunur.

- **Kullanıcı aday üzerinde açık `Takip işi oluştur` eylemini başlatabilir.** Oluşacak İş, hedef proje, başlangıç durumu, değişen spec sürümleri ve aday kaynak ilişkisi onaydan önce gösterilir; onay tam olarak bir yeni İş oluşturur ve inceleme sonucunu kendiliğinden kapatmaz. Kuyruk genel değişiklik etki analizi, zorunlu approval kapısı, otomatik alan güncellemesi veya toplu takip işi üretimi oluşturmaz.

### Sürüme sabitlenmiş metin parçası kanıtı

- **Belge, Geri Bildirim, metin gövdesi bulunan Kaynak ve Kullanıcı Araştırması Oturumu kayıtlarının içerik sürümleri korunur.** Kullanıcı seçili metinde `Mevcut kayda kanıt olarak bağla` eylemini başlatıp kesin parçayı mevcut İş, Karar, Risk, Varsayım veya Açık Soru kaydına kanıt olarak bağlayabilir; aynı parça birden fazla ana kayıtla farklı anlamlarda ilişkilendirilebilir. Uygulamadan önce hedef kayıt, kesin kaynak sürümü, seçili aralık ve oluşacak ilişki önizlenir. Kaynak metin yerinde kalır; hedefe metin kopyası taşınmaz. `09` ayrı bir alıntı sistemi kurmaz.

- **Kanıt bağı sürüm kimliğini, seçili aralığı ve parçayı anlamlandıracak sınırlı çevre metnini korur.** Kaynak görünümünde seçili parça görünür vurgu ve hedef geri bağlantılarıyla, hedef kayıtta ise özgün kaynağı açan kanıt olarak sunulur. Kaynak metnin yeni sürümü oluştuğunda bağ sessizce taşınmaz; eski kanıt okunabilir kalır, yeni sürüm bulunduğu belirtilir ve kullanıcı isterse yeni parçayı önizleyerek açıkça yeniden bağlar. Redaksiyon içerik erişimini kapatabilir fakat tarihsel bağın varlığını ve gerekçesini korur.

- **Kanıt bağının rolü, kullanıcı yorumu ve nitelik üstverisi bu belgede tanımlanmaz.** `Kanıt Rolü`, `Kullanıcı yorumu/öğrenimi` ve `Kanıt niteliği` ile hedef kaydın kanıt yüzeyinin davranışı yalnız [Kanıt Rolü ve kanıt ilişkisi üstverisi sözleşmesinde](08-search-relations-and-evidence.md#kanit-rolu-ve-iliski-ustverisi) yaşar; bu belge yalnız metnin belge sürümüne sabitlenmesini, aralığın korunmasını ve yeniden bağlanmasını tanımlar.

- **Kanıtı yeni Kaynak sürümündeki başka bir aralığa açıkça yeniden bağlama önizlemesi mevcut rol ve yorumu ayrı gösterir.** Kullanıcı bunları korumayı veya değiştirmeyi açıkça seçer; kaynak aralığını değiştirmek rolü sessizce değiştirmez.

- **Kullanıcı aynı seçili metinde `Yeni kayda dönüştür ve bağla` eylemiyle tam olarak bir yeni İş, Karar, Risk, Varsayım veya Açık Soru taslağı oluşturabilir.** Önizleme hedef türü, seçili metinden açıklanabilir biçimde alınacak başlık/gövde, kesin kaynak Belge sürümü ve metin aralığı ile oluşacak iki yönlü köken/kanıt bağını gösterir. Kullanıcı düzenleyip onaylamadan ana kayıt oluşmaz; kaynak metin silinmez veya değiştirilmez. Akış AI kullanmaz, tek eylemde birden fazla kayıt üretmez ve yeni kaydın normal tür/alan kurallarını atlamaz.

### Dosya ekleri

- **PDF, CSV, log, görsel ve benzeri ekler uygulama tarafından yönetilen depolamada özgün biçimleriyle saklanır.** Her ek [ortak kapsam ve sahiplik sözleşmesine](02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik) göre tam olarak bir proje veya Kişisel Wiki kapsamında yaşayan ana kayıttır. Başka kapsamlardaki kayıtlar aynı eke ilişki kurabilir; ilişki ekin sahipliğini veya görünürlüğünü değiştirmez. Kullanıcı seçili eki özgün biçiminde indirebilir.

- **İlk ürün dosya yetenek matrisi aşağıdadır.** Boyut dosyanın açılmış değil yüklenen özgün byte boyutudur; limit aşımı yükleme başlamadan veya aktarım sırasında anlaşılır hata üretir.

| Türler | Azami boyut | Tarayıcı davranışı | Metin indeksleme |
| --- | ---: | --- | --- |
| JPEG, PNG, WebP, durağan/animasyonlu GIF | 25 MB | Görsel önizleme | Yalnız ad ve üstveri |
| PDF | 50 MB | Sayfalı önizleme | Güvenli metin katmanı varsa |
| CSV | 25 MB | Sınırlı satır önizlemesi | Evet |
| TXT, Markdown, JSON ve düz log | 10 MB | Güvenli düz metin önizlemesi | Evet |
| MP3, M4A, WAV | 100 MB | Kullanıcı başlatmalı oynatma | Hayır |
| MP4, WebM | 250 MB | Kullanıcı başlatmalı oynatma | Hayır |
| ZIP | 100 MB | Yalnız indirme ve export; içeriği çalıştırılmaz | Hayır |

- **SVG, HTML, çalıştırılabilir dosya, script, macro-enabled ofis belgesi ve matriste bulunmayan MIME/uzantı ilk üründe reddedilir.** MIME ile uzantı uyuşmazlığı sessizce düzeltilmez.

- **Bir çalışma alanı en fazla 25 GB özgün Dosya Eki içeriği ve 20.000 dosya sürümü tutar.** Aktif, Arşiv ve Çöp Kutusundaki byte'lar kota hesabına dahildir; fiziksel kalıcı silme tamamlanmadan kota serbest bırakılmaz. Geçici export ve import/yükleme staging kullanımı arayüzde ayrı gösterilir. Kullanım yüzde 80'e ulaştığında sahip uyarılır; kota aşılırsa yeni yükleme ve yeni dosya sürümü engellenir, mevcut içerik okunabilir, indirilebilir ve silinebilir kalır.

- **Normal Dosya Eki olarak yüklenen ZIP açılmaz ve yalnız ürün içinden indirilir veya statik export'a girer.** Zararlı yazılım taraması başarıyla tamamlanmamış ZIP, bağlantıyla sınırlı veya herkese açık Dış yüzeye eklenemez; tarama ilk üründe bulunmadığı için ZIP'in bu dış yüzeylere girmesi fail-closed engellenir. İlk ürün ZIP, klasör veya çok dosyalı Markdown paketi içe aktarmaz.

- **İlk ürün için sürümlenen bir dosya yetenek matrisi; kabul edilen MIME/uzantıları, azami boyutu, tarayıcı içi önizleme veya oynatma desteğini, metin indeksleme uygunluğunu ve yalnız indirme davranışını birbirinden ayrı tanımlar.** Dosyanın yüklenebilmesi önizlenebileceği veya içerik aramasına katılacağı anlamına gelmez. Desteklenen bir yüklemede önizleme bulunmaması dosyanın saklanmasını veya özgün biçimde indirilmesini sessizce engellemez; MIME/uzantı uyuşmazlığı ve güvenlik doğrulaması yükleme öncesinde açık hata üretir.

- **İlk ürün izin verilen tür, boyut, MIME/uzantı uyumu ve güvenli önizleme sınırlarını uygular ancak dosya içeriğinde zararlı yazılım taraması yapmaz.** Bu nedenle taranmamış ZIP yalnız yukarıdaki iç kullanım sınırında kalır. Genel fail-closed tarama ve karantina davranışı [gelecek yönünde](18-future-directions.md#fail-closed-zararlı-dosya-taraması) ayrıca değerlendirilir.

- **Desteklenen JPEG, PNG, WebP ve GIF sürümü kabul edildiğinde özgün dosya değişmeden kalır; arka plan worker'ı boyut, yön ve güvenli görsel üstverisini çıkarıp küçük/orta Gallery thumbnail'larını immutable R2 türev anahtarlarında üretir.** Görsel boyutları, animasyon kare sayısı, decode belleği, CPU süresi ve yeniden deneme sayısı katı sınırlarla korunur. Sınırı aşan fakat byte/tür doğrulaması geçerli özgün dosya indirilebilir kalır; önizleme `Kullanılamıyor` fallback'i gösterir ve dosya bozuk sayılmaz. EXIF içindeki konum ve cihaz gibi hassas alanlar türeve taşınmaz. Türev ayrı Dosya Eki veya dosya sürümü değildir; kesin özgün sürüme bağlı yeniden üretilebilir cache'tir ve kaynak sürüm silindiğinde aynı yaşam döngüsüyle temizlenir.

- **Thumbnail işi idempotenttir ve özgün sürüm parmak izini anahtar olarak kullanır.** Üretim gecikirse veya başarısız olursa özgün dosya bozulmuş sayılmaz; güvenli tür fallback'i gösterilir, hata gözlemlenebilir olur ve sınırlı yeniden deneme yapılır. Gallery, referans veri setinde tam boyutlu özgün görselleri liste thumbnail'ı olarak indirmez.

- **Dosya önce erişilemeyen geçici nesne anahtarına yüklenir; byte boyutu, MIME/uzantı, içerik hash'i ve tür güvenliği doğrulandıktan sonra idempotent finalize işlemi aynı atomik sınırda Dosya Eki/sürüm üstverisini oluşturur ve onu doğrulanmış kesin nesneye erişilebilir kılar.** Finalize başarısızsa görünür Dosya Eki veya eksik nesneye işaret eden üstveri oluşmaz; sahipsiz geçici nesne süreli sweep ile temizlenir.

- **İlk ürün yüklemeyi kaldığı byte'tan sürdürmez.** Bağlantı kaybında aktarım sıfırdan yeniden başlatılır, durum açıkça gösterilir ve başarısız deneme görünür Dosya Eki oluşturmaz. Normal dosya yükleme yeni bir Dosya Eki ana kaydı oluşturur. Kullanıcı mevcut ekte açık `Yeni sürüm yükle` eylemini başlattığında doğrulanan yeni dosya aynı ek kaydının sürüm zincirine eklenir; işlem uygulanmadan önce hedef ek, mevcut sürüm ve yüklenecek dosya gösterilir. Önceki sürümler özgün biçimleri ve üstverileriyle görüntülenebilir ve indirilebilir kalır.

- **Ek düzeyindeki genel ilişkiler aynı ana kaydı izler.** Kesin dosya içeriğine, konuma veya yayın anına bağlı ilişkiler ise ilgili sürümü sabitler ve yeni sürüme sessizce taşınmaz. Yeni sürüm yüklemek mevcut herkese açık snapshot’ı değiştirmez; yeni dosya ancak açık yayın farkı, önizleme ve onaydan sonra herkese açık olur.

- **Desteklenen yüklenmiş ses ve video dosyaları kesin Dosya Eki sürümüne bağlı olarak uygulama içinde oynatılabilir.** Oynatma yalnız kullanıcı eylemiyle başlar; varsayılan autoplay yoktur. Ses, hız, tam ekran ve isteğe bağlı döngü kontrolleri sunulur, özgün dosya indirilebilir kalır ve yeni dosya sürümü mevcut oynatma referansına sessizce geçirilmez.

### Görsel sunum ve işaretleme

- **Görsel görüntüleyicisi ve Moodboard, kesin Dosya Eki sürümüne bağlı kalem, vurgulayıcı, ok ve dikdörtgen araçlarıyla sınırlı bir işaretleme katmanı sunar.** Katman özgün dosyadan ayrı, geri alınabilir üstveridir; dosya içeriğini değiştirmez, yeni Dosya Eki veya dosya sürümü oluşturmaz ve daha sonraki ek sürümüne kendiliğinden taşınmaz.

- **İşaretleme yorum, mention, review, görev veya kalıcı ilişki üretmez.** Kullanıcı ayrıca aşağıdaki konuma bağlı iş eylemini başlatabilir; iki davranış birbirinin yerine örtük kayıt oluşturmaz. Özel veya herkese açık paylaşım önizlemesi kaynak görsel ile işaretleme katmanını ayrı yayımlanabilir öğeler olarak gösterir; görseli onaylamak katmanı otomatik paylaşmaz.

### Belge hiyerarşisi ve klasörleri

- **Kullanıcı proje veya Kişisel Wiki içindeki belgeleri ve bu kapsamlardaki Dosya Eklerini isteğe bağlı klasörlerle düzenleyebilir.** Klasör konumu yalnız uygulama içi gezinme ve düzenleme bilgisidir; kaydın ana kimliğini, türünü, kapsamını, ilişkilerini, sürüm zincirini, paylaşım durumunu veya özgün içeriğini değiştirmez ve içerik kopyası oluşturmaz.

- **Klasörlere ek olarak her belge aynı kapsamda en fazla bir üst belgeye bağlanabilir ve çocuk belgeler taşıyabilir.** Hiyerarşi kök belge dâhil en fazla üç belge seviyesidir; başka bir ifadeyle kökün altında en fazla çocuk ve torun seviyeleri bulunabilir. Daha derin bir taşıma veya içe aktarma isteği sessizce düzleştirilmez; hedef hiyerarşi önizlemesinde engellenir ve kullanıcıdan belgeyi başka üst hedefe yerleştirmesi istenir.

- **Bu hiyerarşi gezinme ve anlatı yapısıdır; belgenin kimliğini, ilişkilerini veya görünürlüğünü örtük biçimde değiştirmez.** Üst belgeyi taşımak, arşivlemek veya silmek çocuklara uygulanacak etki önizlenmeden toplu işlem yapmaz.

- **Üst Belge, mevcut çocuk Belgelerini isteğe bağlı sınırlı `Card` sunumunda gösterebilir.** Kart yeni kayıt veya içerik kopyası değildir; başlığı, kısa metin önizlemesini ve varsa desteklenen ilk uygun görseli aynı alt Belgeden otomatik türetir. Önizleme önceliği gövde içindeki ilk erişilebilir desteklenen görsel, ardından ilk anlamlı düz metin parçası, son olarak başlık ve tür fallback'i biçimindedir. Kullanıcı kart için ayrı kapak, serbest stil, elle sürdürülen ikinci özet veya thumbnail kaydı oluşturamaz.

- **Çocuk Belge Card'ı kaynağı açar ve üst/çocuk bağını değiştirmez.** Bağlantıyla sınırlı paylaşım, herkese açık yayın ve export önizlemesi çocuk Belgeyi ve kartta gösterilecek görsel/metin snapshot'ını ayrı kapsam öğeleri olarak listeler; kart ilişkili Belgeye görünürlük izni vermez.

- **Klasörler kendi proje veya Wiki kapsamından dışarı taşmaz.** Çalışma alanı genelindeki hazır tür dizinleri, Evrensel Arama, ilişkiler ve Akıllı Koleksiyonlar kayıtları klasör ve üst belge konumundan bağımsız olarak bulmaya devam eder. Bilgisayarda uygulamayla canlı eşzamanlanan klasör veya fiziksel Markdown doğruluk kaynağı oluşturulmaz.

- **İlk ürün klasör, üst Belge, etiket, Akıllı Koleksiyon ve Favorilerden ayrı elle üyelikli Belge Koleksiyonu oluşturmaz.** Bu sınır mevcut bilgi mimarisine ikinci üyelik kaynağı eklemez; olası `Kaydedilmiş Belge Seti` yalnız [Gelecek Yönleri](18-future-directions.md#kaydedilmis-belge-setleri) altında değerlendirilir.

### Konuma bağlı görsel iş bağlamı

- **Kullanıcı desteklenen görsel, PDF veya bir Ekranın kesin Wireframe sürümü üzerinde bir nokta ya da bölge seçip bu konumu yeni veya mevcut tam iş öğesine köken olarak bağlayabilir.** Yeni iş oluşturulacaksa iş ve oluşacak kaynak ilişkisi uygulanmadan önce gösterilir; gözlem kendiliğinden işe veya alt işe dönüşmez.

- **Konum bağı seçilen kesin Dosya Eki sürümüne veya Ekranın seçilen kesin Wireframe sürümüne aittir.** Kaynağın daha sonraki bir sürümü oluştuğunda bağ sessizce yeni sürüme taşınmaz. Özellik çok kullanıcılı yorum dizisi, mention, review rolü, Approval veya otomatik subtask davranışı oluşturmaz.

### Belge ve ek araması

- **Belge ve ek araması Evrensel Arama’nın içerik katmanıdır.** Desteklenen metin katmanına sahip eklerin içeriği dizine alınabilir; dizinleme özgün eki değiştirmez. Görseller başlık, etiket, özel alan ve ilişkili kayıtları üzerinden bulunabilir.

- **Belge ve ek yüzeyi klasör önizlemesi, çoklu seçim, belge/dosya ve desteklenen alt tür filtreleri ile ad, güncellenme tarihi ve tür sıralamasını sunar.** `Tüm Belgeler` yoğun listeyi varsayılan tutar ve aynı Belge kayıtları için isteğe bağlı Waterfall/Gallery görünümü sunar. Görsel görünüm çocuk Belge Card'larıyla aynı otomatik önizleme önceliğini kullanır; ayrı kapak, thumbnail, kayıt kümesi veya kart tasarımcısı oluşturmaz. Görünüm seçimi kişisel sunum üstverisidir ve kaynak Belgenin sırasını, kapsamını, alanlarını ya da ilişkilerini değiştirmez.

- **Waterfall/Gallery büyük sonuç kümelerinde kademeli yükleme ve sanallaştırma kullanır; görseli olmayan Belge başlık ve kısa metin fallback'iyle taranabilir kalır.** Çoklu işlemler seçilen ana kayıtları ve uygulanacak değişikliği açıkça gösterir; görünüm düzenleme eylemleri içeriğin ilişkilerini veya yayın durumunu örtük biçimde değiştirmez.


### Kişisel Wiki

- **Kişisel Wiki, herhangi bir projeye ait olmak zorunda olmayan kontrol listeleri, geliştirme kalıpları, yaklaşımlar, hata çözümleri, araştırmalar ve kalıcı öğrenimler için tam bir belge alanıdır.** Proje belgeleriyle aynı editörü, ana belge modelini, sürüm geçmişini, referans ve geri bağlantıları, belge hiyerarşisini, klasörleri, şablonları, arşivi, aramayı ve dışa aktarma davranışını kullanır; ikinci bir belge türü veya ayrı doğruluk kaynağı oluşturmaz.

- **Wiki kişisel erişim kabuğunda birinci sınıf hedef olarak bulunur ve proje seçmeden belge oluşturmayı destekler.** Çalışma alanı genelindeki `Tüm Belgeler` dizini ve Evrensel Arama kapsam rozetleriyle proje belgeleri ile Wiki belgelerini birlikte bulabilir; geçici görünüm bunları aynı yere aitmiş gibi göstermez.

- **Proje bağlamından kalıcı bilgiye dönüşen belge açık `Taşı` eylemiyle Wiki’ye alınabilir ve kaynak ilişkileri korunabilir; aynı içeriğin iki bağımsız bağlamda sürmesi gerekiyorsa kullanıcı `Kopyala` eylemini seçer.** Wiki içeriği kendiliğinden proje şablonuna, işe veya başka yapılandırılmış kayda dönüşmez.

- **İlk ürün Wiki’si kişiseldir.** Wiki düzeyinde ekip daveti, koleksiyon izni, sayfa rolü, çok kullanıcılı yorum, ortak düzenleme veya ayrı yönetişim modeli bulunmaz; gelecekteki ekip genişlemesine uygun sahiplik ve denetim üstverisi temel veri modelinde korunur.
