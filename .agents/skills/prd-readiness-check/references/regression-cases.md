# PRD Check Regression and Forward-Test Guide

Bu rehber, eval varlıklarının neyi doğruladığını ve neyi doğrulamadığını açıklar.

## İçindekiler

1. [Dört doğrulama yüzeyi](#dört-doğrulama-yüzeyi)
2. [Offline kontrolü çalıştırma](#offline-kontrolü-çalıştırma)
3. [Gerçek skill çıktılarını kontrol etme](#gerçek-skill-çıktılarını-kontrol-etme)
4. [Davranış senaryosu kapsamı](#davranış-senaryosu-kapsamı)
5. [Yeni vaka ekleme kuralları](#yeni-vaka-ekleme-kuralları)
6. [Bilinçli sınırlamalar](#bilinçli-sınırlamalar)

## Dört doğrulama yüzeyi

`regression-fixtures.json` ve checker birbirine karıştırılmaması gereken dört yüzey taşır.

### Statik paket sözleşmesi

Checker, user-invoked seçimin bütün deterministik declaration yüzeylerinde aynı olduğunu doğrular:

- `SKILL.md` frontmatter'ında `disable-model-invocation: true`;
- runtime sözleşmesinde açık `$prd-readiness-check` çağrısı;
- `agents/openai.yaml` içinde `allow_implicit_invocation: false`;
- agent `default_prompt` içinde açık skill belirteci.

Bu kontrol dosyaların ayrışmadığını kanıtlar; modelin gerçek bir konuşmada skill'i çağırıp çağırmayacağını kanıtlamaz.

### Contract samples

Kaydedilmiş geçerli ve bilerek geçersiz raporlarla yalnız yapısal çıktı sözleşmesini deterministik doğrular:

- heading ve bölüm sırası;
- gate/ciddiyet tutarlılığı;
- zorunlu bulgu alanları;
- legacy/uygunsuz alanların yokluğu;
- approval, score, PRD type ve görünür matris yasağı;
- non-blocking bulgu sınırı;
- girdi yokken tek soru davranışı.
- `Başlamak için şart` ve `Sonra iyileştir` listelerinin gerçek bulgu bloklarıyla yapısal eşleşmesi;
- kanıt içindeki soru işareti gibi kaynak metninin kullanıcıya yöneltilmiş soru sayılmaması.

Checker yalnız `## Bulgular` altındaki tam bulgu bloklarını gate, ciddiyet ve tür hesabına katar. Serbest metnin karar anlamını, kanıtın doğruluğunu, iki bulgunun aynı köke ait olup olmadığını veya listenin bulguyu doğru özetleyip özetlemediğini kanıtlamaz.

### Behavior scenarios

Gerçek skill veya bağımsız forward-test çalıştırıcısına verilecek ham PRD/spec girdilerini ve beklenen karar özelliklerini tutar:

- beklenen gate;
- beklenen ciddiyet ve bulgu türleri;
- senaryoya özgü bulunması/yasaklanması gereken sinyaller;
- beklenen bulgu sayısı aralığı.

Varsayılan offline test bu senaryoların şemasını doğrular, model çağırmaz.

### Invocation scenarios

Fresh-agent çalıştırıcısına açık çağrı, genel PRD yorumu ve komşu implementation isteği verilir. Beklenen sonuç skill'in sırasıyla çağrılması, çağrılmaması ve çağrılmamasıdır. Offline checker yalnız senaryo/result şemasını ve kaydedilen boolean gözlemin beklentiyle eşleşmesini doğrular; gözlemi kendisi üretemez.

## Offline kontrolü çalıştırma

Repo kökünden:

```bash
python3 skills/prd-readiness-check/scripts/check_regression_fixtures.py \
  skills/prd-readiness-check/references/regression-fixtures.json
```

Başarılı çıktı statik invocation yüzeylerini, kabul edilen/reddedilen contract sample'ları, behavior/invocation senaryolarını ve varsa dış sonuç sayılarını ayrı gösterir.

## Gerçek skill çıktılarını kontrol etme

Bir dış runner veya fresh-agent forward testinden alınan sonuçları şu biçimde kaydet:

```json
{
  "outputs": [
    {
      "id": "compact-feature-pass",
      "output": "## Sonuç\n..."
    },
    {
      "id": "tenant-permission-gap-blocked",
      "output": "## Sonuç\n..."
    }
  ]
}
```

Sonra:

```bash
python3 skills/prd-readiness-check/scripts/check_regression_fixtures.py \
  skills/prd-readiness-check/references/regression-fixtures.json \
  --outputs /path/to/captured-outputs.json
```

Yalnız verilen output'lar kontrol edilir. Bütün behavior case'leri zorunlu kılmak için `--require-all` ekle.

Fresh-agent invocation gözlemlerini ayrı kaydet:

```json
{
  "results": [
    {"id": "explicit-name-invokes", "invoked": true},
    {"id": "plain-prd-review-does-not-invoke", "invoked": false}
  ]
}
```

Ardından `--invocation-results /path/to/invocation-results.json` ile doğrula. Bu boolean değerleri skill çağrısını gözlemleyebilen dış runner üretmelidir; yanıt metninden checker tarafından tahmin edilmez.

## Davranış senaryosu kapsamı

### Pass korumaları

- kapsamlı to-spec handoff;
- dar feature PRD;
- açıkça bağlı security contract;
- metinsiz design artifact gerektirmeyen net UI flow;
- sayısal metriği olmayan ama doğrulanabilir davranış;
- ayrı test bölümü olmayan net acceptance;
- tracked future open item;
- düşük riskli feature için rollout yokluğu;
- AI preview/approval sınırları;
- test prior art yokluğu;
- dar PRD'de owner/change history yokluğu.

### Ciddi eksik korumaları

- solution-only ve non-PRD girdi;
- unlinked critical source;
- linked-source permission çelişkisi;
- unavailable critical contract;
- missing acceptance/payload/error behavior;
- tenant/role isolation boşluğu;
- metric claim ve experiment guardrail boşluğu;
- current/future karışıklığı ve out-of-scope sızıntısı;
- behavior-decision-verification kopuğu;
- migration/rollback boşluğu;
- belirsiz delete ve AI automation sözleşmesi;
- billing entitlement/downgrade boşluğu;
- explicit accessibility claim'in doğrulanamaz kalması;
- external commitment'ta owner/decision boşluğu.

### Kalibrasyon korumaları

- Missing acceptance dar feature'da otomatik `Bloke` değildir.
- Missing permission cross-tenant riskte `Bloke` olabilir.
- Açık riskli delete veya autonomous AI kararı gate düşürmez; en fazla `Risk / İyileştirme` olur.
- Aynı permission sözleşmesinin create/move/share boşlukları tek bulguda birleşir.
- Belirsiz sıfat yalnız kritik kabul koşulunun yerine geçtiğinde bulgudur.
- Teorik edge case ancak makul, maddi ve güvenli engineering default'una bırakılamaz olduğunda bulgudur.

## Yeni vaka ekleme kuralları

1. Önce vaka bağımsız bir karar sınırını koruyor mu kontrol et; mevcut vakanın kelime varyantını ekleme.
2. Girdiyi gerçekçi fakat kısa tut; beklenen cevabı input'a sızdırma.
3. Exact full-report snapshot yerine gate, tür, ciddiyet, gerekli/yasak sinyal ve bulgu sayısı özelliklerini tanımla.
4. Hem ciddi eksik hem karşıt pass vakasını mümkünse birlikte ekle.
5. Her koşullu alan için en az bir tetiklenen ve bir tetiklenmeyen vaka tut.
6. Yeni output alanı eklenirse önce contract sample ve checker'ı güncelle.
7. Checker'ın geçersiz bir yapıyı kabul ettiği sınır için `invalid_contract_cases`; geçerli yapıyı yüzeysel metin nedeniyle reddettiği sınır için `contract_cases` ekle.
8. Invocation politikasını değiştiren her güncellemede en az bir açık ve bir implicit karşıt fresh-agent senaryosu çalıştır.
9. Model çağrısını varsayılan test yoluna ekleme.

## Bilinçli sınırlamalar

- Offline checker semantik PRD değerlendirmesi yapmaz.
- Kaydedilmiş contract output'ları skill talimatlarının gerçek model davranışını garanti etmez.
- Statik invocation declaration'larının eşleşmesi model invocation davranışını garanti etmez.
- Model çıktısı exact wording nedeniyle değil, davranış özellikleri nedeniyle değerlendirilir.
- Forward testler model sürümü ve sampling nedeniyle değişebilir; başarısızlıkta önce karar gerekçesi incelenmelidir.
- Kaynak kod, bağımsız web araştırması veya proje-local gizli bağlam behavior case'lerine başarı için gerekli bilgi olarak konmamalıdır.
