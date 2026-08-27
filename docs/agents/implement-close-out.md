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

Tarayıcıda adım adım doğrulama — komut, terminal veya otomatik test çıktısı yok:

- Hangi URL'ye git
- Hangi tıklamalar / girişler / akış
- Her adımda ne görmeli

Değişiklik tarayıcıda test edilemiyorsa, bunu tek cümleyle söyle — komut önerme.

**Done when** okuyucu tarayıcıda tek başına doğrulayabilir veya neden edemeyeceğini anlar.

## Voice

- Anlaşılır, günlük Türkçe — kısa cümleler; jargon, iç şaka ve gereksiz teknik terim yok.
- English UI labels from the owning spec stay English in backticks.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
