# Ticari Genişleme

Bu belge ticari domainin tek sahibidir; ilk ürün teslim kapsamı değildir ve kararlaştırılmış genişleme emri oluşturmaz. Test yöntemi ve etkinleşme sınırı [Ürün Kabulündeki ticari genişleme kabulünde](16-product-acceptance.md#ticari-genisleme-kabulu) yaşar.

<a id="kanit-bekleyen-ticari-gelecek"></a>
<a id="ilk-urun-sonrasi-ticari-genisleme"></a>
## Kanıt bekleyen ticari gelecek

- **Ticari paket kanıt bekleyen gelecek yönüdür.** Freelancer veya client-service şimdiden ürün segmenti değildir. Solo-builder dogfooding tek başına muhasebe benzeri bir domain’i taahhüt etmez.

- **Tek sözleşmeli aday Proposal hazırlama ve tarihli PDF/export’tur.** Invoice, manuel ödeme ve birleşik proje sunumu bağlayıcı olmayan nottur; Proposal değeri kanıtlanmadan ayrı ürün kararıyla açılamaz ve mevcut ayrıntılı Invoice hükümleri şimdiden taahhüt sayılmaz.

<a id="proposal-sozlesmeli-aday"></a>
### Sözleşmeli aday: Proposal hazırlama ve tarihli PDF

**Tetikleyici:** En az iki gerçek müşteri Projesinde teklif kapsamının Cantiara dışındaki bir araçta tekrar kurulması.

**İlk dilim:** Kullanıcı seçilen Özellik ve İş kayıtlarından taslak Proposal hazırlar; isteğe bağlı Çalışma Alanı rate card’ından aynı para birimli satır önerisi alabilir; tarihli PDF/export üretir. `Draft / Sent / Accepted / Rejected / Expired` yalnız kullanıcı beyanı veya kullanıcının girdiği expiry anının uygulanmasıyla değişir. Ürün e-posta göndermez, müşteri portalı açmaz, teslim, okundu veya müşteri kabulü iddiası taşımaz.

**İlerleme ve bırakma ölçütü:** Dilim, iki gerçek müşteri Projesinde dışarıda tekrar kurulan teklif kapsamını azaltmadan ilerlemez. Invoice, tahsilat veya birleşik sunum ihtiyacı doğarsa bunlar ayrı kararlardır. Kullanıcı teklifi yine dış defterde yaşatmak zorunda kalırsa aday bırakılır.

<a id="ticari-domain-uzantısı-ve-etkinleşme-önkoşulu"></a>
### Proposal diliminin domain uzantısı

- **Proposal adayı ancak aşağıdaki Proposal/rate card envanteri ve [ticari kabulün Proposal koşulları](16-product-acceptance.md#ticari-genisleme-kabulu) aynı kesin commit'te doğrulanabiliyorsa etkinleşir.** Invoice satırları bu dilimin etkinleşme önkoşulu değildir.

| Ticari varlık | Sınıf ve sahiplik | Asgari alanlar | Yaşam ve silme davranışı | Dilim |
| --- | --- | --- | --- | --- |
| Proposal | Proje ana kaydı | Kararlı kimlik, müşteri sunum bilgisi, tek para birimi, güncel taslak, revision zinciri | `Draft`, `Sent`, `Accepted`, `Rejected`, `Expired`; ortak Arşiv/Çöp Kutusu/geçmiş/export/yetki sözleşmesini izler | Sözleşmeli aday |
| Rate card | Çalışma Alanına ait yardımcı varlık | Ad, birim, tek para birimi, başlangıç fiyatı ve sürüm | Bağımsız paylaşılmaz; kullanım anında Proposal revision'a snapshot olur | Sözleşmeli aday |
| Proposal revision | Proposal'a ait değişmez bileşen | Revision kimliği, kaynak İş/Özellik snapshot'ı, satırlar, oran/vergi/indirim değerleri ve toplamlar | Gönderildiğinde değişmez | Sözleşmeli aday |
| Invoice | Proje ana kaydı | Kararlı kimlik, benzersiz belge numarası, müşteri/satıcı bilgisi, tek para birimi, kesin Proposal revision kökeni, satırlar, tarihler ve türetilen ödeme durumu | `Draft`, `Finalized`, `Cancelled` | Bağlayıcı olmayan not |
| Faturalama milestone'u | Proposal revision'a ait bileşen | Ad, uygun satır/miktar/tutar kapsamı | Revision ile değişmez | Bağlayıcı olmayan not |
| Ticari satır, vergi ve indirim dağılımı | İlgili Proposal revision veya Invoice'a ait bileşen | Kararlı satır kimliği, kaynak kökeni, yöntem, miktar, birim, oran ve hesaplanan değerler | Sahibinin yaşam döngüsünü izler | Proposal satırları adayda; Invoice satırları not |
| Manuel ödeme girdisi | Invoice'a ait değişmez bileşen | Tutar, tarih, yöntem, referans/not, oluşturma veya iptal aktörü ve zamanı | Silinmez; açık iptal olayıyla bakiyeden çıkarılır | Bağlayıcı olmayan not |

- **Proposal ana kaydı ortak domain sözleşmesini miras alır.** Kimlik, Proje kapsamı, erişim, Arşiv, Çöp Kutusu, geçmiş, güvenlik redaksiyonu, standart ilişki ve seçili dışa aktarma davranışları [Domain Modeli ve Yaşam Döngüsündeki](02-domain-model-and-lifecycle.md) ana kayıtlarla aynıdır. Rate card veya revision ikinci bağımsız doğruluk kaynağı olmaz.

### Müşteri teklifi ve kapsam kaynağı

- **Teklifin ana kapsam satırları seçilen ana Özellik ve İş kayıtlarından türetilir.** Hosting, lisans, üçüncü taraf hizmet veya bir proje işine karşılık gelmeyen başka kalemler açıkça ayrılmış ek maliyet satırları olarak eklenebilir. Ek satırlar teklifin dışında paralel proje kapsamı, İş kaydı veya genel gider defteri oluşturmaz.

- **`Draft` Proposal bağlı Özellik ve İş kayıtlarına canlı referans verir.** Kaynaktaki başlık, kapsam veya efor değişikliği taslakta görünür olur; ancak ticari fiyatı, birimi, indirimi veya vergi değerini sessizce değiştirmez. Proposal `Sent` olduğunda tarihli ve değişmez bir revision snapshot'ı oluşur.

- **`Sent`, `Accepted`, `Rejected` ve `Expired` kullanıcı beyanıdır.** Ürün teslim, okundu veya müşteri kabulü iddiası taşımaz; e-posta göndermez ve müşteri portalı açmaz. Kullanıcı isteğe bağlı expiry anı girer; Hesap locale'ının zamanı geçince o gönderilmiş revision `Expired` olur. Aynı revision `Sent`e dönmez; yeni teklif yeni revision ister.

- **Ana proje kapsamı daha sonra değişirse gönderilmiş veya kabul edilmiş revision değişmez.** Yeni taslak mevcut canlı kaynaklarla önceki revision arasındaki kapsam ve fiyat farkını görünür kılar. Müşteriye sunulan revision ile güncel iç kapsam birbirinin yerine geçmez.

### Hibrit teklif fiyatlandırması

- **Her teklif satırı açıkça `Sabit fiyat` veya `Miktar × birim fiyat` yöntemlerinden birini kullanır.** Miktar temelli yöntem saat, gün veya adet birimini destekler. Aynı satır iki yöntemi eşzamanlı kullanmaz ve hesap formülü PDF/export'ta açıklanabilir kalır.

- **Çalışma alanı düzeyindeki isteğe bağlı rate card girdisi ad, birim, tek para birimi ve başlangıç fiyatı önerebilir.** Öneri yalnız Proposal ile aynı para biriminde görünür. Proposal'a alındığında değer Proposal revision girdisine snapshot olur; rate card'ın daha sonra değişmesi mevcut taslağı veya gönderilmiş revision'ı sessizce güncellemez. Kullanıcı yeni değeri almak isterse kesin farkı görüp yeni revision'da açıkça uygular.

- **Ana İş kaydındaki hafif efor tahmini miktar için görünür başlangıç önerisi sağlayabilir; kabul edilmeden ticari miktara dönüşmez ve teklif değişikliği İş kaydının eforunu geri yazmaz.** Bu genişleme time tracking, timesheet, kişi performansı veya otomatik gerçekleşen maliyet hesabı oluşturmaz.

- **Her Proposal revision ve Invoice tam olarak bir ISO 4217 para birimi ve `Tax exclusive` ya da `Tax inclusive` vergi kipi taşır.** Hesaplar binary floating point ile değil decimal aritmetikle yürür. Sabit veya yüzde indirim vergi matrahından önce uygulanır. Belge düzeyi indirim, indirime uygun satırların indirim öncesi değerleri oranında dağıtılır; para birimi minor unit'ine yuvarlama sonrası kalan birimler kararlı satır kimliği artan sırasıyla dağıtılır. Her satırın vergi ve toplamı kendi indirimli değeri üzerinden hesaplanıp ISO 4217 minor unit'inde decimal `ROUND_HALF_UP` ile yuvarlanır; belge toplamı yuvarlanmış satırların toplamıdır ve yeniden bağımsız yuvarlanmaz.

- **Vergi kipi hesap formülünü değişmez biçimde belirler.** `Tax exclusive` satırda vergi, indirimli net tutar × vergi oranıdır ve brüt toplam net + vergidir. `Tax inclusive` satırda indirimli değer brüttür; net tutar `brüt / (1 + vergi oranı)` ile yuvarlanır, vergi brüt − net olarak türetilir. Vergi oranı sıfır olduğunda net ve brüt aynıdır. PDF, JSON ve arayüz aynı saklanan kesin girdilerden aynı hesap sonucunu kullanır.

Normatif golden örnekleri:

| Örnek | Kesin girdi | Beklenen dağılım ve sonuç |
| --- | --- | --- |
| EUR, exclusive | `A=100.00`, `B=50.00`, belge indirimi `%10`, vergi `%20` | İndirim `A=10.00`, `B=5.00`; net `90.00 + 45.00`; vergi `18.00 + 9.00`; toplam `162.00 EUR` |
| USD, remainder | `A=0.05`, `B=0.05`, `C=0.05`, sabit indirim `0.01`, vergi `%10`, satır kimliği `A < B < C` | İndirim `A=0.01`, `B=0.00`, `C=0.00`; net `0.04 + 0.05 + 0.05`; vergi `0.00 + 0.01 + 0.01`; toplam `0.16 USD` |
| GBP, inclusive | Brüt `120.00`, indirim `%10`, dahil vergi `%20` | İndirimli brüt `108.00`; net `90.00`; vergi `18.00`; toplam `108.00 GBP` |

### Invoice belge ve entegrasyon sınırı

- **Bu bölüm ve sonraki Invoice, ödeme ve birleşik sunum hükümleri bağlayıcı olmayan nottur.** Proposal değeri kanıtlanmadan taahhüt, kabul paketi veya etkinleşme önkoşulu oluşturmazlar.

- **Not olarak duran Invoice modeli; satıcı ve müşteri bilgileri, satırlar, para birimi, vergi/indirim, düzenlenme tarihi, vade tarihi, benzersiz belge numarası ve ödeme durumuyla yapılandırılmış Invoice kaydı ve profesyonel PDF üretir.** Aynı normalize edilmiş satıcı kimliği ile aynı belge numarası, ürünün kontrol ettiği veri kümesinde ikinci kez kesilemez; ürün dışındaki belge sistemlerinde küresel benzersizlik garanti edilmez. Belge kapsamındaki müşteri bilgisi tek başına birinci sınıf CRM profili, gelir puanlaması veya müşteri doğruluk kaynağı oluşturmaz.

- **Ürün oluşturma ve export öncesinde bu belgenin ülkeye özgü e-Fatura, e-Arşiv veya başka vergi otoritesi gönderimi olmadığını; muhasebe defteri, vergi beyanı, banka/ödeme alma ya da belirli bir ülkede tek başına yasal yeterlilik garantisi sunmadığını açıkça gösterir.** Bu yetenekler ancak sağlayıcı, ülke, güvenlik ve operasyon modeliyle ayrı entegrasyonlar olarak doğrulanabilir.

### Tekliften Invoice üretimi ve yaşam döngüsü

- **Projeye bağlı Invoice her zaman kesin bir kabul edilmiş teklif revision'ından üretilir.** Teklif isteğe bağlı faturalama milestone'ları taşıyabilir. Kullanıcı tam kalan tutarı, belirli bir milestone'u veya satırların henüz faturalanmamış miktar/tutarını Invoice'a alabilir; kaynak revision, milestone ve satır dağılımı belgeden geri açılabilir.

- **İptal edilmemiş Invoice'ların kümülatif tutarı kabul edilmiş revision'ın kapsamını aşamaz.** Ek kapsam için önce yeni teklif revision'ı veya açık değişiklik teklifi gönderilip kabul edilir. İlk ticari modül teklifsiz standalone Invoice üretmez.

- **Invoice `Draft` iken düzenlenebilir.** `Finalized` olduğunda benzersiz belge numarası, kaynak Proposal revision'ı, para birimi, satırları, vergi/indirim değerleri ve toplamı değişmez snapshot olur. Düzeltme finalized belgeyi silmez veya geriye dönük değiştirmez; eski Invoice `Cancelled` sonucuyla korunur ve yerine geçen yeni Invoice'a açıkça bağlanır.

- **Kullanıcı tutar, tarih, yöntem ve isteğe bağlı referans/not taşıyan manuel ödeme girdisi ekleyebilir.** Hatalı ödeme girdisi silinmez veya negatif ödemeyle dengelenmez; kullanıcı açık `Cancel payment` eylemiyle özgün girdiyi, iptal zamanı ve isteğe bağlı gerekçesiyle denetim geçmişinde korur. Yalnız iptal edilmemiş ödeme toplamı türetilen `Unpaid`, `Partially Paid` veya `Paid` durumunu belirler. `Overdue` ayrı ve elle seçilen lifecycle durumu değildir; vade tarihi ile kalan bakiyeden türeyen, kaynağı açılabilir Birleşik Bildirim Merkezi sinyalidir. İlk ticari modül ödeme tahsil etmez veya banka hareketini otomatik uzlaştırmaz.

### Ticari genişleme kabul bağlantısı

- **Bu belgedeki Proposal sözleşmeli adayı ilk ürün kabul manifestine girmez.** Kurucu tetikleyici oluşunca açık bir Ticari genişleme adayı başlattığında yalnız Proposal ilk dilimi [merkezi ticari kabulün Proposal koşullarıyla](16-product-acceptance.md#ticari-genisleme-kabulu) zorunlu olur. Invoice, ödeme ve birleşik sunum notları bu adayı genişletmez.

### Birleşik proje sunumu

- **Birleşik tarihli PDF sunumu bağlayıcı olmayan nottur.** Proposal PDF'i bu notun yerine geçmez ve onu taahhüt etmez.

- **Kullanıcı seçili proje özeti, Roadmap, Karar, Ekranın kesin Wireframe sürümü, teklif revision'ı ve ticari kapsamı tek tarihli PDF sunumunda birleştirebilir.** Her bölüm mevcut ana kayıt, onun kesin sürümü veya kesin ticari revision'dan açık seçimle gelir; çıktı yeni içerik doğruluk kaynağı oluşturmaz.

- **Önizleme hangi kayıtların, alanların ve exact snapshot/revision'ların gireceğini gösterir.** Çıktı üretim tarihini, kaynak kapsamını ve iptal edilemeyen statik dosya niteliğini görünür kılar. Özel kayıt, çözülemeyen ilişki ve alınamayan ekler sessizce atlanmaz; kullanıcıya çıktı oluşturulmadan önce açıklanır.

---
