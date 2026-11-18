# 9. grup lint etki önizlemesi

18 Kasım 2026. Ana çalışma ağacını değiştirmeyen geçici kopyada Biome **2.6.8**, Ultracite **8.2.1** ile çalıştırıldı. 8.3.0 aynı gün yayımlandığı için kullanıcı koşulu gereği seçilmedi. `ultracite init` çalıştırılmadı.

Komut: `biome check . --reporter=json --max-diagnostics=20000`. Sonuç **başarısız**: 7.362 hata, 4 uyarı; 1.244 dosya. Dependency bildirim tanıları hariç 1.081 dosya, bunların 522'si test dışı src dosyası. Bu bir izolasyon önizlemesidir; ana depoda uygulanmış kontrol sonucu değildir.

Yalnız kuralı yeniden adlandırmak ilk kontrolde config hatası verdi:

```text
Found an unknown key `functions`.
biome.base.json:51
```

Resmî yeni API'de bu seçenek kuralın altında değil, üst düzey `tailwind.mergeFunctions` ve `tailwind.variantFunctions` içindedir. Geçici kopyada clsx/cn ve cva bu alanlara taşındı; Fumadocs Biome schema URL'si kurulu sürüme hizalandı. Yeni stack/dependency seçilmedi.

## Tanı dağılımı

| Kural | Adet |
| --- | --- |
| lint/style/useConsistentTestIt | 3744 |
| lint/nursery/useTailwindSortedClasses | 1487 |
| lint/style/useUnicodeRegex | 872 |
| lint/correctness/noUndeclaredDependencies | 665 |
| lint/style/useNamedCaptureGroup | 242 |
| lint/suspicious/noConditionalExpect | 81 |
| lint/style/useImportsFirst | 68 |
| lint/style/useDomQuerySelector | 54 |
| lint/style/noExcessiveClassesPerFile | 48 |
| lint/suspicious/noUnnecessaryConditions | 28 |
| lint/correctness/usePlaywrightValidDescribeCallback | 14 |
| lint/correctness/noComponentHookFactories | 11 |
| lint/style/useThisInClassMethods | 9 |
| format | 6 |
| lint/suspicious/useBaseline | 6 |
| lint/suspicious/useExpect | 5 |
| suppressions/unused | 4 |
| lint/complexity/noUnnecessaryTemplateExpression | 3 |
| lint/suspicious/noExplicitAny | 3 |
| lint/complexity/useArraySome | 2 |
| lint/suspicious/noImportCycles | 2 |
| lint/performance/useDomNodeTextContent | 2 |
| lint/suspicious/noLoopFunc | 2 |
| lint/complexity/useMathMinMax | 2 |
| lint/a11y/noLabelWithoutControl | 2 |
| lint/suspicious/noDuplicateSelectors | 1 |
| lint/complexity/useWhile | 1 |
| lint/correctness/noPlaywrightMissingAwait | 1 |
| lint/suspicious/noJsxLeakedDollar | 1 |

## Kapsam sınırı

Bu yükseltme yalnız biçim farkı üretmiyor. test/it adları, regex bayrakları/adlandırılmış gruplar, import yerleri, DOM sorguları ve hook/component factory tanıları üretim kullanım kalıplarına da dokunuyor. Kullanıcının yaklaşık 10 dosya sınırı aşılmıştır. Ana depoda sürüm/config veya otomatik biçim değişikliği uygulanmadan karar istendi. Yeni kurallar kapatılmadı; mevcut test ve hook'lar bypass edilmedi.

Öneri: **9. grubu beklet**, kapsamı ayrı lint migration kararıyla belirle. Kullanıcı onayı olmadan otomatik fix veya binlerce dosyalık kullanım düzeltmesi yapılmayacak. Otomatik biçim değişikliği yapılırsa ayrı commit gerekliliği korunacak.

Kaynaklar: [Biome changelog](https://biomejs.dev/internals/changelog/), [yeni sınıf sırası kuralı](https://biomejs.dev/linter/rules/use-tailwind-sorted-classes/javascript/), [Ultracite upgrade rehberi](https://www.ultracite.ai/docs/upgrade), [8.2.1 npm metadata](https://registry.npmjs.org/ultracite/8.2.1). Ultracite paketindeki `skills/ultracite/references/upgrades/v8.md` de okundu; mevcut Biome preset yollarının taşınmasını gerektirmiyor. GitHub v8.2.1/8.2.1 release URL'leri 404 döndü.

## Ek inceleme — kullanıcının araştırma kararı sonrası

Kullanıcı geniş uyarlamayı **incelemeyi** seçti; bu, >10 dosyada uygulama veya dependency/config değişikliği onayı sayılmadı. Ana depoda paket, config ve uygulama kaynakları aynı kaldı. Resmî kural/preset araştırması [ayrı belgede](dependency-upgrade-lint-rules.md); aşağıdaki deneyler ana ajan tarafından fiziksel `/tmp` kopyalarında yapıldı. `ultracite init` hiçbir yerde çalıştırılmadı.

### Kontrollü ölçümler

| Deney | Sonuç | Açıklama |
| --- | --- | --- |
| Mevcut Biome 2.5.13 + Ultracite 7.12.0 | 0 hata, 0 uyarı; 2.431 dosya | Ana ağaçta salt `biome check`, JSON çıktı |
| Hedef 2.6.8 + 8.2.1 | 7.362 hata, 4 uyarı; 1.244 tanılı dosya | İlk tam önizleme |
| Biome 2.6.8 + taşınmış eski preset politikası | Özgün dosyalarda 1.606 hata, 5 uyarı; 444 tanılı dosya | Eski dört preset kopyalandı; yalnız kaldırılan sınıf kuralı/config API'si uyarlandı. Deneyin ürettiği preset dosyalarındaki iki format tanısı sayılmadı. Gerçek geçiş önerisi veya sıfır fark politikası garantisi değildir. |
| Yalnız `biome format --write` | 6 dosya değişti; 0 hata | Beş YAML workflow ve geçici biome.base.json; uygulama kaynağı değişmedi. |
| Ardından `biome check --write` — safe fix | 961 ek dosya değişti; 1.249 hata, 5 uyarı kaldı | Önceki altı formatter dosyasıyla toplam 967 farklı dosya; 456'sı test dışı src. Kalan tanılar 806 dosyada, 119'u test dışı src. |

Hedef engine yeni dosya türlerini de tarıyor; taranan toplam dosya sayısı eski sürümle aynı değil. JSON reporter deneysel uyarısı verdi. Formatter deneyi eski ve yeni kaynak kopyalarını hash ile karşılaştırdı; 967 sayısı toplam farklı dosyadır, formatter ve fix komutlarının sayaçları körlemesine toplanmadı.

Başarısız komut çıktıları:

```text
biome check . --reporter=json --max-diagnostics=20000
Some errors were emitted while running checks.
summary: errors=7362, warnings=4

biome check --write . --reporter=json --max-diagnostics=20000
Some errors were emitted while applying fixes.
summary: changed=961, errors=1249, warnings=5, suggestedFixesSkipped=63
```

Bütün write komutları yalnız geçici kopyadaydı. Bu kopyalarda tip/Vitest/e2e çalıştırılmadı; üretilen diff'in davranış uyumu doğrulanmış değildir. Ana depodaki 1–7 kabul kanıtı bu diff için kullanılamaz.

### Etkinin somut dağılımı

| Alan | Tanı / dosya | Karar etkisi |
| --- | --- | --- |
| Test/it adlandırması | 3.744 / 423 | Yeni Vitest preset tercihi; başarısız test anlamına gelmiyor. Import alias'ı ve binding gölgelenmesi kontrol edilmeli. |
| Tailwind sırası | 1.487 / 357 | Mevcut denetimin yeni sıralama algoritması. Kural resmî olarak unsafe; Ultracite safe override ediyor. `cn` conflict birleşimi ve görünüm doğrulanmalı. |
| Regex Unicode | 872 / 294 | Yeni preset politikası; safe fix sonrasında 17 tanı/14 dosya kalıyor. Bayrak eklemek salt format değil. |
| Capture grupları | 242 / 83 | Otomatik düzeltme yok; numaralı capture/backreference/replace/split tüketicileri okunmalı. |
| Vitest dependency sahipliği | 665 / 664 | Tamamı yalnız `vitest`; web 321, server 269, api 61, db 13, extension 1. Root devDependency mevcut. Beş workspace manifestine aynı sürümü bildirmek veya merkezî test aracı politikasını lint kapsamıyla ifade etmek ayrı karardır. |
| Koşullu assertion | 81 / 24 | Test başarısızlık yolunu değiştirebilir; assertion'ları körlemesine taşıma. |
| Import sırası | 68 / 44 | Side-effect import ve test mock hoist sırası incelenmeli; genel refactor yapılmamalı. |
| Hook/component factory | 11 / 10 | Üç açık yanlış pozitif, sekiz test-local Probe harness durumu; useState temizliği veya hoist yetkisi yok. |
| Playwright describe callback | 14 / 3 | Tamamı ürün helper'larındaki yanlış pozitif. Ürün fonksiyonlarını yeniden adlandırma yerine framework kuralının kapsamı incelenmeli. |

### Uygulama seçenekleri ve öneri

- **Önerilen:** 9. grubu bu sürüm turunda beklet; ayrı lint migration kapsamı onaylandıktan sonra ilerle. Sadece altı formatter dosyasını düzeltmek hedef sürümlerde `check` başarısı sağlamıyor.
- **Mevcut lint politikasını koruyarak yükseltme:** Yeni tercih kuralları için açık policy override'ları ve framework dosya kapsamları gerekir. Yeni Biome ile eski policy deneyi bile 444 dosyayı etkiliyor; bu seçenek de yaklaşık 10 dosya sınırını aşar. Kuralları sessizce kapatma veya hook'u bypass etme önerilmiyor; politika kararı önce onaylanmalı.
- **Hedef preset'i bütünüyle benimseme:** 967 dosyalık otomatik aday diff'e ek olarak 1.249 kalan hatanın ele alınması gerekir. Bu, kütüphane kullanım kalıpları ve test harness tasarımına uzandığı için “yalnız sürüm yükseltmesi” kapsamına sığmıyor. Ayrı iş ve açık kapsam onayı gerekir.

Onaylı uygulama olursa sıra: önce yanlış pozitif/framework kapsamı ve Vitest manifest sahipliği kararı; sonra yalnız otomatik biçim değişiklikleri ayrı commit; ardından test adlandırması/sınıf sırası, regex ve davranışa duyarlı test uyarlamaları incelenebilir commit'lerde. Her etkilenen paketin Vitest'i, check-types ve check; görünümü etkileyen Tailwind değişikliklerinde ilgili e2e gerekir. Assertion, test/hook veya güvenlik sınırı atlanmayacak.

Kanıt dosyaları: `/tmp/cantiara-group9-baseline-real.json`, `cantiara-group9-preset-diff.json`, `cantiara-group9-old-policy.json`, `cantiara-group9-format-only.json`, `cantiara-group9-safe-fix.json`, `cantiara-group9-safe-fix-files.json`. Bunlar geçici araştırma verileridir; repository'ye otomatik kaynak diff'i alınmadı.
