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
