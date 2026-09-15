# Dikkat Sinyalleri

Kurucu yalnız kapalı registrydeki kaynak olaylardan doğan Eylem Gerekiyor ve Bilgi Akışı sinyallerini Birleşik Bildirim Merkezinde görür. Okuma veya kapatma kaynak sorunu çözmüş sayılmaz.

Dikkat dağılmaz. Sinyal kaynağını açar; bildirim durumu domain sonucundan ayrıdır. Registry yalnız kaynakta kayıtlı türlerin kesin olay ve hedef kimliğiyle doğmasına izin verir. Serbest "bir şey oldu" mesajı yoktur; kopya olay aynı kimlikte çoğalmaz. Sinyal türünün üretim kuralı sahip feature'da biter.

Birleşik Bildirim Merkezi sinyalleri kaynak ve önem sınıfıyla gruplar. Eylem Gerekiyor ile Bilgi Akışı karışmaz; varsayılan olarak Eylem Gerekiyor açılır. Aynı ana kaynağa ait sinyaller kendi bölümü içinde tek kaynak grubu altında durur; her sinyalin nedeni, kaynak olayı, zamanı ve okunma/kapatılma durumu ayrı korunur. Kurucu herkese açık Roadmap kaydı için isteğe bağlı gözden geçirme süresi tanımlarsa, süresi dolmuş onaylı snapshot Eylem Gerekiyor'da durur; iç durumu değiştirmez.

Kurucu gruptan kesin kayda döner. Güvenle çözümlenebiliyorsa sinyalin ürettiği kesin olay görünür bağlamda açılır; olay artık çözülemiyorsa kayıt açılır ve kayıp hedef açıklanır. Merkez ikinci kayıt listesi, Geri Bildirim feed'i veya Proje Etkinliği değildir. Bildirim takip işine dönüştürülmeden ayrı bookmark kuyruğunda tutulmaz. Açık `Takip işi oluştur` uygulanmadan önce oluşacak işi gösterir; bildirimi kapatmaz ve kaynak durumunu değiştirmez.

Bu feature dikkat merkezini tamamlar. Kişisel hatırlatma, işletim S1 ve koleksiyon aboneliği üretim kuralı ayrı kalır.

## Tamamlanma Ölçütleri

- Yalnız registryde kayıtlı sinyal türleri kesin olay ve hedef kimliğiyle oluşur.
- Sinyaller kaynak ve önem sınıfıyla gruplanır; kesin bağlamı açar.
- Bildirim durumu kaynak kaydın domain sonucundan ayrı tutulur.

## Kapsam Sınırları

- Okumayı veya kapatmayı kaynak sorunu çözümü sayma.
- Registry dışı serbest bildirim basma.
- Merkezi işletim pager'ı veya e-posta ürünü yapmak.
- Sinyal türünü merkezde yeniden tanımlayıp sahip feature'dan koparma.
