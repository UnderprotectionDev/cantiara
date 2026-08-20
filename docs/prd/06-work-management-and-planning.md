# İş Yönetimi ve Planlama

Bu belge İş türleri ve yaşam döngüsünün, planlama görünümlerinin, tarihler ve hatırlatmaların, bağımlılıkların, dönemlerin ve uygulama içi otomasyonların tek normatif sahibidir. Ortak kayıt yaşam döngüsü [Domain Modeli ve Yaşam Döngüsünde](02-domain-model-and-lifecycle.md) yaşar.

## İş yönetimi ve planlama

### İş öğeleri

- **Özellik, bug, görev, araştırma ve iyileştirme aynı temel iş öğesinin farklı türleridir.**

- **Her İş iç teknik kimliğine ek olarak Proje kısa kodu ve Proje başına 1'den başlayan, sürekli artan sıra numarasından oluşan, kullanıcıya dönük değişmeyen birincil anahtar taşır; örneğin `PROJE-123`.** Sayaç eşzamanlı oluşturmada tekil anahtar üretir; silinen, birleştirilen veya başarısız işlem nedeniyle atlanan numara yeniden kullanılmaz ve numara boşlukları hata sayılmaz. Başlık veya Proje adı değişse de anahtar değişmez ve İş başka Projeye taşınmaz. `Başka Projede yeniden oluştur` yeni kimlik ve yeni anahtar üretir; eski anahtarı yönlendirmez. Kopya birleştirmede sona eren İşin anahtarı aynı kimliğin alias'ı değil, içeriksiz emekli kimlik yönlendirmesinin parçasıdır. Güncel anahtar ve varsa eski ürün sürümlerinden korunması gereken tarihsel anahtarlar içe/dışa aktarma kimlik manifestinde yeniden kullanılmaz biçimde tutulur.

- **Proje bağlamında yeni İş oluştururken yalnız başlık kullanıcıdan zorunlu olarak istenir.** Proje açık bağlamdan, başlangıç durumu `Not Started` olarak Proje varsayılanından doldurulur. Tür, öncelik ölçütü değerleri, isteğe bağlı planlanan başlangıç tarihi, hedef tarihi, yeniden görünme tarihi, hafif efor tahmini, özel alanlar ve ilişkiler sonradan eklenebilir; ilk oluşturmayı engellemez.

- **Bug türündeki İş, isteğe bağlı ve çoklu seçimli `Gözlendiği sürümler` alanı taşıyabilir.** Alan yalnız aynı Projenin Proje Sürümü kayıtlarını kullanır ve hatanın görüldüğü ya da yeniden üretildiği ürün sürümlerini kanıt bağlamı olarak gösterir. `Hedef Proje Sürümü` düzeltmenin planlandığı yayın kapsamını anlatır; gözlenen sürüm seçmek Bug'ı o Proje Sürümünün hedef kapsamına almaz, plan taahhüdü oluşturmaz veya İş durumunu değiştirmez.

- **Başlık veya desteklenen ilk metin yeterli bağlam sağladığında `Yeni iş` akışı aynı projedeki olası benzer işleri kompakt ve atlanabilir öneriler olarak gösterebilir.** Her öneri başlık, metin, URL veya ortak bağlam gibi görünür bir benzerlik dayanağı taşır. Kullanıcı öneriyi yok sayıp işi hemen kaydedebilir ya da mevcut işi açabilir; öneri oluşturmayı engellemez, kayıtları otomatik birleştirmez veya ilişkilendirmez ve hedef projeyi değiştirmez.

- **Proje bağlamı bilinmeden çalışma alanı genelinden yapılan hızlı kayıt kalıcı işe dönüşmez, çalışma alanı Yakalama Gelen Kutusu’na gider.**

- **Efor tahmini isteğe bağlıdır ve zaman takibi oluşturmaz.**

- **Araştırma türündeki bir iş isteğe bağlı `Problem/Fırsat özeti` taşıyabilir.** Bu özet çözüm veya Özellik taahhüdü değildir; ilişkili Geri Bildirim ve Kaynak kanıtlarını aynı problem bağlamında gruplayabilir. Sonradan oluşturulan bir Özellik, köken ilişkisiyle bu Araştırma işine bağlanabilir. İlk ürün ayrı bir `Fırsat` kayıt türü, durum akışı veya zorunlu discovery aşaması oluşturmaz.

### İş Bağlam Kartı

- **İş detayı aşamalı bağlam sunar.** Başlık, tür, durum ve günlük planlama alanları başlangıçta görünür kalır; problem/fırsat, beklenen sonuç, kanıt, karar, risk, varsayım ve öğrenim gibi bölümler belirgin `Bağlam ekle` eylemleriyle gerektiğinde açılır. İş türü yalnız uygun başlangıç düzenini ve önerilen bölümleri değiştirir; hiçbir bölüm oluşturma veya durum geçişi kapısı değildir.

- **Hazır İş Bağlam Kartı düzeni Başlangıç yapılandırmasına göre değil yalnız İş türüne göre belirlenir ve bütün Projelerde aynı başlangıç anlamını taşır.** Bölümler isteğe bağlıdır, bağlam geldikçe aşamalı açılır ve aşağıdaki kapalı hazır düzenleri kullanır:

| İş türü | Hazır İş Bağlam Kartı bölümleri |
| --- | --- |
| `Feature` | `Problem/Opportunity`, `Expected Outcome`, `Evidence & Decisions`, `Risks & Open Questions`, `Included Work`, `GitHub & Tests`, `Target Release` |
| `Bug` | `Observed/Expected Behavior`, `Affected Releases`, `Evidence`, `GitHub & Tests` |
| `Task` | `Description`, `Dependencies`, `GitHub & Tests`, `Target Release` |
| `Research` | `Research Question`, `Sources & Evidence`, `Decisions`, `Related Work` |
| `Improvement` | `Current Situation`, `Expected Outcome`, `Evidence`, `GitHub & Tests` |

- **İş detayı ayrıca mevcut kayıtlı ilişkilerden türetilen kompakt ve tıklanabilir bir `Neden bu işi yapıyorum?` bağlam zinciri gösterir.** Zincir, varsa Proje Hedefi, köken Araştırma kaydı, birincil Özellik kapsamı, Birincil spec, ilgili Karar ve desteklenen GitHub kaydı gibi en yakın anlamlı kaynakları görünür adlarıyla birbirine bağlar. Yeni kayıt, ilişki, özet metni veya ikinci doğruluk kaynağı üretmez; çözülemeyen veya erişilemeyen adım içerik sızdırmadan açıklanır.

- **İş ve Özellik detayı, aynı ana kaydın `İş Bağlam Kartı` yüzeyinde neden ve hazırlık bağlamını birlikte gösterir.** Kart; İşin kendi problem/fırsat ve beklenen sonuç alanlarını, Proje Hedefini, köken Araştırma kaydını, birincil Özellik kapsamını, Birincil spec'i ve İşten desteklenen doğrudan ilişkilerle erişilen Karar, Risk, Varsayım, Açık Soru, Geri Bildirim, Kaynak, Kullanıcı Araştırması Oturumu, Deney/Doğrulama, Test Açığı, Oturum Testi, GitHub PR/check ve hedef Proje Sürümü kayıtlarını kaynaklarından gösterebilir. Her öğe durumunu ve kesin kaynağını açar; kart yeni `Bağlam` kaydı, içerik kopyası veya ilişki üretmez.

- **Kullanıcı Yapılandırma modunda Proje ve İş türü başına İş Bağlam Kartı düzenini tasarlayabilir.** Ürünün kullanılabilir hazır düzeninden başlayarak desteklenen modülleri gösterebilir, gizleyebilir ve sıralayabilir; desteklenen kayıt türü, doğrudan ilişki veya Kanıt Rolü ve durum koşullarıyla adlandırılmış özel bölümler kurabilir. Bir bölüm yalnız açık İşten bu desteklenen ilişkilerle erişilen kayıtları getirir; Proje ya da Çalışma Alanında bağımsız sorgu, serbest operatör, formül, grafik, metrik veya keyfî veri kaynağı çalıştırmaz.

- **İş Bağlam Kartı düzeni değişikliği bütün eşleşen mevcut ve yeni İşlerde aynı canlı sunum yapılandırmasını kullanır.** Uygulanmadan önce etkilenecek İş türleri ve bölüm farkı gösterilir; onaylanan değişiklik sürümlü yapılandırma geçmişinde korunur ve güvenli geri alma yalnız düzeni önceki sürüme döndürür. İş alanları, ilişkileri, durumları ve kanıtları değişmez; kayıt başına ayrı kart şeması veya eski düzen kopyası oluşmaz.

- **Yapılandırılmış görünür bir bölümde bağlam bulunmadığında kart gerçek eksikliği tarafsız boş durumla açıklar ve desteklenen kaynak ekleme ya da ilişkilendirme eylemini sunar.** Eksiklik İş durumunu, önceliğini, kapanışını veya Proje Sürümü kapsamını değiştirmez; bağlam tamlığı, sağlık/readiness skoru, uyarı bildirimi veya süreç kapısı üretmez. Kullanıcının düzende gizlediği bölüm eksik kabul edilmez.

- **İş Bağlam Kartı yalnız özel iç çalışma düzenidir.** Kartta görünen kayıt, alan, bölüm veya sıra bağlantıyla sınırlı paylaşım ya da Build in Public kapsamı, izni veya dış snapshot şablonu oluşturmaz; dış görünürlük ayrıca [ortak kapalı dünya önizlemesiyle](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) seçilir ve onaylanır.

- **İş ve Özellik detayındaki `Bağlamı Markdown kopyala` eylemi ile aynı Komut Paleti komutu; iş anahtarı, başlık, tür, durum, açıklama, kontrol listesi, yukarıdaki bağlam zinciri, Birincil spec, ilgili Karar/Risk/Açık Soru, aktif blokaj ve izinli GitHub/dış kayıt bağlantılarını okunabilir Markdown olarak panoya aktarır.** Çıktı üretim zamanını, okunabilir kaynak kimliklerini/bağlantılarını ve `Ana kaynak uygulamadadır` notunu taşır. Eylem yeni kayıt veya kalıcı snapshot oluşturmaz; secret, erişilemeyen alan veya özel ek içeriğini kapsama katmaz ve kullanıcının mevcut erişimini genişletmez.

- **İş detayı, kullanıcının öncelik kararını destekleyen `Öncelik dayanakları` özetini sunar.** Özet mevcut hedef, tarih, blokaj, risk, kilometre taşı, Geri Bildirim, Karar, Kaynak, efor ve varsa aşağıda tanımlanan öncelik ölçütlerini özgün kayıtlarına bağlı ve taranabilir biçimde bir araya getirir. Yapılandırılabilir sayısal skor, otomatik sıralama hükmü veya nesnel öncelik iddiası üretmez; işin önceliğini kullanıcı belirler.

- **Özet ayrıca Kaynak, Araştırma, Karar, Risk ve Açık Soru gibi desteklenen bağlam türleri için küçük ve tıklanabilir kayıt sayılarını gösterebilir.** Geri Bildirim kanıtı ise birbirine karıştırılmadan `Geri Bildirim kaydı`, `Benzersiz Contact` ve Company ilişkisi kullanılıyorsa `Benzersiz Company` sayılarını gösterir. Aynı Contact'ın beş ayrı Geri Bildirimi beş kayıt ve bir benzersiz Contact olarak sayılır. Her sayıya tıklamak onu oluşturan kesin filtrelenmiş kayıt kümesini açar. Erişilebilir ve kalıcı olarak silinmemiş arşiv kayıtları sayıya dâhildir ve açılan görünümde arşiv durumu görünür; çöp kutusundaki veya kalıcı silinmiş kayıtlar dâhil değildir. Bu sayılar talep, oy, popülerlik veya otomatik öncelik girdisi değildir.

- **İş veya Özellik ilerlemesi gösterilen yüzeylerde ilişkili açık Risk ve Açık Soru kayıtları durum, kapsam ve kontrol listesi ilerlemesinin yanında taranabilir biçimde sunulur.** Bu görünürlük tamamlanma ile belirsizliği aynılaştırmaz; yeni bir belirsizlik alanı oluşturmaz ve işin durumunu ya da Özelliğin türetilen ilerlemesini değiştirmez.

- **İlk ürünün ortak İş akışı durumları `Not Started`, `In Progress`, `Blocked` ve terminal `Closed` değerleridir.** Terminal olmayan durumlar arasında serbest geçiş vardır; kullanıcı tanımlı geçiş grafiği, durum bazlı izin veya doğrulama kapısı yoktur. Kullanıcıya dönük adlar Yapılandırma modunda değiştirilebilir fakat bu dört korunan semantik başka anlam için kullanılamaz.

- **İş akışı durumu işin akıştaki yerini; ayrı kapanış sonucu ise işin nasıl kapandığını gösterir.** `Closed` durumuna her geçiş `Tamamlandı` (`UI: Completed`) veya `Vazgeçildi` (`UI: Abandoned`) sonucunu seçtirir ve isteğe bağlı gerekçe taşıyabilir. Kapatma açık kullanıcı eylemiyle veya açıkça etkinleştirilmiş hazır PR-merge kuralıyla; yeniden açma yalnız açık kullanıcı eylemiyle gerçekleşir. Önceki sonuç, gerekçe ve durum değişiklikleri geçmişte korunur. Vazgeçilen işler tamamlanmış işlerden ayrı izlenir ve otomatik arşivlenmez.

- **Terminal iş akışı durumundaki her İş bir kapanış sonucu taşır.** Kullanıcı bir İşi Kanban hareketi veya başka bir durum eylemiyle `Closed` durumuna aldığında `Completed` ya da `Abandoned` sonucunu seçen açık kapatma adımı gösterilir; isteğe bağlı gerekçe aynı adımda eklenebilir. Kapatma iptal edilirse durum değişikliği uygulanmaz. Kapanmış bir İşi yeniden açmak açık onay ve `Not Started`, `In Progress` veya `Blocked` hedeflerinden birini seçmeyi gerektirir; etkin kapanış sonucu kaldırılır, önceki sonuç ve gerekçe geçmişte korunur.

- **Kullanıcının başlattığı kapatma adımında tamamlanmamış kontrol listesi maddesi veya aktif blokaj ilişkisi bulunuyorsa aynı yüzey engelleyici olmayan bir `Kapanış kontrolü` gösterir.** Kontrol kalan checklist maddelerini ve işin hâlâ engellendiği ya da başka işleri engellediği kesin aktif ilişkileri kaynaklarıyla listeler; `İşe dön` ve `Yine de kapat` seçenekleri sunar. Kullanıcı yine de kapatırken isteğe bağlı gerekçe ekleyebilir. Kontrol hiçbir blokajı otomatik çözmez, kapatmayı zorunlu olarak engellemez ve genel zorunlu alan, approval veya kullanıcı tanımlı geçiş kapısı sistemine genişlemez.

- **Kullanıcının başlattığı kapatma adımında işte not veya sonradan edinilen öğrenim bulunuyorsa aynı yüzeyde koşullu ve atlanabilir bir `Kalıcı bağlamı koru` bölümü gösterilir.** Kullanıcı seçtiği içeriği önizleyerek yeni Karar Kaydına dönüştürebilir veya yeni bir Kişisel Wiki belgesine kopyalayabilir. Oluşturulan Karar kaynak işe bağlanır; Wiki belgesi yeni kimlikli bağımsız kayıt olur ve kaynak proje ile iş kökenini korur. Sistem notun önemli olduğuna kendiliğinden karar vermez, metin üretmez, kullanıcı onayı olmadan kayıt oluşturmaz ve bu kontrol işin kapatılmasını engellemez.

- **Özellik türündeki bir iş isteğe bağlı olarak bir seviye altında başka tam iş öğelerini kapsayabilir.** Her iş aynı anda en fazla bir birincil Özelliğin ilerleme kapsamına girebilir. Başka Özelliklere katkı gerekçeli standart ilişkilerle gösterilebilir; bu ilişkiler işi ikinci bir Özellik kapsamına sokmaz veya onun ilerlemesine saymaz.

- **Kapsanan işler kendi tür, durum, planlama üyeliği, ilişkileri ve geçmişiyle bağımsız ana kayıtlar olarak kalır.** Özellik, kapsamındaki işlerden türetilen ilerlemeyi gösterebilir; bu özet özelliğin durumunu otomatik değiştirmez. İç içe kapsam hiyerarşisi veya subtask davranışı oluşmaz.

- **Kullanıcı yalnız Özellik türündeki işte isteğe bağlı `Yolunda`, `Riskli` veya `Yolunda değil` sağlık güncellemesi ile kısa gerekçe kaydedebilir.** Her güncelleme yazar ve zaman damgasıyla kronolojik geçmişte kalır; ilgili Risk, Karar, Açık Soru veya diğer ana kayıtlara bağlanabilir. Özellik sağlığı zorunlu cadence, otomatik tahmin, bildirim, ilerleme hesabı veya iş akışı durumu değişikliği üretmez ve Proje düzeyindeki Manuel Proje Güncellemesinin yerine geçmez.

- **Özellik türündeki bir iş, aynı projedeki belgelerden en fazla birini isteğe bağlı `Birincil spec` olarak ilişkilendirebilir.** Özellik detayındaki `Spesifikasyon` yüzeyi yeni içerik kopyası oluşturmak yerine Belgeler alanındaki aynı özgün belgeyi gösterir ve ortak düzenleme/sürüm geçmişini kullanır. Birincil spec değiştirildiğinde önceki belge silinmez; standart ilişkili belge olarak kalır ve ilişki değişikliği geçmişte görünür.

<a id="bitiris-efektleri"></a>
### Bitiriş efektleri

- **Bitiriş efekti ilk üründe varsayılan olarak kapalı, Hesap düzeyinde açıkça etkinleştirilen deneysel bir kişisel geri bildirimdir.** Kullanıcı ürünün sağladığı sakin varsayılan ile üç güçlü özgün tema arşetipi arasından tek tema ve o tema için tasarım, kontrast ve hareket güvenliği doğrulanmış tam olarak dört hazır paletten birini seçer; seçim değiştirilene kadar bütün Projelerde aynıdır. Rastgele seçim, Proje override'ı, olay düzeyinde seçim veya parçacık, hız, yoğunluk, süre ya da renk dâhil tema parametrelerini serbestçe değiştiren bir editör yoktur.

- **Tema ve palet durağan örneklerle seçilir; hareket yalnız kullanıcının açık `Önizle` eylemiyle başlar.** Önizleme İş durumunu, başarı bildirimini veya 30 saniyelik dekoratif bekleme süresini etkilemez. Tema kataloğu kapalıdır ve dört girdi taşır: sakin varsayılan `Calm`, soyut bağ/örgü yönündeki `Weave`, ışık/ark yönündeki `Arc` ve kozmik enerji yönündeki `Nova`. Her tema tam olarak dört palet taşır; palet adları görsel prototiplemede belirlenip bu bölüme eklenir ve katalogda adı bulunmayan tema veya palet değeri kullanılamaz. Hareketli önizlemenin erişilebilirlik ve fallback davranışı [Ürün Kalitesinde](15-product-quality.md#erisilebilirlik) yaşar.

- **Efekte uygun tek tetikleyici, kullanıcının görünür istemcide açıkça başlattığı İş kapatma eyleminin sunucu tarafından kalıcı `Tamamlandı` kapanış sonucu olarak kabul edilmesidir.** Efekt kapatma adımı, Kapanış kontrolü veya iyimser istemci değişikliği sırasında başlamaz; reddedilen, çatışan, zaman aşımına uğrayan veya geri alınan yazmada gösterilmez. Aynı idempotent isteğin yeniden denenmesi, sayfa yenileme, geçmişe dönüş, ikinci sekme/cihaz veya arka plan senkronizasyonu efekti yeniden oynatmaz.

- **`Vazgeçildi`, kontrol listesi maddelerinin tamamlanması, PR merge edilmesi, hazır PR-merge kuralının İşi otomatik `Tamamlandı` yapması, Dış yürütme uzlaştırması, `Odağı kapat`, Odak Döneminin kapanması, Kilometre Taşına ulaşma, Proje veya proje aşaması tamamlama, Proje Sürümü yayımlama ve başka kayıt türlerinin terminal olayları Bitiriş efekti tetiklemez.** Sistem ilk dilimde genel amaçlı `başarı olayı → efekt` motoru kurmaz; başka başarı sınıfları ancak kendi anlamı ve kabul sınırıyla ayrı ürün kararında açılabilir.

- **Her kullanıcı başlatmalı İş başarısı hareketten bağımsız temel başarı geri bildirimini korur.** İşin kalıcı durumu ve geçmişine ek `İş tamamlandı` sonuç bildirimi görünür ve 10 saniye sonra kendiliğinden kapanır. Bildirimdeki `Yeniden aç` eylemi normal açık yeniden açma onayını başlatır; kapanış sonucunu sessizce geri almaz. Bitiriş efektinin kapalı veya bastırılmış olması bu geri bildirimi kaldırmaz ve Bildirim Merkezi'nde yeni dikkat kaydı üretmez; görsel ve ekran okuyucu sunumu [Ürün Kalitesinde](15-product-quality.md#erisilebilirlik) tanımlanır.

- **Çalışan efekt için ayrı durdurma kontrolü yoktur; kullanıcı özelliği Hesap ayarından tamamen kapatabilir.** Efektin süre, yerleşim, etkileşim, performans ve platform sınırları [Ürün Kalitesinde](15-product-quality.md#etkilesim-tutarliligi) yaşar.

- **Aynı görünür istemcide bir efekt oynarken gelen sonraki uygun başarılar yalnız temel geri bildirimi alır; tam efekt başladıktan sonra 30 saniyelik dekoratif bekleme süresinde yeni efekt oynatılmaz.** Bekleme istemciye özgü ve geçicidir; sunucuda efekt görüntüleme, teslim, bekleme veya İş başına görüldü kaydı tutulmaz. Yeniden açılıp tekrar tamamlanan İş de ancak aynı tetik ve bekleme sınırlarını karşılıyorsa yeni efekt alabilir.

- **İlk tema kataloğu yalnız ürünün oluşturduğu özgün ve sessiz görsel varlıklardan oluşur.** Lisanslı karakter/evren içeriği ile kullanıcı tarafından yüklenen görsel, animasyon veya ses ürünün kalıcı sınırı olarak desteklenmez; katalog genişlemesi bu iki yolu açamaz. Tema adı, şekli, renk düzeni, ikonografisi ve hareketi üçüncü taraf karakter veya evreni taklit etmez; bu sınır [ADR-0017](../adr/0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md) ile korunur.

- **Bitiriş efektinin algılanan tatmini release kabul koşulu değil, nitel araştırma sinyalidir.** Gönüllü dogfooding değerlendirmesi kullanılan kesin build'i, katılımcı bağlamını, soruları, gözlemleri ve takip kararını kaynak bağlantılı bir Karar kaydında korur. Olumsuz, yorucu veya dikkat dağıtıcı sonuç release'i kendiliğinden engellemez ve özelliği otomatik kaldırmaz; erişilebilirlik, performans veya yanlış başarı geri bildirimi ihlali ayrı bağlayıcı kalite koşullarına göre release'i engeller.

### Dış yürütme devirleri

- **Kullanıcı bir İşte kodlama veya başka test-dışı bir çalışmayı AI ajanına ya da harici araca götürmek için bir `Dış yürütme devri` başlatabilir.** Her devir; amacı, beklenen çıktıyı veya kabul beklentisini, yürütücünün görünen adını, kısıtları, seçilen kesin İş/Belge/Karar/Risk/Açık Soru/Kaynak sürümlerini ve izinli GitHub bağlamını İşe ait tarihsel bir sahipli bileşende tutar. Aynı İş birden fazla devri kronolojik olarak taşıyabilir; yeni devir öncekinin gidiş veya dönüş bağlamını ezmez. Gidiş paketi oluşturma, dışarı verme, dönüş kaydetme, uzlaştırma ve iptal olayları aktör ve zamanıyla İşin normal değişiklik geçmişinde kalır. Dış insana inceleme veya görev verme bu bileşenin kapsamında değildir.

- **Dış yürütme devrinin gidiş paketi yalnız kullanıcının seçtiği kesin kaynak ve sürüm manifestinden okunabilir Markdown olarak üretilir.** Paket üretim zamanını, İş anahtarını, devir kimliğini ve `Ana kaynak uygulamadadır` notunu taşır; secret, erişilemeyen alan veya seçilmeyen ilişkili kaydı kapsama katmaz. Kaynak daha sonra değişirse gönderilmiş paket sessizce güncellenmez; kullanıcı yeni paket sürümü oluşturabilir veya yeni devir başlatabilir.

- **Kullanıcı dış çalışma döndüğünde yürütücünün özetini, değişen varsayımları, üretilen kanıt veya izinli dış bağlantıları ve kapanmamış soruları aynı devre kaydedip `Uzlaştır` eylemini başlatır.** Uzlaştırma önizlemesi ana kayıtlara kurulacak kesin ilişkileri ve açıkça oluşturulacak takip İşlerini gösterir; devir metni kendiliğinden Karar, Risk, İş, ilişki veya kanıt üretmez. Kullanıcının onayı sonucu ve seçilen bağları tarihsel uzlaştırma kararıyla kaydeder.

- **Dış yürütme devri `Açık`, `Sonuç döndü`, `Uzlaştırıldı` veya `İptal edildi` durumlarından birini taşır; yalnız son ikisi terminaldir.** `Uzlaştırıldı` ancak kullanıcı dönüşü inceleyip uzlaştırdığında oluşur. Kullanıcı açık iptal eyleminde gerekçeyi kaydederek devri `İptal edildi` durumuna getirir; geçmiş silinmez ve aynı çalışma yeniden başlatılırsa eski devir açılmak yerine yeni devir oluşturulur. Commit veya PR bağlanması, dış sonuç gelmesi ya da İşin durumunun değişmesi devri otomatik kapatmaz.

- **`Sonuç döndü` durumundaki uzlaştırılmamış devir tek kaynak bağlantılı `Eylem Gerekiyor` dikkat sinyali üretir.** Henüz sonuç dönmeyen açık devir yalnız kullanıcı açık hedef tarih veya `Yeniden bak` hatırlatması kurduysa zaman tabanlı sinyal üretir. `Uzlaştırıldı` veya `İptal edildi` durumundaki devir sonuç, uzlaştırma ya da zaman sinyali üretmez; daha önceki devir sinyalleri kapanır.

- **Ürün Dış yürütme devrinden harici ajan, IDE, terminal, repository, CI/CD veya başka çalışma ortamı başlatmaz, sorgulamaz, izlemez ya da iptal etmez.** Planlı veya formel test yürütmesi ve yapılandırılmış test sonucu bu bileşende ikinci test geçmişi oluşturmaz; [Test Handoff'u ve Test Oturumu](10-testing-and-validation.md#test-handoffu) sözleşmesinde kalır. Kodlama yürütücüsünün serbest metinle bildirdiği test özeti yalnız devir dönüşüdür; resmî test geçmişine alınacaksa desteklenen rapor yoluyla ayrı Test Oturumu olarak kaydedilir.

### `Şimdi değil` karar izi

- **Kullanıcı herhangi bir açık İş veya Özellik için isteğe bağlı `Şimdi değil` kararı kaydedebilir.** Etkin karar; kısa erteleme gerekçesini, isteğe bağlı yeniden değerlendirme koşulunu ve Karar, Risk, Geri Bildirim, Kaynak veya Belge dayanaklarıyla ilişkilerini taşır. Ayrı bir durum, kapanış sonucu, Backlog, planlama üyeliği, öncelik değeri veya Karar Kaydı oluşturmaz.

- **`Şimdi değil` eylemi uygulanmadan önce kaydedilecek gerekçe, koşul ve dayanaklar gösterilir.** Karar İşin durumunu, önceliğini, Backlog sırasını, roadmap ufkunu, tarihlerini veya planlama görünümlerindeki üyeliğini kendiliğinden değiştirmez. Etkin karar İş detayında, Backlog, Liste, Roadmap ve önceliklendirme yüzeylerinde gerekçesi açılabilen kompakt bir işaret olarak gösterilir; bu işaret yeni `Parked` durumu veya gizli filtre üyeliği değildir.

- **Yeniden değerlendirme koşulu kullanıcının yazdığı karar bağlamıdır.** Sistem `üç kullanıcı aynı ihtiyacı bildirirse` gibi serbest metinli koşulları arka planda izlemez, sağlandığına karar vermez ve İşi otomatik yeniden etkinleştirmez. Kullanıcı tarihli dönüş isterse aynı açık eylem içinde mevcut kaynak bağlantılı `Yeniden bak` hatırlatmasını ayrıca kurabilir; oluşacak hatırlatma ve zamanı onaydan önce gösterilir.

- **Kullanıcı etkin kararı `Yeniden değerlendiriliyor` eylemiyle kapatabilir veya yeni bir `Şimdi değil` kararıyla değiştirebilir.** Önceki gerekçe, koşul, dayanaklar, yazar ve zaman normal kayıt geçmişinde korunur. Kararı kapatmak ya da değiştirmek daha önce ayrıca kurulmuş `Yeniden bak` hatırlatmasını sessizce silmez; ilgili hatırlatmayı koruma veya kaldırma etkisi kullanıcıya ayrıca gösterilir. İşi kapatmak, arşivlemek veya durumunu değiştirmek de `Şimdi değil` kararını kendiliğinden kapatmaz.

### Öncelik ölçütleri

- **İşin önceliği yalnız proje bazlı öncelik ölçütü değerleriyle ifade edilir.** İş kaydında bunlardan ayrı, tek başına duran skaler bir `öncelik` alanı bulunmaz; ürün ölçüt değerlerinden tek bir öncelik değeri, sırası veya hükmü türetmez.

- **Kullanıcı bir proje içinde işler için isteğe bağlı öncelik ölçütleri tanımlayabilir.** Her ölçüt bir ad, kısa açıklama ve `Çok düşük`, `Düşük`, `Orta`, `Yüksek`, `Çok yüksek` biçimindeki beş sabit sıralı kademe için proje bazında düzenlenebilir açıklamalar taşır. Boş veya henüz değerlendirilmemiş durum bu beş kademeden ayrıdır.

- **Ölçüt tanımları yalnız kendi projesinde yaşar; aynı adlı ölçütler projeler arasında ortak kimlik veya çalışma alanı şeması oluşturmaz.** Değerler İş detayında, Liste, Backlog, filtre ve öncelik görünümünde ayrı ayrı gösterilir. Sistem kademeleri toplamaz, ağırlıklandırmaz, formüle veya tek skora dönüştürmez, işleri kendiliğinden sıralamaz ve nihai öncelik hükmü üretmez.

- **Görüşlü başlangıç yapılandırmaları, kullanımı varsayılan olarak kapalı `Kanıt gücü` ölçütünü hazır tanım olarak sunar.** Kullanıcı ölçütü açıkça etkinleştirir ve kademesini yalnız kendisi seçer; ilişkili Geri Bildirim, Contact/Company sayısı, Kaynak veya başka sistem sinyali değeri kendiliğinden hesaplamaz ya da değiştirmez.

### Öncelik Haritası

- **Kullanıcı aynı projede tanımlanmış iki sıralı öncelik ölçütünü yatay ve dikey eksen olarak seçip işleri iki boyutlu `Öncelik Haritası`nda karşılaştırabilir.** Eksen değeri bulunmayan işler ayrı `Değerlendirilmemiş` bölümünde kalır. İsteğe bağlı kanıt sinyali, noktanın yanında Geri Bildirim kayıt ve benzersiz Contact/Company sayılarını yalnız bağlam olarak gösterebilir.

- **Harita ölçütleri birleştirmez, skor veya otomatik sıralama üretmez, çeyrekleri karar etiketi olarak dayatmaz ve işin kullanıcı tarafından belirlenen önceliğini değiştirmez.** Haritadaki değer düzenlemesi açık kullanıcı eylemidir ve aynı ölçüt alanını günceller.

### Önceliklendirme oturumları

- **Kullanıcı yalnız açık `Önceliklendirme oturumu oluştur` eylemiyle proje kapsamlı, adlandırılmış bir karar görünümü oluşturabilir.** Oturum seçilen İş kapsamını ve kendi görünüm-yerel manuel sırasını saklar; bu sıra ana Backlog sırasını, İşin öncelik ölçütü değerlerini, roadmap ufkunu, durumunu veya başka kayıtlı görünümün sırasını değiştirmez. Normal Akıllı Koleksiyon, Liste, Kanban ve Roadmap görünümleri bağımsız manuel rank taşımaz; bu davranış yalnız açıkça Önceliklendirme oturumu olarak oluşturulan görünümün istisnasıdır.

- **Oturumdaki kartlar başlık, öncelik ölçütü değerleri, hedef tarihi, Risk ve kanıt sayılarını canlı İş kayıtlarından gösterir.** Oturumda kartı yeniden sıralamak yalnız oturum sırasını günceller; kaydı kapsama eklemek veya kapsamdan çıkarmak durum, Backlog üyeliği, ölçüt değeri ya da planlama taahhüdü oluşturmaz. Kullanıcı oturum sırasını ana Backlog sırasıyla yan yana karşılaştırabilir, ancak bir sırayı diğerine topluca uygulayan örtük eşitleme yoktur.

- **Kullanıcı oturumu açıkça kapattığında kapsam ve son sıra tarihli, salt okunur karar bağlamı olarak korunur; yeniden düzenlemek yeni oturum veya açık yeniden açma eylemi gerektirir.** Oturumu arşivlemek ya da silmek İş kayıtlarını ve onların Backlog sırasını etkilemez. Oturum skoru, otomatik kazanan, karar kaydı, durum değişikliği veya ikinci bir İş önceliği doğruluk kaynağı üretmez.

### İşin değişmeyen Proje kapsamı

- **Bir İş oluşturulurken seçilen Proje kapsamı İşin yaşamı boyunca değişmez.** İş başka Projeye taşınamaz; aynı kimliğin yeni anahtar alarak yeniden kapsamlandırılması ve taşıma kaynaklı anahtar alias'ı yoktur.

- **Yanlış Projede oluşturulan İş için kullanıcı `Başka Projede yeniden oluştur` eylemini kullanabilir.** Önizleme hedef Projeyi; taşınabilir seçili başlık, açıklama, kontrol listesi ve izinli kapsam-bağımsız alanları; ayrıca kaynak İşin bütün ilişkilerini hedef kapsamlarıyla gösterir. Yalnız türü kapsamlar arası kullanıma açık olan, hedefi bağımsız yaşamaya devam eden ve kullanıcının tek tek seçtiği ilişkiler kopyalanabilir. GitHub tamamlanma bağı, otomasyon, planlama üyeliği, yayın, ebeveynlik ve kopya-birleştirme durumu gibi sahiplik veya yaşam döngüsü bağları taşınabilir değildir. Onay yeni kimlik ve yeni anahtarla bağımsız bir İş oluşturur; görünür köken bağı kaynak İşi gösterir. Kaynak İş yerinde ve değişmeden kalır. Kaynak geçmişi ve taşınabilir olmayan bağlam kopyalanmaz; eski bağlantı ve anahtar yeni İşe yönlenmez.

### İş öğesi şablonları ve tek seferlik kopyalama

- **Hızlı Yakalama’daki hazır mini şablonlara ek olarak kullanıcı proje bazında tekrar kullanılabilir iş öğesi şablonları oluşturabilir.** Şablon tür, açıklama iskeleti, seçili alan varsayılanları, hafif kontrol listesi ve isteğe bağlı göreli planlanan başlangıç/hedef tarihi kuralları taşıyabilir. Göreli tarihler şablondan iş oluşturulan güne göre hesaplanır ve çözümlenen gerçek tarihler oluşturma uygulanmadan önce gösterilir.

- **Şablondan üretilen iş bağımsız ana kayıttır; sonraki şablon değişiklikleri mevcut işleri güncellemez.** Şablon çalışma geçmişi, ilişkiler, etkin kapanış sonucu, mevcut durum veya mutlak tarihleri taşımaz.

- **Kullanıcı mevcut bir işi şablona dönüştürmeden aynı proje içinde tek seferlik kopyalayabilir.** Oluşturmadan önce kopyalanacak alanlar gösterilir. Yeni iş yeni anahtar ve proje varsayılan başlangıç durumuyla açılır; başlık, tür, açıklama, tarih türünde olmayan seçili özel alanlar ve hafif kontrol listesi kopyalanabilir. Geçmiş, ilişkiler, kapanış sonucu, mevcut durum, planlama üyelikleri ve tarih türündeki özel alanların değerleri dahil hiçbir mutlak tarih değeri kopyalanmaz.

### Kalıcı iş birleştirme

- **Kullanıcı gerçek kopya olduğunu doğruladığı iki işi `Kopya olarak birleştir` eylemiyle birleştirebilir.** Önce kalacak ana kayıt seçilir; ardından alan, ilişki, kanıt, ek, GitHub bağlantısı ve planlama üyeliği çatışmaları ile taşınacak bağlam önizlenir. Sistem başlık benzerliğinden veya aynı URL'den kendiliğinden birleştirme yapmaz. Anlamsal olarak bağlantılı fakat ayrı işler için standart `İlgili` ilişkisi kullanılmaya devam eder.

- **Birleştirme İşe özgü başlık, açıklama, durum, kapanış sonucu, planlama üyeliği, GitHub rolü, kanıt ve ek çatışmalarının kullanıcı tarafından çözülmesini gerektirir.** Atomik konsolidasyon, emekli kimlik yönlendirmesi, geçmiş atfı ve geri alma [ortak birleştirme sözleşmesini](02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma) izler.

### Hafif iş kontrol listeleri

- **İş öğesi, ayrı iş kaydı oluşturmaya değmeyen küçük adımlar için yalnız metin ve tamamlanma işareti taşıyan hafif kontrol listeleri içerebilir.** Maddeler bağımsız kimlik, iş durumu, kapanış sonucu, tarih, öncelik, ilişki veya planlama üyeliği kazanmaz. Bütün maddelerin tamamlanması ana işi otomatik kapatmaz.

- **Bir madde ayrı planlama gerektirecek kadar büyüdüğünde kullanıcı `Bağımsız işe dönüştür` eylemini başlatabilir.** Önizleme yeni işin başlığını, projesini ve başlangıç durumunu gösterir. Onaydan sonra aynı projede tam bir iş öğesi oluşturulur; eski madde yinelenen ilerleme üretmemek için yeni işe giden bağlantıyla değiştirilir ve kaynak işle köken ilişkisi korunur. Bu ilişki üst iş/alt iş hiyerarşisi oluşturmaz.

### İş öğesi arşivi

- **Kullanıcı bir iş öğesini iş akışı durumu ve kapanış sonucundan bağımsız olarak manuel biçimde arşivleyebilir.** Arşivleme kaydı silmez; içerik, anahtarlar, geçmiş ve ilişkiler korunur. Arşivlenen işler Backlog, Kanban, Liste, Birleşik Takvim ve Roadmap dahil normal planlama görünümlerinden kaldırılır, Evrensel Arama’da açık arşiv filtresiyle bulunabilir ve geri yüklenebilir.

- **Tamamlanan veya vazgeçilen işler otomatik arşivlenmez.** Arşiv, çöp kutusundan ve kapatma/yeniden açma eylemlerinden ayrı bir görünürlük durumudur.

### Planlama yüzeyi–durum ayrımı

- **Backlog, Akıllı Koleksiyon, Günlük Odak, Odak Dönemi, Favoriler, Takvim veya Roadmap üyeliği işin durumunu değiştirmez.**

- **İş durumu yalnız açık bir durum eylemiyle veya durum sütunları arasındaki Kanban hareketiyle değişir.** Bir işi planlama görünümünden çıkarmak işin durduğu, tamamlandığı veya vazgeçildiği anlamına gelmez.

- **Planlanan başlangıç tarihi işin ne zaman başlamasının düşünüldüğünü belirtir; işi gizlemez, otomatik başlatmaz ve durumunu değiştirmez.** Hedef tarihi, yeniden görünme tarihi ve kişisel hatırlatmadan ayrı bir anlam taşır; saat bazlı zaman bloklama veya çalışma oturumu planlama özelliği değildir.

### Kanban

- **Kanban iş öğelerini durumlarına göre sütunlarda gösterir; durum sütunları arasındaki kart hareketi ana işin durumuna yansır.**

- **Kapanmış işlerde `Tamamlandı` veya `Vazgeçildi` sonucu aynı terminal iş akışı durumunda bulunsalar bile kart üzerinde ayırt edilir.** Sonuç yalnız açık kapatma veya yeniden açma eylemiyle değişir.

- **Devam eden İş sayısı ve aktif kartların mevcut durumda geçirdiği süre gösterilir.** Proje veya ilgili Akıllı Koleksiyon için belirlenen isteğe bağlı kişisel odak eşiği aşıldığında görsel uyarı verilir; kart hareketleri engellenmez.

- **Kullanıcı Yapılandırma modunda tek tek iş durumları için varsayılan olarak kapalı bir soft WIP sınırı tanımlayabilir.** Sınır aşıldığında sütun mevcut sayı ile sınırı renk dışı erişilebilir bir işaretle birlikte nötr biçimde gösterir; kart hareketini engellemez, bildirim, sağlık veya performans hükmü üretmez ve hiçbir işi otomatik değiştirmez. Bu durum bazlı sınır, proje veya koleksiyon düzeyindeki kişisel odak eşiğinden ayrı yapılandırmadır.

- **Kanban kartı kayıtlı görünümün `görünür alanlar` ayarıyla taranabilir bir özet sunar.** Güçlü varsayılanlar iş anahtarı ve türünü, durumunu ve varsa kapanış sonucunu, önceliği, ilgili planlanan başlangıç/hedef/yeniden görünme tarihlerini, blokaj veya riski ve varsa kontrol listesi ilerlemesini gösterir.

- **Kullanıcı durum sütunlarını yalnız görünümü sıkıştırmak için daraltabilir.** Daraltılmış sütun adını, kart sayısını ve açık blokaj gibi önemli sinyalleri göstermeye devam eder; daraltma işleri filtrelemez, silmez veya durumlarını değiştirmez. Kanban ve normal Akıllı Koleksiyon görünümleri bağımsız manuel kart sırası tutmaz; kayıtlı görünümün açık sıralama ayarını kullanır. Backlog’un tek kalıcı manuel sırası ile yalnız açıkça oluşturulan Önceliklendirme oturumunun görünüm-yerel rank'i bu kuralın iki ayrı ve birbirini değiştirmeyen istisnasıdır. Adlandırılmış roadmap görünümlerinin aşağıda tanımlanan grup ve sütun sunum sırası kart önceliği sayılmaz.

### Liste görünümü

- **Liste görünümü planlanmamış işler dahil filtrelenen iş öğelerini alanlarıyla birlikte yoğun ve taranabilir düzende sunar.**

### Backlog

- **Backlog henüz planlanmamış işler dahil değerlendirilmesi gereken iş öğelerini gösteren hazır, dinamik bir Akıllı Koleksiyondur.** Bir işi Backlog’da görmek, ele almak veya Backlog’dan başka bir planlama görünümüne almak durumunu değiştirmez.

- **Backlog kendine ait tek kalıcı manuel sıra tutar.** Kullanıcı kartları sürükleyerek “hangisini önce ele alacağım?” kararını kalıcılaştırabilir. Alternatif öncelik, tarih veya alan sıralaması geçici ya da kayıtlı sunum olarak seçildiğinde manuel sıra arka planda korunur ve kullanıcı yeniden `Manuel sıra` görünümünü seçtiğinde geri gelir. Bu sıra Kanban veya normal Akıllı Koleksiyonlarda bağımsız manuel konum üretmez; açık Önceliklendirme oturumunun ayrı rank'i Backlog sırasına yazılmaz. Kullanıcının bugün ele alacağı işler ayrıca Günlük Odak’a seçilir.

### Günlük Odak

- **Günlük Odak kullanıcının farklı projelerden bugün ele almak istediği işleri kişisel çalışma görünümünde toplar.** Bir işi bu görünümde göstermek durumunu veya proje aşamasını değiştirmez.

- **Yüzey, hedef tarihi yaklaşan veya yeniden görünme tarihi gelen az sayıda işi ayrı bir `Adaylar` bölümünde gösterebilir.** Her aday hangi tarih alanı nedeniyle önerildiğini açıklar. Aday olmak Günlük Odak üyeliği değildir; iş yalnız kullanıcı kabul ettiğinde odağa alınır ve kabul ya da ret işin durumunu, önceliğini veya proje aşamasını değiştirmez.

- **Günlük Odak ayrıca kullanıcının profil saat dilimindeki seçili takvim gününde gerçekleşen desteklenen önemli olayları `Bugün ne oldu?` bölümünde salt okunur olarak gösterir.** Bölüm; tamamlanan, vazgeçilen veya yeniden açılan İşleri, kaydedilen Kararları, ulaşılan Kilometre Taşlarını, yayımlanan Proje Sürümü/changelog girdilerini, çözülen Üretim Olaylarını ve gerçekleşen olayların zaman çizelgesine giren diğer açıkça desteklenen yaşam döngüsü olaylarını ana kaynaklarından türetir.

- **`Bugün ne oldu?` ayrı günlük kaydı, düzenlenebilir Daily Note, kopyalanmış içerik veya ikinci olay geçmişi oluşturmaz.** Her satır olay zamanını, proje kapsamını ve ortak `Kaynak kaydı aç` eylemini taşır. Profil saat dilimi değiştiğinde görünüm gün sınırlarını yeniden hesaplar; kaynak olayın kesin zaman damgasını değiştirmez. Kalıcı serbest içerik proje veya Kişisel Wiki Belgesinde, geçici sınıflandırılmamış içerik Yakalama Gelen Kutusu'nda kalır.

- **Kullanıcı seçili gün için isteğe bağlı `Odağı kapat` eylemiyle sakin bir kapanış görünümü açabilir.** Görünüm o gün tamamlanan, vazgeçilen, yeniden görünme tarihiyle ertelenen ve Günlük Odak'ta açık kalan İşleri ana kayıt ve olaylarından ayrı gruplarda gösterir; her öğe kaynağını açar. Kapanış görünümü yeni özet kaydı, günlük snapshot, çalışma seansı veya ikinci olay geçmişi oluşturmaz.

- **`Odağı kapat` açık işleri tamamlamaz, Günlük Odak'tan çıkarmaz, başka güne taşımaz ve sıfır iş hedefi dayatmaz.** Kullanıcı kapanıştan sonra aynı günün Günlük Odak görünümüne geri dönebilir. Ürün bu davranıştan seri, puan, performans hükmü veya zorunlu günlük ritüel üretmez.

### Odak Dönemleri

- **Odak Dönemi farklı projelerden işleri isteğe bağlı olarak 1–8 haftalık ortak kapsamda toplar.** Dönem amaç ve başlangıç/bitiş tarihini taşır. Başlangıç kapsamı ile kapanış kapsamı ayrı, değişmez tarihsel snapshot’lar olarak korunur; güncel ana iş kayıtlarının yerine geçmez.

- **Bir iş aynı anda en fazla bir etkin Odak Dönemi’nde bulunabilir.** Başka etkin döneme alma açık bir taşıma eylemidir; geçmiş dönem üyelikleri ve snapshot’lar korunur. İşin başka eşzamanlı hedeflere katkısı Kilometre Taşı veya gerekçeli standart ilişkilerle gösterilebilir.

- **Kullanım zorunlu değildir.** Döneme ekleme iş durumunu veya proje aşamasını değiştirmez. Zorunlu kadans, velocity/kapasite puanı ve otomatik rollover yoktur.

- **Dönem kapanışında başlangıçta bulunan, sonradan eklenen, kapsamdan çıkarılan, tamamlanan ve açık kalan işler tarafsız biçimde karşılaştırılır.** Özet performans notu, başarı puanı veya velocity hesabı üretmez.

- **İsteğe bağlı tarih karşılaştırması, başlangıç snapshot’ındaki hedef tarihleri mevcut değişiklik geçmişi, tamamlanma olayı ve dönem kapanış anıyla karşılaştırır; hedefi öne ya da ileri taşınan, hedefinde tamamlanan, hedefinden sonra tamamlanan ve hâlâ açık olan kayıtları tarafsız biçimde gösterir.** Yeni bir `gerçekleşen tarih` alanı, sağlık hükmü, başarı puanı veya performans skoru üretmez.

- **Açık işler toplu karar ekranında gösterilir.** Kullanıcı seçili işleri sonraki döneme, Backlog’a veya başka bir döneme topluca gönderebilir ya da açık kapatma eylemiyle vazgeçebilir. Sistem kullanıcının önceden açacağı bir kuralla bütün açık işleri otomatik olarak sonraki döneme taşımaz.

- **Kapanışta atlanabilir kısa bir dönem değerlendirmesi sunulur.** Kullanıcı sürdürmek, değiştirmek veya sonraki dönemde denemek istediği öğrenimleri kaydedebilir. Bir öğrenimden takip işi yalnız açık kullanıcı eylemi ve oluşacak iş/ilişki önizlemesiyle oluşturulur; oluşturulan takip işi kaynak Odak Dönemiyle ilişkilendirilir. Sistem kendiliğinden action item üretmez.

### Birleşik Takvim

- **Birleşik Takvim desteklenen tarihli kayıtları gün, hafta, ay ve `Agenda` görünümünde gösterir.** Planlanan başlangıç, hedef ve yeniden görünme tarihleri ayrı tür ve anlamlarıyla sunulur; takvim bütün projeler veya seçilen proje kapsamında incelenebilir. Başlangıç ile hedef tarihi birlikte bulunan işler hafta ve ay görünümlerinde tarih aralığı olarak gösterilir; gün görünümü yalnız seçili gündeki konumlarını gösterir.

- **`Agenda`, aynı kayıtları seçilen kapsam ve tarih türü filtrelerini koruyarak kronolojik, yoğun bir listede sunar.** Her satır temsil ettiği tarih türünü açıkça gösterir ve ortak `Kaynak kaydı aç` eylemini kullanır. Agenda üyeliği, bağımsız Event kaydı, yeni tarih alanı veya ikinci takvim doğruluk kaynağı oluşturmaz.

- **Kullanıcı bir tarih işaretini başka güne sürükleyerek yalnız temsil ettiği kaynak tarih alanını güncelleyebilir.** Tarih türü ve eski/yeni değer bırakmadan önce görünür olur; değişiklik iş durumunu veya diğer tarih alanlarını etkilemez ve güvenli biçimde geri alınabilir.

### Kilometre taşları

- **Kilometre taşları araştırma, tasarım, doğrulama, beta veya iş sonucu gibi önemli ara hedefleri temsil eder.** Başlık, açıklama ve isteğe bağlı hedef tarihi taşır; yaşam durumu [ortak domain sözleşmesindeki](02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) `Planlandı`, `Ulaşıldı` veya `Vazgeçildi` değerlerinden biridir. İş öğeleri kilometre taşlarına [`Kilometre taşına katkı` ilişkisiyle](02-domain-model-and-lifecycle.md#standart-ilişki-türleri) bağlanabilir.

- **Kilometre Taşına ulaşmak bağlı İşleri kapatmaz; bütün bağlı İşlerin kapanması da Kilometre Taşını otomatik olarak `Ulaşıldı` yapmaz.** Durum yalnız açık kullanıcı eylemiyle değişir ve önceki değer geçmişte korunur.

- **Kilometre Taşı ortak domain sözlüğündeki ara sonuç anlamını kullanır.** Proje aşaması, Odak Dönemi ve Proje Sürümüyle kavramsal ayrımı yalnız [ortak terim sözlüğünde](02-domain-model-and-lifecycle.md#terim-sözlüğü) tanımlanır.

### Roadmap

- **Roadmap proje aşamaları, kilometre taşları, öncelik ölçütü değerleri, tarihli işler ve isteğe bağlı roadmap ufku üzerinden gelecekteki yönü gösterir.** Varsayılan ürün yönü görünümü Araştırma işindeki problem/fırsatı ve hedeflenen sonucu birincil, ona köken ilişkisiyle bağlı çözüm/Özellik işlerini ikincil bağlam olarak sunar. Kullanıcı bütün iş türlerini birincil gösteren yapılandırılabilir görünümler de kaydedebilir; ayrı Initiative veya Idea yaşam döngüsü oluşmaz.

- **Planlanan başlangıç ile hedef tarihi bulunan işleri planlanan aralık olarak, yalnız hedef tarihi bulunan işleri hedef noktası olarak sunar.** Granüler günlük takvimin veya iş durumunun yerini almaz.

- **İşler durum, proje aşaması ve tarihlerden bağımsız isteğe bağlı `Şimdi`, `Sırada` veya `Sonra` roadmap ufku taşıyabilir.** Ufuk işi başlatmaz, durumunu değiştirmez, hedef tarih üretmez veya taahhüt anlamına gelmez; roadmap görünümlerinde filtreleme ve gruplama, herkese açık snapshot’ta ise ayrıca onaylanan bir sunum alanı olarak kullanılabilir.

- **Roadmap aktif blokajı kompakt bir rozetle gösterir.** Kullanıcı rozeti seçtiğinde yalnız ilgili engellenen kayıt ile kesin engel kaynağı hafif bir bağlantıyla vurgulanır ve iki kaynak da açılabilir; görünüm sürekli bağımlılık ağı, otomatik yeniden zamanlama veya kritik yol hesabı üretmez.

- **Adlandırılmış Roadmap görünümü mevcut bir alanı grup/lane ekseni, ikinci bir sıralı veya seçim alanını ise ürünün erişilebilir paletiyle renk ve metin işareti olarak kullanabilir.** Eşleme yalnız görünüm üstverisidir; yeni alan, ayrı Theme/Legend kaydı, kalıcı sınıflandırma veya keyfî renk seçici oluşturmaz. Aynı görünüm zaman ölçeğini ve ürünün sunduğu sınırlı görsel yoğunluk tercihini saklar; serbest font, özel CSS veya kapsamlı kart stil editörü sunmaz.

- **Görünüm bazında açılabilen ve varsayılan olarak daraltılmış `Planlanmamış adaylar` alanı, görünümün kesin filtrelerine uyan fakat planlanan başlangıç/hedef tarihi ve `Şimdi`/`Sırada`/`Sonra` ufku bulunmayan işleri canlı olarak gösterir.** Alan yeni Parked durumu, ikinci Roadmap üyeliği veya bağımsız manuel sıra üretmez. Kullanıcı adayı plana alırken değişecek tarih alanını veya roadmap ufku alanını önizleyip açıkça onaylar; görünüm üyeliği iş durumunu örtük değiştirmez.

- **Roadmap düzenleme ve yapılandırma kontrollerini gizleyen tam ekran `Sunum Kipi`ni destekler.** Kip mevcut adlandırılmış görünümü kullanır, öğe ayrıntılarını salt okunur açar ve çıkışta aynı görünüm ile konuma döner. Ayrı slayt, sunum kaydı, içerik kopyası, anlatım metni, sunum sırası veya ses/video kaydı oluşturmaz.

- **İç Roadmap kapsamı filtreler, kayıtlı görünümler ve işlerin isteğe bağlı `Şimdi`/`Sırada`/`Sonra` ufkundan açıklanabilir biçimde türetilir; bunlardan bağımsız ikinci bir `Roadmap'te göster` üyeliği tutulmaz.** Dış anlatının kürasyonu [onaylı herkese açık snapshot](14-sharing-and-public-publishing.md#build-in-public) ile yapılır ve iç Roadmap üyeliğini değiştirmez.

### Kapsam Ağacı

- **Kapsam Ağacı mevcut `Proje → Özellik → Kapsanan işler` ilişkilerini açılıp kapanabilen salt okunur bir görünümde sunar.** Kayıtların durum, blokaj, ilgili kilometre taşı ve Özellikten türetilen ilerleme bağlamını ana kaynaklardan gösterir; bir kaydı seçmek ortak `Kaynak kaydı aç` eylemini kullanır.

- **Görünüm yeni parent–child ilişkisi, içerik kopyası, bağımsız durum veya manuel ağaç sırası üretmez.** Kullanıcı ağaç içinde sürükleyerek kapsamı değiştiremez. Bir iş yalnız birincil Özelliğinin altında görünür; başka Özelliklerle standart ilişkileri kaynak detayında erişilebilir kalır.

### İş bağımlılıkları ve blokajlar

- **Bir iş başka bir iş, karar veya açık soru tarafından engellenebilir.** Her engelleme ilişkisi `Aktif` veya `Çözüldü` yaşam durumunu taşır. Aktif ilişkiler engellenen işi planlama yüzeylerinde açıkça ayırt eder; çözülenler aktif blokaj sinyallerinden çıkar fakat tarihsel bağlamda korunur.

- **`Blokaj` dikkat sinyali yalnız iki deterministik olaydan üretilir: engellenen İşe yeni bir `Aktif` engelleme ilişkisi kurulması ve çözülmüş bir ilişkinin yeniden `Aktif` yapılması.** Sinyal engellenen İşi, engel kaynağını ve ilişkinin kurulma zamanını taşır ve [Birleşik Bildirim Merkezinde](04-workspace-and-projects.md#birleşik-bildirim-merkezi) kaynak grubu altında gösterilir. Blokajın süresi, engel kaynağının durumu, döngü tespiti veya `Çözüldü` duruma geçiş ayrıca sinyal üretmez.

- **Kullanıcı `Engel çözüldü` eylemiyle çözüm tarihini ve isteğe bağlı notu kaydeder; çözülmüş ilişkiyi yeniden etkinleştirebilir.** Engel kaynağını kapatmak ilişkiyi otomatik çözmez, yalnız gerekçesi görünür bir çözüm önerisi üretebilir. `İlişkiyi kaldır` yalnız yanlış kurulmuş bağı silmek içindir ve çözüm geçmişinin yerine kullanılmaz.

- **Özellik ve Odak Dönemi detayında isteğe bağlı açılan salt-okunur `Bağımlılıklar` görünümü, yalnız o kapsamdaki mevcut aktif ve çözülmüş blokaj ilişkilerinden türetilir.** Düğümler ana kayıtları açar; aktif/çözülmüş durum, ilişki yönü ve güvenle saptanabilen döngü açıklanabilir ve yalnız renge dayanmayan işaretlerle gösterilir. Görünüm yeni ilişki, ayrı Mermaid kaynağı, manuel düğüm konumu veya ikinci planlama verisi üretmez.

- **Özellik çalışma alanı genelindeki veya serbest düzenlenebilir karmaşık bağımlılık grafikleri, cross-team resource planning, otomatik yeniden zamanlama veya kritik yol planlaması oluşturmaz.**

### Toplu düzenleme

- **Kullanıcı liste, Kanban, Akıllı Koleksiyon, içe aktarma sonucu ve benzeri çok kayıtlı yüzeylerde seçtiği işlerin mevcut alanlarını topluca güncelleyebilir.**

- **Toplu işlem kullanıcı arayüzünü dondurmadan ilerleme, başarı ve başarısız kayıtları görünür kılar.** Geri alınabilir alan değişiklikleri [ortak güvenli geri alma sözleşmesini](02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma) kullanır.

- **İlk ürün tekrar kullanılabilir, kullanıcı tanımlı çok kayıtlı eylem düğmeleri sunmaz.** Çok kayıtlı değişiklikler açık kayıt seçimi, uygulanacak alan değişiklikleri ve sonuç önizlemesiyle Toplu Düzenleme üzerinden yürür.

### Gerçekleşen olayların zaman çizelgesi

- **Karar, belge, tasarım, iş, ulaşılan kilometre taşı, yaşam döngüsü değişikliği, kod değişikliği, üretim olayı, deney/doğrulama sonucu ve sürüm gibi gerçekleşmiş önemli olaylar proje veya özellik türündeki iş bağlamında kronolojik gösterilir.** Vazgeçme gerekçesi ilgili olayda görünür.

### Proje Etkinliği

- **Her proje, mevcut kayıtların etkinlik ve değişiklik geçmişlerinden türetilen ikincil bir `Proje Etkinliği` görünümü sunar.** Görünüm İş, Belge, Karar, Risk, otomasyon ve GitHub gibi kaynak kayıt veya sistem türlerine; oluşturma, alan değişikliği, durum değişimi, arşivleme, ilişki ve otomasyon gibi olay türlerine göre filtrelenebilir.

- **Her etkinlik değişikliği kullanıcının, otomasyonun veya bağlı GitHub kaynağının yaptığını açıkça gösterir; kaynak kaydı açar ve desteklenen alan değişikliklerinde önceki ile sonraki değeri sunar.** Görünüm mevcut geçmişi toplar; yeni kalıcı olay kaydı, ikinci audit doğruluk kaynağı veya ayrı otomasyon run günlüğü oluşturmaz.

- **Aynı aktörün aynı ana kayıtta beş dakika içinde yaptığı güvenli alan değişiklikleri, Proje Etkinliği ve kayıt geçmişlerinde açılabilir tek sunum kümesinde gösterilir.** Küme açıldığında her atomik olay, zaman, önceki–sonraki değer, köken ve geri alma sınırı ayrı görünür. İnsan, otomasyon ve GitHub değişiklikleri birbirine karıştırılmaz; yorumlar, güvenlik olayları, yayınlar ve önemli yaşam döngüsü değişiklikleri sıradan alan düzenlemeleri içinde gizlenmez. Gruplama denetim olaylarını veya geri alma sınırlarını birleştirmez.

- **Proje Etkinliği ayrıntılı `Ne değişti?` sorusuna, gerçekleşen olayların zaman çizelgesi ise karar, sürüm, kilometre taşı, üretim olayı ve önemli yaşam döngüsü değişiklikleri gibi ürün hikâyesine cevap verir.** Her etkinlik Timeline olayı veya bildirim üretmez. Proje Etkinliği varsayılan proje açılış yüzeyi ya da Bildirim Merkezi bölümü değildir.

### Kişisel hatırlatmalar

- **Kullanıcı yaklaşan hedef tarihleri ve daha sonra ele almak istediği İşler için kişisel hatırlatma oluşturabilir.** Ayrıca Proje, Belge, İş, Karar, Risk, Tasarım, Kaynak, Kilometre Taşı, Proje Sürümü, Üretim Olayı ve Test Açığı kayıtlarında ortak `Yeniden bak` eylemiyle belirli bir zamanda aynı kaynağa dönmek üzere kişisel hatırlatma kurabilir.

- **Belge için oluşturulan `Yeniden bak`, isteğe bağlı olarak belgenin belirli bir Markdown başlık bölümünü hedefleyebilir.** Hedef keyfî paragraf veya değişken metin aralığı değil, kararlı bölüm kimliği taşıyan başlıktır. Başlık yeniden adlandırıldığında veya belge içinde taşındığında bağ aynı bölüm kimliğini izler. Bölüm silinir ya da güvenle çözümlenemezse hatırlatma belgeyi açar, kayıp bölüm hedefini açıkça gösterir ve sessizce başka başlığa yönelmez.

- **Proje Sürümü veya changelog yayımlandıktan sonra sunulabilen, atlanabilir `Etkisini yeniden değerlendir` eylemi tarih seçildiğinde bu ortak `Yeniden bak` mekanizmasını kaynak Proje Sürümü için kurar.** Zamanı geldiğinde [Proje Sürümü değerlendirme bağlamını](12-github-and-project-releases.md#proje-sürümü-planlama) açabilir; ayrı bir hatırlatma türü, değerlendirme kaydı, öğrenim, karar, takip işi veya başka ana kayıt oluşturmaz. Varsayılan olarak tarih seçilmemiştir.

- **Açık/çözülmüş yaşam durumu ürün tarafından kesin ve açıklanabilir biçimde tanımlanan desteklenen bir kaynakta kullanıcı `Yeniden bak` kurarken `Her durumda` veya `Yalnız hâlâ açıksa` davranışını seçebilir.** Mevcut koşulsuz semantiği korumak için varsayılan `Her durumda`dır. `Yalnız hâlâ açıksa` genel koşul oluşturucu değildir; yalnız zamanı geldiğinde aynı ana kaynağın o andaki açık/çözülmüş yaşam durumunu değerlendirir.

- **`Yeniden bak` zamanı geldiğinde ve seçilen koşul sağlandığında Birleşik Bildirim Merkezi’nde kaynağa yönlendiren tek bir dikkat sinyali üretir.** Kaynak artık açık değilse sinyal üretilmez; hatırlatma geçmişi hangi kaynak durumu ve nedenle bastırıldığını gösterir. Kaynak durumu güvenle çözümlenemiyorsa sistem hatırlatmayı sessizce bastırmaz, koşulun değerlendirilemediğini açıklayan kaynak bağlantılı bir dikkat sinyali üretir. Kullanıcı oluşan sinyali kapatabilir veya yeni zamana erteleyebilir; bu eylemler yeni iş ya da içerik kopyası oluşturmaz ve kaynak kaydın durumunu, önceliğini, aşamasını, ilişkilerini veya görünüm üyeliğini değiştirmez.

- **Kişisel hatırlatma ve `Yeniden bak`, yalnız iş öğelerinde bulunan `Yeniden görünme tarihi`nden ayrıdır.** Bir işi aktif seçim kümelerinde geri plana alma ve zamanı gelince yeniden görünür kılma davranışını yalnız `Yeniden görünme tarihi` taşır.

### Yeniden görünme tarihi

- **Kullanıcı bir işin en erken ne zaman yeniden değerlendirilmesi gerektiğini belirten isteğe bağlı yeniden görünme tarihi tanımlayabilir.** Bu tarih hedef tarihinden ve kişisel hatırlatmadan ayrıdır.

- **Tarih gelene kadar iş varsayılan aktif Backlog, Kanban ve Günlük Odak kümelerinde geri planda tutulabilir; aranabilir, takvimde görülebilir ve erişilebilir kalır.** Tarih geldiğinde aktif seçim kümelerinde yeniden görünür ve isteğe bağlı bildirim üretir. Tarih işin durumunu, önceliğini veya proje aşamasını değiştirmez ve yalnız iş öğelerinde kullanılır.

### Proje kapanış özeti

- **Kullanıcı projeyi tamamlarken veya projeden vazgeçerken İş, Kilometre Taşı, Karar, Risk, Üretim Olayı, Proje Sürümü, zaman çizelgesi ve öğrenimlerden isteğe bağlı, sürümlü bir Proje Belgesi olarak kapanış özeti oluşturabilir.** Belge türü `Genel`, başlığı varsayılan olarak `Proje kapanış özeti`dir ve kaynak Projeye köken bağı taşır.

- **Kullanıcı seçtiği Karar, Risk, Proje Sürümü, Belge, Üretim Olayı ve tamamlanmış İş kayıtlarından yalnız bölüm başlıkları ile okunabilir kaynak bağlantıları içeren düzenlenebilir bir `Kapanış özeti taslağı` oluşturabilir.** Önizleme hangi kaynakların hangi başlığa gireceğini gösterir; sistem yorum, sonuç, başarı hükmü, gerekçe veya özet metni üretmez. Taslak kalıcı kapanış özeti ancak kullanıcı düzenleyip açıkça kaydettiğinde olur ve kaynak kayıtların yerine geçmez; [Başlangıç iskeleti](04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları) değildir.

- **Özet isteğe bağlı olarak planlanan hedef tarihlerinin değişiklik geçmişini ve mevcut tamamlanma/kapanış olaylarını tarafsız bir tarih karşılaştırmasında gösterebilir.** Karşılaştırma hangi tarihlerin taşındığını ve kayıtların hedeflerinden önce, hedefinde, sonra veya açık kapandığını açıklar; yeni gerçek tarih alanı, proje sağlık hükmü ya da performans puanı oluşturmaz.

- **Düzenlenebilir özet projeyi kilitlemez ve zorunlu değildir.** Yeniden kullanılacak öğrenimler kaynak proje ve dönem kökeni korunarak bağımsız Kişisel Wiki belgesine kopyalanabilir. Kapanış özeti yalnız kullanıcının açık oluşturma ve kaydetme eylemiyle doğar; genel otomatik ilerleme anlatısı sınırı [Kapsam Dışı Hükümlerde](19-out-of-scope.md#ai-otomasyon-ve-programatik-erişim) yaşar.

## Otomasyon

### Kullanıcı başlatmalı kayıt eylemleri

- **Kullanıcı tek bir uygulama kaydı üzerinde çalışan, adlandırılmış birleşik kayıt eylemleri oluşturabilir.** Örneğin `Start Work` eylemi açık İşin durumunu `In Progress` yapıp onu Günlük Odak’a ekleyebilir. Eylem yalnız kullanıcı açıkça başlattığında çalışır, etkileyeceği alanları görünür kılar ve geri alınabilir değişikliklerde [ortak güvenli geri alma sözleşmesini](02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma) kullanır.

- **Eylem tanımı çalışma anında kullanıcıdan sınırlı `Tarih`, `Sayı`, `Seçim` veya mevcut bir ana kayıtla `İlişki` girdisi isteyebilir.** Girdi alanları eylem tasarımında önceden tanımlanır; kullanıcı çalıştırmadan önce seçtiği değerleri ve hedef kayıtta oluşacak kesin değişiklikleri birlikte önizler.

- **Kayıt eylemleri uygulama içindeki asıl kayıt alanlarındaki değişikliklerle sınırlıdır.** Serbest script, harici çağrı veya yeni kayıt üretmez; IDE, CLI, repository, GitHub mutasyonu, Claude Code, Codex, Conductor veya başka ajan/çalıştırma ortamı başlatmaz. Kullanıcı tanımlı birleşik eylem tek hedef kayıt üzerinde çalışır; çok kayıtlı işlemler Toplu Düzenleme’de kalır.

### Hafif uygulama içi otomasyon kuralları

- **Kullanıcı uygulama kayıtları üzerinde çalışan basit tetikleyici, isteğe bağlı koşul ve eylem kuralları oluşturabilir.** Tekrarlanan iş oluşturma hazır otomasyon türlerinden biri olarak sunulur; her tekrar yeni ve bağımsız bir iş oluşturur ve oluşan işler diğer işler gibi planlama görünümlerinde, Günlük Odak’ta ve Birleşik Takvim’de görünür. Sistem aynı işi tamamlanınca tarihini ileri alıp yeniden açan tekrarlama davranışı kullanmaz.

- **Yalnız açıkça etkinleştirilen kurallar çalışır ve yaptıkları değişiklikler ana kayda yansır.** [GitHub geliştirme kayıtlarının](12-github-and-project-releases.md#github-geliştirme-kayıtları) sağladığı hazır PR-merge otomasyonu dışında GitHub ve diğer harici servis olayları genel otomasyon oluşturucusunda tetikleyici olarak kullanılamaz; dış olaylar yalnız ilgili özelliklerin tanımladığı öneri veya dikkat sinyallerini üretebilir. Bir otomasyonun ürettiği değişiklik başka bir otomasyonu tetiklemez; birden fazla kural yalnız aynı özgün kullanıcı veya desteklenen sistem olayına bağımsız olarak tepki verebilir. Otomasyon kendiliğinden ilişki, değişiklik etkisi veya karar çıkarmaz.

- **Aynı özgün olayın tetiklediği bütün kurallar herhangi bir yazma yapılmadan önce hedef ve kaynak bazında öneri kümesinde toplanır.** Aynı hedef alan için birlikte uygulanamayan değerler öneriliyorsa hedefte hiçbir otomasyon değişikliği yapılmaz ve kullanıcıya kurallar, değerler ve çözüm yolu gösterilen eyleme dönük çatışma sunulur; kural sırası veya son yazan kazanır uygulanmaz. Çatışmayan öneriler, bütün ilgili kuralların atfını taşıyan tek atomik ve idempotent mutasyonda uygulanır.

- **Kullanıcı hazır `Bağlı gerekli PR'lar merge edildiğinde işi Tamamlandı say` kuralını açıkça etkinleştirebilir.** Kural etkinse bir İşe en az bir `Tamamlanma için gerekli` PR bağlı olması ve bu roldeki bütün PR'ların merge edilmesi işi projenin terminal tamamlanma durumuna alır ve kapanış sonucunu `Tamamlandı` yapar. Gerekli PR'lardan yalnız birinin veya herhangi bir `Bağlamsal` PR'ın merge edilmesi işi kapatmaz; hiç gerekli PR bulunmayan İş de bu kurala uygun sayılmaz. Kural etkin değilse aynı koşul yalnız GitHub geliştirme kayıtlarında görünür ve kullanıcıya `Tamamlandı olarak işaretle` önerisi sunulur.

- **Bu hazır kural PR açılması, review istenmesi, değişiklik talebi, check sonucu veya başka GitHub olaylarını genel durum otomasyonlarına açmaz.** Başarısız ya da sonradan başarısız olan check kapatmayı geciktirmez ve otomatik tamamlanan işi yeniden açmaz; ilgili dikkat ve yayın hazırlığı sinyallerini üretir. Kullanıcı işi açık yeniden açma eylemiyle yeniden etkinleştirebilir veya kaynak bağlantılı takip işi oluşturabilir.

- **Ürün kullanıcının tekrar eden hareketlerini izleyerek otomasyon veya kayıt eylemi önermez.** Bütün kurallar ve birleşik kayıt eylemleri kullanıcı tarafından bilinçli biçimde oluşturulur. Otomasyonlar kayıt eylemleri gibi yalnız uygulama içi kayıtları değiştirir; dış geliştirme veya ajan iş akışı çalıştırmaz.

- **Kullanıcı yeni veya değiştirilmiş bir kuralı etkinleştirmeden ya da elle çalıştırmadan önce isteğe bağlı dry run başlatabilir.** Dry run mevcut veride eşleşen kayıtları ve uygulanacak değişiklikleri gösterir, ana kaydı değiştirmez ve her otomatik çalıştırma öncesinde zorunlu onay kapısı oluşturmaz.

- **Kural tanımındaki her kaydedilmiş değişiklik sürüm geçmişinde karşılaştırılabilir.** Kullanıcı önceki bir tanımı geri yüklediğinde yalnız kuralın bundan sonra kullanılacak etkin tanımı değişir; geçmiş otomasyon etkileri yeniden yazılmaz veya kendiliğinden geri alınmaz.

- **Başarısız otomasyon Birleşik Bildirim Merkezi’nde eylem gerektiren sinyal üretir.** Sinyal ilgili kuralı ve özgün tetikleyiciyi, başarısız olan koşul ya da eylem adımını ve kullanıcıya yönelik uygulanabilir hata nedenini gösterir; yalnız genel bir `çalışmadı` durumu sunmaz.

- **Kullanıcı arayüzü açıkken bir otomasyon kaynak kaydı değiştirdiğinde tek bir sonuç bildirimi açılır ve güvenli değişiklikler için `10 saniye içinde geri al` eylemi sunar; süre sonunda bildirim kendiliğinden kapanır.** Daha sonra geri alma, her kaynak kaydın normal değişiklik geçmişinden ayrı ayrı başlatılabilir. Önizleme otomasyonun yazdığı alanları ve o andan sonraki değişiklikleri gösterir; ilgisiz sonraki düzenlemeleri korur, aynı alandaki daha yeni değerle çatışıyorsa sessizce üzerine yazmak yerine işlemi durdurup çatışmayı açıklar.

- **Her otomasyon değişikliği kaynak kaydın normal etkinlik/değişiklik geçmişinde ilgili kural, kural tanımı sürümü, tetikleyici, sağlanan koşullar ve uygulanan eylemle açıklanır.** Kural, tetikleyici ve etkilenen bütün kayıtları tek run altında birleştiren ayrı otomasyon çalıştırma günlüğü veya run bazlı toplu geri alma sistemi bulunmaz.
