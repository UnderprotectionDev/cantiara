# Implement close-out

Final user message after `/implement` — Turkish, three sections in order.

## When

Run after work is committed, `/code-review` has finished, and tests have run.

## 1. Ne eklendi

Spec veya ticket'tan ne çıktı — `/implement`'in yaptığı işin özeti:

- Teslim edilen davranış veya yetenek (ürün değişikliği) ya da süreç/kural değişikliği (agent doc, skill)
- Dokunan ana dosya, route, API veya şema — yönlendirme için yeterli, ham diff değil
- Kapsam dışı: bilinçli olarak yapılmayan

**Done when** okuyucu diff açmadan “ne teslim edildi?” sorusunu yanıtlayabilir.

## 2. İnceleme

`/implement` içindeki `/code-review` çıktısını taşı — yeniden sıralama yok:

- `## Standards` ve `## Spec` başlıkları aynen kalır; bulgular Türkçe özetlenebilir
- `/code-review`'ın tek satırlık özetiyle bitir (eksen başına bulgu sayısı, varsa en kötü bulgu)

Spec yoksa Spec altında belirt. Review atlandıysa nedenini yaz — uydurma.

**Done when** her iki eksen raporlandı veya atlama gerekçesiyle açıklandı.

## 3. Nasıl test edilir

Bu bölüm, değişikliği tarayıcıda elle yeniden üretme kılavuzudur. Diff'i görmemiş biri başlangıç ekranını bulabilmeli, her kontrolü nerede kullanacağını anlayabilmeli ve eylemden sonra sonucu ilgili ekranda doğrulayabilmelidir. Komut, terminal veya otomatik test çıktısı yazılmaz.

**Başlangıç** (bir kez, üstte): uygulamanın tarayıcı adresi ve ilk route'u; giriş durumu; gerekli kayıt yoksa onu ekranda oluşturma yolu veya test ortamında gerçekten önceden yüklenmiş fixture'ın ekranda görünen adı. Fixture yalnızca test ortamının onu önceden yüklediği ve okuyucunun görünür kayıtla doğrulayabildiği biliniyorsa yeterlidir; aksi halde fixture adını yazmak yerine kaydı tarayıcıda hazırlama yolunu `Veri hazırlığı` altında aynı dört parçalı numaralı adımlarla yaz. Yalnız route biliniyorsa tam URL uydurma; route'u ve oraya giden UI gezinmesini yaz.

**Her numaralı adım tek bir kullanıcı eylemi taşır** (birden fazla tıklama/seçim aynı adıma sıkıştırılmaz) ve aşağıdaki dört parçayı açıkça yazar (eksik parça = adım bitmemiş):

1. **Nerede** — route path (`/projects`, `/account`, …), tam başlangıç adresi veya bir önceki adımdan kalan ekran.
2. **Bölge** — yalnız: workspace listesi; proje navigasyonu (`Overview` / `Work` / `Documents` / `All Tools` / pin’li alan); sayfa başlığı; sayfa gövdesi; kayıt gövdesi; diyalog; kişisel kabuk (`Daily Focus` / `Favorites`); gerektiğinde tarayıcı araç çubuğu veya adres çubuğu.
3. **Etiket** — tıklanan/yazılan uygulama kontrolü veya açıkça adlandırılmış tarayıcı eylemi; owning spec’teki English UI, backtick; eylemi de açıkça yaz (`tıklayın`, `yazın`, `seçin`, `açın`, `yenileyin`).
4. **Beklenen** — eylemden hemen sonra görülen metin, durum, boş veya hata; sonucu hangi ekranda göreceğini de belirt.

Her adımı şu biçimde yaz: `Nerede: <route veya ekran> · Bölge: <ekran bölgesi> · Etiket: <kontrol> + <eylem> · Beklenen: <sonuç>`; gerçek English UI etiketlerini ayrıca backtick içine al.

Kalıcı bir yazma akışı varsa sonucu yenileyerek, tekrar açarak veya ilgili listeye dönerek kalıcılığı ayrı bir adımda doğrula. Yalnızca geçici seçim, önizleme veya diyalog açılması kalıcı yazma yapmıyorsa yenileme adımı ekleme. “Önemli yol”, owning spec’teki kabul koşulu veya Testing Decisions karşıtı olan, bu değişikliğin etkilediği kullanıcıya görünen dallanmadır; yalnız bu yolları listele ve varsa başarı, iptal, doğrulama/hata, geri alma ve her tür/variant yolunu ayrı yaz. Böyle bir karşıt yol yoksa bunu `Karşıt yol: Yok.` diye belirt. İç durum adlarını veya “adaptör bağlı ortam” gibi hazırlaması açıklanmamış ifadeleri tek başına kullanma.

Örnek (yalnızca `Appearance` dilimini gösterir; `Preferences` etiketleri `docs/specs/02-account-preferences/spec.md`, `Sessions` etiketi `docs/specs/01-account-access/spec.md` içindeki owning spec sözlüklerinden alınmıştır):

Başlangıç: Uygulama tarayıcıda açık; giriş yapılmış; `/account/preferences` ekranı için önceden yüklenmiş fixture gerekmez.

1. Nerede: `/account/preferences` · Bölge: tarayıcı adres çubuğu · Etiket: `/account/preferences` adresini açın · Beklenen: Sayfa başlığında `Preferences` görünür.
2. Nerede: `Preferences` ekranı · Bölge: sayfa gövdesi · Etiket: `Appearance` kontrolünü açın · Beklenen: Yalnızca `Light` ve `Dark` seçenekleri görünür; `System` görünmez.
3. Nerede: `Preferences` ekranı · Bölge: sayfa gövdesi · Etiket: `Light` seçeneğini seçin · Beklenen: `Appearance` kontrolü `Light` değerini gösterir.
4. Nerede: `Preferences` ekranı · Bölge: sayfa gövdesi · Etiket: `Save` düğmesine tıklayın · Beklenen: `Appearance` değeri `Light` olarak kaydedilir ve sayfada görünür.
5. Nerede: `Preferences` ekranı · Bölge: tarayıcı araç çubuğu · Etiket: Sayfayı yenileyin · Beklenen: `Preferences` ekranı yeniden açılır ve `Appearance` değeri `Light` olarak kalır.
6. Nerede: `Preferences` ekranı · Bölge: sayfa gövdesi · Etiket: `Appearance` kontrolünü açın · Beklenen: `Light` ve `Dark` seçenekleri yeniden görünür.
7. Nerede: `Preferences` ekranı · Bölge: sayfa gövdesi · Etiket: `Dark` seçeneğini seçin · Beklenen: `Appearance` kontrolü `Dark` değerini gösterir.
8. Nerede: `Preferences` ekranı · Bölge: sayfa gövdesi · Etiket: `Save` düğmesine tıklayın · Beklenen: `Appearance` değeri `Dark` olarak kaydedilir ve sayfada görünür.
9. Nerede: `Preferences` ekranı · Bölge: tarayıcı araç çubuğu · Etiket: Sayfayı yenileyin · Beklenen: `Preferences` ekranı yeniden açılır ve `Appearance` değeri `Dark` olarak kalır.
10. Nerede: `Preferences` ekranı · Bölge: sayfa gövdesi · Etiket: `Light` seçeneğini seçin · Beklenen: `Appearance` kontrolü `Light` değerini gösterir; henüz kayıt yapılmaz.
11. Nerede: `Preferences` ekranı · Bölge: tarayıcı adres çubuğu · Etiket: `/account` adresini açın · Beklenen: `Sessions` ekranı görünür ve `Preferences` formu artık görünmez; kaydedilmemiş `Light` seçimi bu ekrana taşınmaz.
12. Nerede: `Sessions` ekranı · Bölge: tarayıcı adres çubuğu · Etiket: `/account/preferences` adresini açın · Beklenen: `Preferences` ekranı açılır ve `Appearance` değeri kaydedilmiş `Dark` olarak kalır.

Örnek kapsamı: `System` seçeneğinin görünmemesi 2. adımda, kaydetmeden ayrılınca `Light` seçiminin korunmaması 10–12. adımlarda doğrulanır. Bu örnek tam kabul listesi değildir; gerçek değişiklik `Save` hata/çevrimdışı yolunu etkiliyorsa `Disconnected`, `Reconnect to save.` ve `Unsaved risk` sonucunu ayrı dört parçalı adımlarla ekle. Örnekte yer almaması, ilgili bir hata yolunu atlamak için gerekçe değildir.

Değişiklik tarayıcıda yoksa, final metni Türkçe olsa da repo sözleşmesinin istediği tek cümle olarak yalnızca `Not applicable` yaz.

**Done when** Başlangıç bölümü uygulamayı ve veriyi hazırlamayı açıklıyor, tarayıcıdaki veri hazırlığı da gerekiyorsa aynı formata uyuyor, her adım `Nerede · Bölge · Etiket · Beklenen` parçalarını açıkça taşıyor, her adım tek eylem içeriyor, ilgili kalıcı yazmaların kalıcılığı/önemli karşıt yolları gösteriliyor ve karşıt yol yokluğu açıkça belirtiliyor — veya tarayıcıda yoksa yalnızca `Not applicable` kullanılıyor.

## Voice

- Anlaşılır, günlük Türkçe — kısa cümleler; jargon, iç şaka ve gereksiz teknik terim yok.
- English UI labels from the owning spec stay English in backticks.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
