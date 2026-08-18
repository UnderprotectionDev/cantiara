---
name: workflow-phase-mapper
description: Kaynak destekli ürün davranışlarını bağımsız feature ve alt faz sınırlarına ayırır; salt okunur önizleme hazırlar ve onaylı phase-context kaynaklarını yayımlar.
disable-model-invocation: true
---

# Workflow Phase Mapper

Kaynak destekli davranışları ekran, entity, teknik katman veya teslim takvimi yerine
ürün feature sınırlarıyla fazla. Çıktıyı kod, branch, PR veya milestone planı sayma.

## 1. Kaynakları bağla

- Ürün kapsamı ve davranışı için en az bir PRD/ürün otoritesi; teknik kararlar için
  `tech-stack.md`, kabul edilmiş ADR veya doğrulanmış manifest/config/repo kanıtı oku.
- Kaynak rollerini ve karar sırasını uygulamadan önce
  [faz ayrıştırma dilbilgisini](references/decomposition-grammar.md) tamamen oku;
  [karar modelini](references/decomposition-decision-model.json) makine alanlarının
  tam kayıt defteri olarak kullan.
- Hedef projede kullanıcı tarafından sağlanan `CONTEXT.md` varsa yalnız terminoloji
  otoritesi say. Yoksa oluşturma. Repo kanıtından yeni ürün kapsamı üretme.
- Her kaynak destekli amaç, gözlenebilir sonuç, kural ve kabul kanıtını kaynak
  ankrajıyla iç envantere al.
- Kaynaklardan bulunabilen gerçeği kendin çöz. Yalnız aynı karar eksenindeki birden
  çok savunulabilir yorum yapıyı maddi değiştiriyor ve kanonik varsayılanlar
  çözemiyorsa tek soru sor; cevabı almadan faz kesimine geçme.

**Tamamlanma ölçütü:** Envanterdeki her davranışın ürün otoritesi, varsa teknik
kısıtı ve kaynak ankrajı bellidir; en az bir ürün ile bir teknik/mimari/mevcut-durum
otoritesi vardır. Maddi açık karar yoktur veya tek engelleyici soru sorulmuş ve bu
tur bitirilmiştir.

## 2. Faz kesimini kesinleştir

- Dilbilgisinin kanonik karar sırasını uygula. Kaynak sinyallerini
  [ürün arketipi indeksine](references/product-archetypes.md) yönlendir ve yalnız
  eşleşen arketip modüllerini oku; yoklama listesinden kapsam uydurma.
- Her requirement'ı iç analizde tam bir ana veya alt faz sahibine bağla. Ana/alt
  sınırları kesinleşene kadar `phaseKind` veya bağımlılık graph'ı üretme.
- Sınırlar kesinleşince tam bir gizli `phaseKind` ata; ardından gerçek sonuç
  tüketimini ve topolojik sırayı
  [önkoşul sözleşmesiyle](references/prerequisite-sequencing.md) kur.
- Önizlemeye geçmeden önce [kalite kapısının](references/workflow-quality.md) her
  maddesini denetle ve bulunan her sapmayı
  [hata taksonomisiyle](references/failure-taxonomy.md) düzelt.

**Tamamlanma ölçütü:** Her requirement'ın tek sahibi; her ana ve alt fazın kapı
kanıtı; her ana fazın tam bir gizli türü vardır. Graph döngüsüzdür, yalnız doğrudan
sonuç tüketimlerini taşır ve sıra topolojiktir. Kalite kapısının bütün maddeleri
geçmiş, açık karar kalmamıştır.

## 3. Önizlemeyi teslim et

- JSON veya HTML üretmeden önce
  [önizleme ve final sözleşmesini](references/output-templates.md) tamamen oku.
- Geçici semantik JSON'u hedef proje dışında hazırla. `prepare_preview.py` ile bu
  turda hedef projeye yalnız `docs/workflow/index.html` yaz ve yerel tarayıcıda aç.
- Kullanıcı değişiklik isterse tek kartı yamamak yerine bütün kesimi kaynaklarla
  yeniden doğrula ve aynı HTML dosyasını atomik değiştir.
- `PREVIEW_PATH`, `PREVIEW_REVISION` ve `SOURCE_REVISION` değerlerini kullanıcıya
  bildir. Final staging hazırlamadan bu turu bitir ve güncel önizleme için revizyon
  isteği ya da açık yayınlama onayı bekle.

**Tamamlanma ölçütü:** `prepare_preview.py` başarıyla bitmiş; güncel HTML açılmış;
bu turda üretilen tek inceleme artifact'i `index.html` olmuştur. Görünür kartlar
çıktı sözleşmesine uyar ve kullanıcıya üç preview değeri bildirilmiştir. Final
staging veya phase-context yayımı başlamamıştır.

## 4. Onaylı seti yayımla

- Yalnız kullanıcı gösterilen güncel önizlemeyi daha sonraki mesajında açıkça
  onaylarsa bu adıma gir. Bağlamsız `devam` için açık yayınlama niyetini doğrula.
- Onaylanan `PREVIEW_REVISION` ile mevcut HTML revizyonunu eşleştir ve kullanılan
  kaynakların değişmediğini doğrula. Değişiklik varsa yeni önizleme üretip yeniden
  açık onay bekle.
- Onaydan sonra temiz `phase-context.md` setini staging'de üret. Görünür Markdown'ı
  çıktı sözleşmesine göre doğrula; HTML'deki ana/alt faz sırası ve adlarıyla tam
  eşleştir.
- `publish_phase_contexts.py` komutuna onaylanan revizyonu
  `--approved-preview-revision` ile ver. Marker’sız mevcut faz dizininde sahiplik
  bilinmiyorsa fail closed sonucu koru; üzerine yazma. Yalnız doğrulanabilir legacy
  generated-marker seti ilk proje bazlı yeniden üretimde değiştirilebilir.

**Tamamlanma ölçütü:** Publisher `PUBLISHED=1`, onaylanan revizyon ve
`PREVIEW_REMOVED=1` değerlerini yazmış; bütün final dizinleri tek transaction olarak
kurulmuş ve `index.html` kaldırılmıştır. Ret durumunda mevcut final seti ve HTML
değişmeden kalmıştır; kullanıcıya ret nedeni bildirilmiştir.
