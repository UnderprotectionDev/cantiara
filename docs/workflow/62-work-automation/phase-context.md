# Hafif İş Otomasyonları

Kurucu kapalı tetikleyici, koşul ve eylemlerden Proje kuralları oluşturur. Çakışma, başarısızlık ve kullanıcı kontrolü görünür kalır.

Tekrarlayan iş kuralı elle unutulmaz. Otomasyon gizlice kapanış, yayın veya GitHub yazması yapmaz; katalog dışına çıkmaz. Hazır PR-merge kuralı, GitHub feature'ının `Tamamlanma için gerekli` PR rolünü tüketir; bağlantı tek başına İşi kapatmaz.

Bu feature hafif iş otomasyonlarını tamamlar. Toplu düzenleme, kayıt eylem kataloğu, GitHub check ve bitiriş efekti ayrı kalır.

## Alt Fazlar

### Kapalı kural kataloğu

Kurucu kapalı tetikleyici, isteğe bağlı koşul ve eylemlerden Proje kuralı oluşturur. Yalnız açıkça etkin kurallar çalışır.

Çakışan öneriler yazmadan durur; çatışmayan öneriler tek atomik ve idempotent mutasyonda uygulanır. Başarısızlık ve kural sürümü görünür kalır. Bir kuralın yazması başka kuralı tetiklemez.

Bu alt faz açık uçlu betik, webhook pazarı veya ajan orkestrasyonu değildir.

### Hazır PR-merge kuralı

Kurucu hazır `Bağlı gerekli PR'lar merge edildiğinde işi Tamamlandı say` kuralını açıkça etkinleştirir. Kural, İşe en az bir `Tamamlanma için gerekli` PR bağlıyken ve bu roldeki bütün PR'lar merge edildiğinde kapanış sonucunu `Tamamlandı` yapar.

Hiç gerekli PR'ı olmayan İş veya yalnız `Bağlamsal` PR merge'i kurala uymaz. Kural kapalıysa aynı koşul yalnız öneri üretir. Check başarısızlığı kapatmayı geciktirmez ve tamamlanan İşi yeniden açmaz.

Bu alt faz GitHub inceleme, merge aracı veya genel GitHub olay tetikleyicisi değildir.

## Tamamlanma Ölçütleri

- Kapalı tetikleyici, koşul ve eylemlerden Proje kuralları oluşur.
- Çakışma, başarısızlık ve kullanıcı kontrolü görünür kalır.
- Etkin hazır PR-merge kuralı yalnız gerekli roldeki bütün PR'lar merge edilince İşi `Tamamlandı` sayar; bağlantı tek başına kapatmaz.

## Kapsam Sınırları

- Açık uçlu betik, webhook pazarı veya ajan orkestrasyonu.
- Başarısız kuralı sessizce yutma.
- Otomasyonu yayın kapısı veya test koşturucu yapmak.
- GitHub bağlantısını sessiz kapanış sayma.
- Otomasyon kapanışından bitiriş efekti üretme.
