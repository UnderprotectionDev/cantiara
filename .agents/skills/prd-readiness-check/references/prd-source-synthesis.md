# PRD Source Synthesis

Bu dosya, `prd-readiness-check` kalite modelinin araştırma dayanağını ve kaynaklar arasındaki tercihleri bakım çalışmaları için kaydeder. Runtime PRD kontrolünde kaynak özeti olarak raporlanmaz.

## İçindekiler

1. [İncelenen kaynak grupları](#incelenen-kaynak-grupları)
2. [Kaynaklarda tekrar eden ortak ilkeler](#kaynaklarda-tekrar-eden-ortak-ilkeler)
3. [Kaynağa özgü yararlı öneriler](#kaynağa-özgü-yararlı-öneriler)
4. [Kaynaklar arasındaki gerilimler](#kaynaklar-arasındaki-gerilimler)
5. [Araştırmadan türetilen sentez kararları](#araştırmadan-türetilen-sentez-kararları)
6. [Rubrik eşleştirmesi](#rubrik-eşleştirmesi)

## İncelenen kaynak grupları

### Kullanıcı tarafından sağlanan practitioner kaynakları

- Infrasity ve Codelevate: B2B SaaS problem, çözüm, scope, onboarding ve metrik örnekleri.
- Atlassian ve Aha!: çevik, yaşayan, bağlantılı ve yeterli-bağlam odaklı PRD yaklaşımı.
- Jama Software ve Perforce: gereksinim kalitesi, release criteria, traceability, supportability ve yaşayan doküman yönetimi.
- Product School, Meegle, CPO Club, UXness, Appt.dev ve ESC Velocity: persona, tasarım, metrik, rollout, sahiplik, event instrumentation ve açık sorular.
- Carlin Yuen: problem/çözüm ayrımı, yaşam döngüsü kapsamı, kanıtsız performans hedeflerinden ve aşırı teknik tariften kaçınma.
- cpjet64/vibecoding: agent destekli PRD'lerde edge case, NFR, analytics, release ve kapsamlı şablon önerileri.

Bu kaynaklar alan pratiğini geniş kapsar; ancak bazıları ürün veya danışmanlık içeriğidir ve önerileri evrensel standart olarak alınmamıştır.

### Ek resmi kaynaklar

- [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html): requirements engineering süreçleri, iyi gereksinim yapısı, özellikleri ve bilgi öğeleri için güncel standart çerçevesi.
- [NASA Systems Engineering Handbook — Requirements Validation Checklist](https://www.nasa.gov/reference/system-engineering-handbook-appendix/): açıklık, tek anlamlılık, tutarlılık, gereklilik, uygulanabilirlik, doğrulanabilirlik ve traceability kontrolleri.
- [NASA Software Requirements Analysis](https://swehb.nasa.gov/spaces/SWEHBVC/pages/100598308/Software%2BRequirements%2BAnalysis): gereksinimlerin bireysel ve toplu olarak clear, complete, consistent, feasible, implementation-independent, necessary, singular, traceable, accurate, unambiguous ve verifiable olmasına ilişkin resmi uygulama rehberi.

Resmi kaynaklar sistem/software requirement düzeyindedir. `prd-readiness-check`, bunların biçim kurallarını PRD'ye aynen dayatmaz; karar belirsizliğini azaltan kalite özelliklerini bağlama uyarlar.

## Kaynaklarda tekrar eden ortak ilkeler

Aşağıdakiler çok sayıda kullanıcı kaynağında doğrudan tekrar eder:

1. PRD ortak anlayış ve devir dokümanıdır: ne, neden, kim için ve hangi sınırlarla sorularını cevaplar.
2. Problem çözümden önce gelir; özellik yokluğu tek başına kullanıcı problemi değildir.
3. Hedef kullanıcı ve rol ayrımları davranışa, önceliğe veya izne etkileri kadar detaylandırılır.
4. Kullanıcı hikâyeleri format değil davranış ve sonuç taşımalıdır.
5. Current scope ve negatif kapsam, scope creep'i ve yanlış beklentiyi keser.
6. Kabul kriterleri veya eşdeğer davranış tanımları işin bittiğini doğrulanabilir kılar.
7. Varsayımlar, bağımlılıklar, riskler ve açık sorular görünür olmalıdır.
8. PRD çok az detayla varsayım üretmemeli, çok fazla detayla ana kararları gömmemelidir.
9. Çözüm/teknoloji tarifi kullanıcı ihtiyacının ve ürün davranışının yerini almamalıdır.
10. PRD yaşayan ve iş birlikçi bir karar kaynağıdır; kritik değişikliklerin görünür kalması önemlidir.
11. Tasarım ve kullanıcı akışları, etkileşim kararını netleştirdikleri ölçüde değerlidir.
12. Metrikler, ürün iddiasını veya rollout kararını doğrulamaya bağlandığında anlamlıdır.
13. Release, rollback ve supportability yüksek riskli değişikliklerde önem kazanır.
14. Gereksinimlerin problemden davranışa ve doğrulamaya izlenebilmesi yeniden işi azaltır.

## Kaynağa özgü yararlı öneriler

Bu öneriler anlamlıdır fakat her PRD'ye koşulsuz uygulanmaz:

- **Jama/NASA**: requirement-level açıklık, tek anlamlılık, gereklilik, feasibility ve verification kontrolleri; özellikle regüle veya karmaşık sözleşmelerde güçlüdür.
- **Jama**: TBD/TBR, glossary ve bidirectional traceability; enterprise/regüle bağlamda değerlidir.
- **Perforce/Jama**: release readiness'i functionality, usability, reliability, performance ve supportability ile değerlendirmek; yalnız release riski varsa tetiklenir.
- **ESC Velocity/CPO Club**: event instrumentation ve rollout aşamaları; yalnız ölçülebilir iddia, deney veya riskli rollout varsa gerekir.
- **Atlassian**: birincil PRD'yi bağlantılı ayrıntılar için merkezi giriş noktası yapmak; inceleme paketi modelini destekler.
- **Carlin Yuen**: nesne/kullanıcı yaşam döngüsünü create/use/update/archive/delete/leave boyunca düşünmek; yalnız ürün davranışını değiştiriyorsa uygulanır.
- **UXness/Meegle**: wireframe ve akış diyagramları; metin etkileşimi yeterince açıklamıyorsa gerekir.
- **CPO Club/Product School**: owner, sign-off ve change history; çok paydaşlı, müşteri taahhütlü veya yaşayan belgede gerekir.
- **B2B SaaS rehberleri**: onboarding, GTM ve adoption metrikleri; ürün veya release kapsamına bağlıdır, dar feature PRD için evrensel değildir.
- **Vibecoding rehberi**: ayrıntılı NFR, stack ve release şablonu; ilgili tetikleyici yoksa checklist şişkinliği yaratabilir.

## Kaynaklar arasındaki gerilimler

| Gerilim | Kaynaklardaki yaklaşımlar | `prd-readiness-check` tercihi |
| --- | --- | --- |
| Tek belge vs bağlantılı merkez | Bazıları tüm bilgiyi PRD'de ister; Atlassian bağlantılı ana sayfayı savunur | Birincil belge + açıkça bağlı ve sunulmuş karar kaynaklarından oluşan inceleme paketi |
| Her PRD'de metrik | Birçok şablon sayısal KPI ister; Carlin Yuen kanıtsız hedeflere karşı uyarır | Davranış doğrulaması her zaman; sayısal ölçüm yalnız belge iddia/deney/guardrail koyarsa |
| Her PRD'de tasarım | Bazı kaynaklar tasarım olmadan PRD'yi eksik sayar; çevik kaynaklar yeterli bağlamı savunur | Etkileşim kararı metinle veya görselle temsil edilebilir; görsel biçim zorunlu değil |
| Teknik ayrıntı | SaaS rehberleri stack/schema ister; Jama/NASA implementation-independent requirement'ı destekler | Ürün davranışını etkileyen teknik sınırlar zorunlu; geri döndürülebilir engineering seçimi serbest |
| Her PRD'de timeline/rollout/GTM | Şablon kaynaklarında yaygın; çevik kaynaklarda tailoring var | Yalnız taahhüt, operasyon veya risk tetiklerse |
| Ayrıntılı persona | Bazı kaynaklar demografi ve biyografi ister; diğerleri kısa rol/hedef önerir | Yalnız karar verdiren rol, hedef ve bağlam |
| Formal approval | Bazı kaynaklar sign-off ister; Atlassian aşırı upfront approval'ı anti-pattern sayar | Çok paydaşlı/bağlayıcı bağlamda koşullu; skill kendisi resmî onay vermez |
| Her gereksinimi atomik yazma | Formal requirement kaynaklarında güçlü; PRD'ler anlatı ve karar bölümleri taşıyabilir | Atomiklik yalnız çelişki veya doğrulama belirsizliğini azalttığında uygulanır |

## Araştırmadan türetilen sentez kararları

Aşağıdakiler tek bir kaynaktan alınmış kurallar değil, implementation karar belirsizliğini azaltma hedefinden türetilmiş sentezdir:

1. **Karar borcu eşiği**: Bir eksik implementer'a önemli ürün kararı aldırmıyorsa gate düşürmez.
2. **Uyarlanabilir alan modeli**: Sabit alan sayısı yoktur; temel karar zinciri her belgede, risk alanları tetiklenince değerlendirilir.
3. **İnceleme paketi**: Bağlı kaynak kritik kararı tamamlayabilir; açık referansı olmayan ek belge tamamlayamaz.
4. **Risk odaklı gate**: `Bloke` güvenli başlangıcın mümkün olmadığı yüksek etkili durumlar; `Çalışma Gerekli` önemli fakat yerel boşluklar içindir.
5. **Açık riskli karara saygı**: Belge açık ve tutarlı bir riskli ürün kararı verirse reviewer kararı değiştirmez; risk non-blocking görünür olabilir.
6. **Kök bulgu birleştirme**: Bir permission sözleşmesindeki ilişkili boşluklar tek bulgudur; bağımsız ciddi sorunlar saklanmaz.
7. **Cevap uydurmayan aksiyon**: Örnek PRD cümlesi yerine karar verilmesi gereken konu raporlanır.
8. **Doküman-only değerlendirme**: Kaynak kod ve bağımsız web araştırması kullanılmaz; rapor gizli bağlama dayanmaz.
9. **Dinamik genişleme**: Billing/entitlement, backward compatibility, accessibility/localization ve supportability gibi alanlar mevcut 12 alanın ötesinde bağlama göre eklenebilir.
10. **Ayrık eval yüzeyleri**: Offline checker statik declaration, fixture şeması ve çıktı yapısını deterministik doğrular; karar ve invocation davranışı ayrı fresh-agent senaryolarıyla değerlendirilir.

## Rubrik eşleştirmesi

| Karar ihtiyacı | Temel/koşullu alan |
| --- | --- |
| Neden, kim, amaçlanan sonuç | Temel: Problem, hedef kullanıcı ve sonuç |
| Current/future/out-of-scope | Temel: Scope ve sınırlar |
| Ana akış, lifecycle, error state | Temel: Davranışlar |
| Ürün kararı vs engineering seçimi | Temel: Karar devri |
| Acceptance ve davranış kanıtı | Temel: Tamamlanma ve doğrulama |
| Veri/ownership/privacy | Koşullu: Veri |
| Auth/role/tenant | Koşullu: İzin ve izolasyon |
| API/provider/notification/payment | Koşullu: Entegrasyon ve yan etki |
| Existing data/import/version | Koşullu: Migration ve compatibility |
| Delete/publish/irreversible change | Koşullu: Recovery ve kritik aksiyon |
| AI suggestion/write/execute | Koşullu: AI ve otomasyon |
| Flow/state/accessibility/locale | Koşullu: Etkileşim |
| Performance/reliability/offline | Koşullu: Kalite özellikleri |
| Riskli release/support burden | Koşullu: Rollout ve operasyon |
| Experiment/metric/guardrail | Koşullu: Analitik |
| Regulation/audit/customer control | Koşullu: Compliance ve traceability |
| Multi-team/open decisions | Koşullu: Sahiplik ve karar takibi |
| Plans/limits/payment lifecycle | Koşullu: Ticari kurallar ve entitlement |
