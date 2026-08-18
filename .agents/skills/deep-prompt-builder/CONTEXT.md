# Deep Prompt Builder Geliştirme Bağlamı

Bu belge yalnız paket bakımı içindir; runtime sözleşmesi değildir ve skill çalışırken
okunması gerekmez. Runtime davranışını [ana skill](SKILL.md) ile yalnız ana skill'deki ilgili
işaretçi tetiklendiğinde okunan [referans sınırı](references/downstream-skill-boundary.md),
[keşif sınırı](references/discovery-intent-boundary.md) ve
[araştırma politikası](references/research-policy.md) tanımlar. Bu belge veya başka bir
geliştirme artefaktı onlarla çelişirse runtime kaynağını değiştirmek ya da geliştirme
artefaktını düzeltmek gerekir; buradaki metin runtime'ı geçersiz kılamaz.

## Bilgi Katmanları

| Katman | Tek doğruluk kaynağı | Rol |
| --- | --- | --- |
| Her çağrıda runtime | [SKILL.md](SKILL.md) | Sıralı adımlar, koşullu referans işaretçileri, tamamlanma ölçütleri ve çıktı kapısı |
| Koşullu runtime | [references/](references) altındaki üç Markdown belgesi | Yalnız ana işaretçinin açtığı dala ait normatif kurallar |
| Arayüz | [agents/openai.yaml](agents/openai.yaml) | Görünen ad, kısa açıklama, varsayılan çağrı ve açık çağrı politikası |
| Mimari gerekçe | [ADR 0001](docs/adr/0001-use-semantic-subtraction-for-reference-backed-prompts.md) | Mevcut sözleşmenin nedenini kaydeden, normatif olmayan karar geçmişi |
| Kayıtlı regresyon | [evals/regression-cases.json](evals/regression-cases.json) | Runtime davranışını örnek girdi, kayıtlı çıktı ve deterministik beklentilerle karakterize eden geliştirme verisi |
| Forward değerlendirme | [evals/forward-cases.json](evals/forward-cases.json) ve [protokol](docs/forward-evaluation-protocol.md) | Temiz model bağlamında canlı üretim ve kör değerlendirme için vaka, rubric ve yürütme protokolü |
| Sentetik veri | [tests/fixtures/](tests/fixtures) | Vakalara verilen kaynaklar ile sahte downstream paketleri; Deep Prompt Builder runtime sözleşmesi değildir |
| Denetim araçları | [check_regressions.py](scripts/check_regressions.py), [run_forward_evals.py](scripts/run_forward_evals.py) ve [test_regression_tools.py](tests/test_regression_tools.py) | Veri şemalarını, kayıtlı çıktıları, araç davranışını ve varsa canlı forward kanıtını denetler |

`references/` yalnız runtime'da koşullu okunabilecek normatif içeriği taşır. `evals/`,
`tests/`, `docs/` ve bu dosya geliştirme katmanıdır; ana skill bunlara işaret etmez.

## Değişiklik Disiplini

1. Değişen davranışın sahibini yukarıdaki tabloda bul ve normatif kuralı tek yerde değiştir.
   Dalın ne zaman açılacağını yalnız `SKILL.md` işaretçisinde tut. Her çağrının sıralı çekirdek
   adımları `SKILL.md` içinde; yalnız bir dalda gereken koşullu ayrıntılar hedef referansta
   yaşasın.
2. Runtime sözleşmesi değiştiğinde ilgili regresyon vakasını güncelle veya ekle. Kayıtlı çıktı
   harfiyen model cevabı değildir; denetleyiciyi ve davranış kenarını çevrimdışı sınayan
   geçerli bir örnektir.
3. Fixture içeriğini yalnız test girdisi say. Fixture `SKILL.md` dosyalarındaki normatif ve
   örnek bağlantılar, downstream sözleşme keşfini sınamak içindir; ana runtime'a kural taşımaz.
4. Değerlendirme kapılarını [forward protokolünde](docs/forward-evaluation-protocol.md)
   tanımlandığı biçimde çalıştır ve ayrı raporla.

## Geliştirme Terimleri

- **Davranış vakası:** Bir runtime dalını girdi ve denetlenebilir beklentilerle karakterize
  eden regresyon girdisi.
- **Kayıtlı çıktı:** Deterministik denetleyici için saklanan semantik örnek; canlı model için
  golden cevap veya forward kanıtı değildir.
- **Forward vaka:** Temiz model bağlamı ve gerçek yetenek gerektiren, kayıtlı çıktı yerine
  rubric ile değerlendirilen senaryo.
- **Kör değerlendirme kanıtı:** Cevap anahtarı üreticiye sızdırılmadan alınan bağımsız
  üretimleri, ayrı değerlendirici kimliklerini ve her zorunlu koşula ilişkin somut kanıtı
  kaydeden sonuç.

Kapsama kümesi, kullanıcı deltası, net yön kazancı ve diğer runtime terimlerinin anlamını bu
belgede yeniden tanımlama; onların tek doğruluk kaynağı runtime dosyalarıdır.
