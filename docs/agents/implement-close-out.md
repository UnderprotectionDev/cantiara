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

**Başlangıç** (bir kez, üstte): uygulamanın tarayıcı adresi ve ilk route'u; giriş durumu; gerekli kayıt hazırsa kullanıcıya görünen adı, hazır değilse tarayıcıda nasıl oluşturulacağı. Test altyapısına ait `fixture` gibi terimleri kullanıcıya dönük adımlarda tek başına kullanma. Yalnız route biliniyorsa tam URL uydurma; route'u ve oraya giden UI gezinmesini yaz.

**Adımları normal konuşma diliyle yaz.** Her numaralı adım tek bir kullanıcı eylemi taşısın; ekranı, tıklanacak veya yazılacak gerçek kontrolü ve hemen ardından görülmesi gereken sonucu aynı akıcı cümleye yerleştir. Gerçek English UI etiketlerini backtick içine al. Okuyucuya iç kontrol şablonunu göstermeden `Nerede`, `Bölge`, `Etiket` ve `Beklenen` bilgilerinin tamamını cümle içinde ver.

Kalıcı bir yazma akışı varsa sonucu yenileyerek, tekrar açarak veya ilgili listeye dönerek kalıcılığı ayrı bir adımda doğrula. Yalnızca geçici seçim, önizleme veya diyalog açılması kalıcı yazma yapmıyorsa yenileme adımı ekleme. “Önemli yol”, owning spec’teki kabul koşulu veya Testing Decisions karşıtı olan, bu değişikliğin etkilediği kullanıcıya görünen dallanmadır; yalnız bu yolları listele ve varsa başarı, iptal, doğrulama/hata, geri alma ve her tür/variant yolunu ayrı yaz. Böyle bir yol yoksa bunu doğal bir cümleyle söyle; örneğin `Bu değişiklikte iptal veya hata akışı yok.` İç durum adlarını veya “adaptör bağlı ortam” gibi hazırlaması açıklanmamış ifadeleri tek başına kullanma.

Örnek:

Başlangıç: Uygulama açık, kullanıcı giriş yapmış ve `/capture` ekranındasın. Listede `Toplantı notları` adlı görünür bir kayıt hazır; yoksa önce Capture alanından bu kaydı oluştur.

1. `/capture` ekranında `Toplantı notları` kaydına tıklayın. Kayıt gövdesi açılır.
2. Kayıt gövdesinde `Convert` düğmesine tıklayın. `Work`, `Document` ve `File Attachment` seçenekleri görünür.
3. Açılan seçeneklerden `Document` seçeneğine tıklayın. `Conversion Preview` ekranı açılır.
4. Önizlemede `Confirm` düğmesine tıklayın. Kayıt `Document` olarak dönüştürülür ve yeni tür kayıt gövdesinde görünür.
5. Sayfayı tarayıcıdan yenileyin. Kayıt yeniden açılır ve `Document` türü korunur.

Bu örnekte route, ekran ve kontrol adları cümlenin içinde; beklenen sonuç ise eylemden hemen sonra geliyor. Değişiklik iptal, hata, geri alma veya başka bir türü etkiliyorsa, o akışları da aynı sadelikte ayrı numaralı adımlar olarak ekle. Örneğin ilgili akışta gerçekten görünen `Cancel`, `Undo` veya hata metnini kullan; üründe görünmeyen bir etiket uydurma.

Değişiklik tarayıcıda yoksa, final metni Türkçe olsa da repo sözleşmesinin istediği tek cümle olarak yalnızca `Not applicable` yaz.

**Done when** Başlangıç bölümü uygulamayı ve veriyi hazırlamayı açıklıyor, tarayıcıdaki veri hazırlığı da gerekiyorsa aynı konuşma diliyle yazılıyor, her adım tek eylem içeriyor ve ekranı, gerçek kontrolü ve beklenen sonucu akıcı biçimde anlatıyor; ilgili kalıcı yazmaların kalıcılığı ile önemli karşıt yollar gösteriliyor — veya tarayıcıda yoksa yalnızca `Not applicable` kullanılıyor.

## Voice

- Anlaşılır, günlük Türkçe — kısa cümleler; jargon, iç şaka ve gereksiz teknik terim yok.
- English UI labels from the owning spec stay English in backticks.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
