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

Bu bölüm, değişikliği tarayıcıda elle deneyen kişiye doğrudan yol gösterir. Diff'i görmemiş biri hangi sayfayı açacağını, hangi işlemi yapacağını ve işlemin sonucunu anlayabilmelidir. Metin kısa bir kullanıcı kılavuzu gibi yazılır; komut, terminal çıktısı veya otomatik test raporu içermez.

### Başlangıç

İlk paragrafta uygulamanın başlangıç adresini veya route'unu, giriş durumunu ve kullanılacak kaydı yaz. Kayıt hazır değilse ana akıştan önce `Veri hazırlığı` başlığı aç ve kaydı tarayıcıda oluşturmayı aynı konuşma diliyle numaralı adımlara böl. Bu adımlarda görünen giriş alanını, yazılacak değeri, kullanılacak düğmeyi ve her işlemden sonra beklenen sonucu cümle içinde belirt. Test ortamında veri önceden yüklenmişse yalnızca kullanıcının görebildiği kayıt adını yaz; test altyapısı terimlerini kullanıcıya dönük metne taşıma. Elinde yalnızca route varsa tam alan adı uydurma; route'u ve o ekrana uygulama içinden nasıl gidileceğini yaz.

### Ana akış

Her numaralı adım tek bir kullanıcı eylemi içersin. Kullanıcıya hangi ekranda olduğunu, hangi gerçek kontrolü kullanacağını ve hemen ardından ne görmesi gerektiğini bir veya iki kısa cümleyle anlat. Örneğin: “`Preferences` sayfasında `Appearance` alanını açın. `Light` ve `Dark` seçenekleri görünür.”

Gerçek English UI etiketlerini owning spec'teki biçimiyle backtick içine al. Spec'te etiket tanımlı değilse üründe gerçekten görünen etiketi kullan; yeni bir etiket uydurma. Adımları iç kontrol alanlarıyla değil, doğrudan konuşma cümleleriyle yaz.

### Kalıcılık ve diğer yollar

Bir işlem kalıcı veri yazıyorsa, sonucu sayfayı yenileyerek, kaydı yeniden açarak veya ilgili listeye dönerek ayrı bir adımda doğrula. Yalnızca geçici seçim, önizleme veya diyalog açılıyorsa yenileme adımı ekleme.

Değişiklik başka bir seçimi, iptali, doğrulama/hata durumunu, geri almayı veya kayıt türünü etkiliyorsa, o yolu ayrı bir başlık ve kısa adımlarla anlat. İlgili bir yol yoksa bunu doğal bir cümleyle belirt; örneğin `Bu değişiklikte iptal, hata veya geri alma akışı yok.` İç durum adlarını veya hazırlaması açıklanmamış ifadeleri tek başına kullanma.

Örnek (etiketler `docs/specs/02-account-preferences/spec.md` içindeki sözlükten alınmıştır):

Başlangıç: Uygulama açık ve kullanıcı giriş yapmış. `/account/preferences` sayfası için ek veri hazırlığı gerekmiyor.

1. `/account/preferences` sayfasını açın. `Preferences` başlığı görünür.
2. `Preferences` sayfasında `Appearance` alanını açın. `Light` ve `Dark` seçenekleri görünür; `System` görünmez.
3. `Dark` seçeneğini seçin. `Appearance` alanında `Dark` görünür.
4. `Save` düğmesine tıklayın. `Appearance` değeri `Dark` olarak kaydedilir.
5. Sayfayı yenileyin. `Preferences` sayfası yeniden açılır ve `Appearance` değeri `Dark` olarak kalır.

Bu örnekte kullanıcı her adımda nereye gideceğini, ne yapacağını ve ne göreceğini doğrudan anlar. Gerçek değişiklik bir hata veya iptal akışını etkiliyorsa, örnekteki başarı akışının yanına yalnızca o ilgili akışı ekle.

Tarayıcıda görünen bir davranış yoksa bu bölümün tamamına yalnızca `Not applicable` yaz.

**Done when** Başlangıç bölümü uygulamayı ve veriyi hazırlamayı açıklıyor; kayıt önceden hazır değilse `Veri hazırlığı` altında oluşturma adımları yer alıyor. Her adım tek eylem ve bir veya iki kısa cümleyle ekranı, gerçek kontrolü ve beklenen sonucu anlatıyor. İlgili kalıcı yazmalar ile değişiklikten etkilenen diğer kullanıcı yolları ayrı ayrı doğrulanıyor; ilgili başka yol yoksa bu durum doğal bir cümleyle belirtiliyor — veya tarayıcı davranışı yoksa yalnızca `Not applicable` kullanılıyor.

## Voice

- Anlaşılır, günlük Türkçe — kısa cümleler; jargon, iç şaka ve gereksiz teknik terim yok.
- English UI labels from the owning spec stay English in backticks.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
