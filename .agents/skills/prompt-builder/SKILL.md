---
name: prompt-builder
description: Açık `$prompt-builder` çağrısındaki veya UI seçimiyle verilen taslağı kapsamını büyütmeden kopyalanmaya hazır nihai prompta dönüştürür.
disable-model-invocation: true
---

# Prompt Builder

Kullanıcının taslağını hedef asistan için daha net ve uygulanabilir bir prompta
dönüştür. Niyeti, kapsamı ve taahhüt düzeyini koru. Bu turda yalnız prompt üret;
taslakta adı geçen downstream skill'leri ve işleri hedef asistana devret.

## 1. Çağrıyı ve Normalize Taslağı Belirle

- UI seçimini, kaynak veri dışında talimat olarak kullanılan tam `$prompt-builder`
  belirtecini veya anlamlı bir görev taslağına eşlik eden Prompt Builder Markdown
  bağlantısını çağrı say.
- Düz adı; tek başına bağlantı veya yolu; yapıştırılmış skill gövdesini; paketini
  inceleme ya da değiştirme konuşmasını; alıntı, log, fenced blok veya başka kaynak
  veri içindeki belirteci çağrı dışında tut. Başka skill referansları Prompt Builder
  çağrısı değildir.
- Çağrı işaretlerini çıkar. Ardından yalnız Prompt Builder'ın varsayılan dönüşümünü
  yeniden söyleyen genel dönüşüm talimatlarını semantik işlevleriyle ayıkla. Sabit
  kelime, fiil, dil, kip, konum veya söz dizimi listesi kullanma.
- Bir parçayı ancak çıkarıldıktan sonra anlamlı bir görev kalıyorsa ve parça şu
  **koruma boyutlarının** hiçbirinde kullanıcı farkı taşımıyorsa genel dönüşüm
  talimatı say: hedef/eylem, kaynak/açık rol, kapsam, taahhüt düzeyi, sıra,
  araç/sağlayıcı, referans, dil/ton/uzunluk/biçim ve çıktı.
- Belirli bir dosya, adlandırılmış prompt, çıktı veya downstream görev üzerinde
  gerçek eylem tanımlayan parçayı koru. Varsayılan dönüşümle kullanıcı farkı aynı
  parçada birleşmişse yalnız varsayılan kısmı çıkar.
- Kalan kullanıcı mesajının tamamını **normalize taslak** say. Tırnak, fenced blok,
  XML etiketi, baştaki bağlam veya sondaki kısıt taslak sınırını değiştirmez.
- Koruma boyutlarında bulunan bütün açık talimatların sessiz bir **koruma defterini**
  çıkar. Çağrı biçimini içerik, kapsam, vurgu veya iyileştirme yoğunluğu sayma;
  eşdeğer çağrı biçimleri aynı normalize taslak için aynı defteri üretmelidir.
- Normalize taslak boşsa yalnız `Dönüştürmemi istediğin taslağı paylaş.` yaz ve
  akışı bitir.

**Tamamlanma ölçütü:** Her çıkarılan parça çağrı işareti veya kullanıcı farkı
taşımayan genel dönüşüm talimatıdır; kalan mesaj tek normalize taslaktır ve koruma
defteri taslaktaki her dolu koruma boyutunu kapsar. Çağrı biçimi defteri
değiştirmemiştir; boş taslakta kanonik istek cümlesi teslim edilmiştir.

## 2. Referansları ve Skill Sözleşmelerini Yönlendir

**Referans yönlendirme:** Normalize taslak downstream skill; dosya, ek veya URL;
ya da log, alıntı, komut çıktısı, ekran görüntüsü metni veya yapıştırılmış içerik
barındırıyorsa [referans ve sözleşme yönlendirmesini](references/reference-routing.md)
tamamen oku ve uygula.

**Tamamlanma ölçütü:** Uygulanabilir her yönlendirme dalı değerlendirilmiş; her
downstream skill için pasif devir, sözleşme filtresi veya çatışma sonucu; her diğer
referans için açık rol ve kapsam; her kaynak veri için taşınacak görev sinyali
belirlenmiştir. Yalnız yönlendirme dosyasının izin verdiği sözleşme kaynakları
okunmuş ve hiçbir downstream iş çalıştırılmamıştır.

## 3. Hazır Kapısını Uygula

Anlamlı bir görev, hedef veya çıktı içeren taslakta nihai modu seç. Dosya adı,
bölüm başlığı, kaynak konumu veya hedef asistanın verilen kapsamdan bulabileceği
başka gerçekleri hedef asistana devret.

Yalnız şu durumlardan biri tek uygulanabilir promptu engelliyorsa karar modunu seç:

- birbirini dışlayan ana sonuçlar;
- aynı anda karşılanamayan açık zorunluluklar;
- kullanıcının downstream kullanım için seçtiği skill'in doğrulanmış zorunlu
  sözleşmesiyle gerçek çatışma.

Karar modunda:

- Tek karar ekseninde bir Türkçe soru sor.
- İki veya üç somut seçeneği sırayla `A.`, `B.` ve gerekirse `C.` olarak ver.
- `Önerim:` alanında listelenen bir seçeneği, `Gerekçe:` alanında kısa nedenini
  belirt.
- Yanıtı yalnız soru, seçenekler, öneri ve gerekçeden oluştur.
- Önceki turda cevaplanan kararı uygula; yalnız sıradaki engelleyici eksen varsa
  onu sor.

**Tamamlanma ölçütü:** Tek uygulanabilir prompt varsa nihai mod seçilmiştir;
engelleyici çatışma varsa yalnız bir karar eksenini kapsayan, 2-3 sıralı seçenekli
ve listeden seçilmiş gerekçeli önerili soru teslim edilerek akış bitirilmiştir.

## 4. Taslağı Kayıpsız İyileştir

- Koruma defterindeki her talimatı ve yönlendirme adımında kalan her kullanıcı
  farkını anlamsal olarak koru; yönlendirme sonucunu değiştirmeden uygula.
- Taslak zaten açık ve uygulanabilir ise yalnız anlatım, dilbilgisi, noktalama ve
  okunabilirliği düzelt. Kullanıcının vermediği rol, kapsam, doğrulama adımı,
  başarı ölçütü, çıktı biçimi veya workflow ayrıntısı ekleme.
- Yalnız dilbilgisel eksiklik hedef asistanın üreteceği sonucu belirsiz
  bırakıyorsa, yeni görev üretmeyen en küçük tamamlamayı yap.
- Downstream skill'lerin görevini ve aralarındaki sırayı koru; sözleşmelerini
  promptta yeniden anlatma. Kaynak rollerini ve dışlayıcı kapsamı yalnız koruma
  defterinde açıkça varsa yaz.
- İhtimali ihtimal, bağlamı bağlam ve gelecekteki olası işi sonraki ayrı adım
  olarak koru.
- Anlamlı paragraf, madde ve sıra yapısını koru; tekrarları birleştir. Tek görev
  doğal biçimde sığıyorsa tek cümleyi, kısa taslakta kısa promptu tercih et.
- Varsayılan olarak Türkçe yaz. Kullanıcı nihai prompt için açıkça başka bir dil
  isterse o dili kullan.
- Kopyalanabilir kod bloğundaki düzyazı satırlarını anlamlı boşluklardan en fazla
  95 karakterde böl. URL, Markdown bağlantısı, dosya yolu, inline code veya başka
  bölünemez uzun öğeyi ayrı satıra koy.

**Tamamlanma ölçütü:** Koruma defterindeki her talimat nihai promptta temsil
edilmiş ve yönlendirme sonucu değiştirilmeden uygulanmıştır. Eklenen her ifade
yalnız anlatım düzeltmesi veya zorunlu dilbilgisel tamamlamadır; prompt dili ve
tüm düzyazı satırları sözleşmeye uygundur.

## 5. Çıktıyı Teslim Et

Nihai modda yalnız şu biçimi kullan:

### Nihai Prompt

```text
[Kopyalanmaya hazır prompt]
```

Kod bloğundan önce veya sonra başka bölüm kullanma.

**Tamamlanma ölçütü:** Yanıt yalnız boş taslak cümlesi, karar modu bloğu veya
`### Nihai Prompt` başlığıyla tek ve dolu `text` kod bloğundan oluşur.
