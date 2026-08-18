---
name: prototype-builder
description: Kaynakları izlenebilir gereksinimlere dönüştürüp aynı kapsamda yapısal olarak ayrışan üç çalışabilir masaüstü web prototipini tek Vite/React/TypeScript projesinde üretir ve kanıtlarla doğrular.
disable-model-invocation: true
---

# Prototype Builder

Kaynaklarda tarif edilen fikri karar vermeyi kolaylaştıran üç çalışabilir masaüstü
web deneyiminde görünür kıl. Üretim sistemi değil, kaynak kapsamı izlenebilir bir
prototip paketi üret.

## 1. Kaynak ve Hedef Sınırını Kur

- Kullanıcının verdiği kaynakları ve açık hedef dizini belirle. Hedef verilmemişse
  çalışma alanında `prototypes/<kısa-kebab-ad>` kullan; doluysa ilk boş sayısal
  son eki seç.
- Kullanıcının açıkça verdiği hedef zaten varsa üzerine yazmadan dur ve tek hedef
  kararı iste. Çalışma sırasında oluşturduğun hedef bunun dışındadır.
- Mevcut ürün kodunu read-only bağlam say. Prototipi ayrı hedefte üret; ürün
  dosyalarını ve bundled starter'ı yerinde değiştirme.
- Önceki prototip çıktıları ile hedef dizini kaynak keşfinin dışında tut.
- Çıktıyı masaüstü web, frontend simülasyonu ve üç alternatifle sınırla. Canlı URL
  klonlama, production entegrasyonu, backend, gerçek dış servis, kalıcılık,
  deployment, mobil/native/responsive üretim ve audit bu akışın dışındadır.

**Tamamlanma ölçütü:** Erişilebilir kaynak paketi ile henüz kullanıcı dosyası
barındırmayan ayrı hedef nettir; mevcut ürün veya starter dosyalarına yazma riski
yoktur.

## 2. Kaynak Gerçekliğini Çıkar

Gereksinim çıkarmadan önce [kaynak ve gereksinim izleme
sözleşmesini](references/source-traceability.md) tamamen oku ve uygula.

- Kaynakları doğrudan incele; kontrollü repository keşfini yalnız görevle ilgili
  ürün, tasarım sistemi ve teknik bağlama sınırla.
- Temel kullanıcı, amaç veya zorunlu davranıştaki çözülemeyen kaynak çelişkisini
  tek maddi soruya taşı. Diğer boşluklarda minimum prototip yorumunu kullan.
- Hedefte `requirements.json` oluştur ve validator'ı `--stage extraction` ile
  çalıştır. Hata varken tasarıma geçme.

**Tamamlanma ölçütü:** Extraction doğrulaması geçmiştir; her kaynak maddesi atomik,
benzersiz, kesin konumlu ve `implemented`, `simulated` veya `non-visual` olarak
sınıflandırılmıştır. Okunamayan zorunlu kaynak veya çözülmemiş temel çelişki
kalmamıştır.

## 3. Üç Deneyim Yönünü Tasarla

Kod yazmadan önce [üç tasarım yönü
sözleşmesini](references/design-alternatives.md) tamamen oku ve uygula. Üç yönü
hedefte `design-directions.md` içinde taahhüt et; ara seçim istemeden üçünü de
uygula.

**Tamamlanma ölçütü:** A, B ve C aynı kullanıcı sonucunu, gereksinim kapsamını ve
bağlayıcı görsel kuralları korur; her çift için en az bir yapısal ve ikinci bir
yüksek etkili fark uygulanmak üzere açıkça tanımlanmıştır.

## 4. Çalışabilir Prototipi Üret

1. Bu skill köküne göre `assets/prototype-starter/` içeriğini hedefe kopyala.
2. Örnek ürün içeriğini ve yönleri kaynak-özgü içerikle tamamen değiştir; starter'ı
   tasarım otoritesi sayma.
3. Nötr `/` karşılaştırma ekranı ile `/alternative-a`, `/alternative-b` ve
   `/alternative-c` rotalarını koru. Alternatifler arasında yalnız mock veri
   sözleşmesi ve saf domain yardımcılarını paylaş.
4. Her `implemented` ve `simulated` gereksinimi üç alternatifte çalışan görünür
   yüzeylere eşleştir. Ana akışlar, navigasyon ve görünür kontroller çalışsın;
   dış sistem sonucunu yalnız gerekiyorsa in-memory durumla simüle et.
5. `requirements.json` içindeki üç alternatifin rota, experience, evidence ve
   verification alanlarını doldur; doğrulanmamış sonuçları `pending` bırak.
6. Proje kökünde `npm ci --prefer-offline --no-audit --no-fund` çalıştır. Yalnız
   manifesti bilinçli değiştirdiğinde lock dosyasını
   `npm install --prefer-offline --no-audit --no-fund` ile güncelle.

**Tamamlanma ölçütü:** Tek projede dört rota vardır; bütün görünür gereksinimler üç
alternatifte çalışır, örnek starter içeriği kalmamıştır ve draft coverage
doğrulamasına hazırdır.

## 5. Kanıtla ve Teslim Et

Doğrulamadan önce [yalın prototip doğrulama
sözleşmesini](references/verification.md) tamamen oku ve sırayla uygula. Draft
coverage, production build, açık preview, tarayıcı akışları, console, screenshot,
render edilmiş çift ayrışması ve varsa bağlayıcı görsel kurallar kanıtlanmadan
final coverage çalıştırma.

**Tamamlanma ölçütü:** Başarılı sonuçta final coverage ve build geçmiştir; dört
rota `1440x1024` tarayıcıda açılmış, ana akışlar denenmiş, engelleyici console
hatası kalmamış, üç screenshot ile çift ayrışmaları kaydedilmiş ve preview açık
bırakılmıştır. Zorunlu kanıt erişilemiyorsa sonuç `blocked` kalır; draft coverage
ve gerçek blocker ile teslim edilir.

## Teslimat Sınırı

Hedef dizini, çalıştırma komutunu, açık preview bilgisini ve teslimat dosyalarını
bildir. Üç yönün tümünü teslim et; yön seçimi, production polish veya kapsam dışı
entegrasyon başlatma.
