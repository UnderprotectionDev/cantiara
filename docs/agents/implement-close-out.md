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

Konumlu tarayıcı adımları — komut, terminal veya otomatik test çıktısı yok.

**Önkoşul** (bir kez, üstte): giriş durumu; seed kaydı gerekiyorsa ekranda görünen ad ([dev seed](dev-database-seed.md)).

**Her numaralı adım dört parçayı taşır** (eksik parça = adım bitmemiş):

1. **Nerede** — route path (`/projects`, `/account`, …) veya bir önceki adımdan kalan ekran
2. **Krom** — workspace listesi; proje navigasyonu (`Overview` / `Work` / `Documents` / `All Tools` / pin’li alan); sayfa başlığı; kayıt gövdesi; diyalog; kişisel kabuk (`Daily Focus` / `Favorites` / …)
3. **Etiket** — tıklanan veya yazılan kontrol; owning spec’teki English UI, backtick
4. **Beklenen** — aynı ekranda ne görünür (metin, durum, boş veya hata)

Örnek:

Önkoşul: GitHub ile giriş; seed projesi `Cantiara`.

1. `/projects` — workspace listesinde `Cantiara` aç. Proje `Overview` görünür.
2. Proje navigasyonunda `Work` aç. `Backlog` görünür.
3. Kayıt gövdesinde `Checkout flow` satırını aç. İş detayı açılır; başlık `Checkout flow` durur.

Değişiklik tarayıcıda yoksa (skill, kural, yalnız şema): tek cümle.

**Done when** her adımda Nerede, Krom, Etiket ve Beklenen durur; diff’i görmemiş biri kontrolün ekranda nerede olduğunu sormadan izleyebilir — veya tarayıcıda yoksa bunu tek cümleden anlar.

## Voice

- Anlaşılır, günlük Türkçe — kısa cümleler; jargon, iç şaka ve gereksiz teknik terim yok.
- English UI labels from the owning spec stay English in backticks.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
