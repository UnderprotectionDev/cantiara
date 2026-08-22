# İş Yaşam Döngüsü

Kurucu Özellik, Bug, Görev, Araştırma ve İyileştirme türlerini değişmez Proje anahtarı, açık durum ve kapanış sonucu ile yönetir. Çok satırlı gövde ana Markdown'ın güvenli alt kümesini kullanır. Tablo, fenced kod, Mermaid ve uzun spesifikasyon tam Belgede durur.

İş bağımsız kimlik ve geçmişle yaşar. Durum ile Tamamlandı veya Vazgeçildi sonucu ayrıdır; planlama yüzeyi yaşamı örtük kapatmaz. Arşiv, kopya birleştirme ve başka Projede yeniden oluşturma kimlik ile ilişki etkisini açık önizlemeyle yönetir.

Bu feature İş yaşam döngüsünü tamamlar. Planlama yüzeyleri, İş Bağlam Kartı, taslak ve başka Projede yeniden oluşturmanın taşınabilir ilişki seçimi burada netleşir ama yüzeyler ayrıdır.

## Alt Fazlar

### İş oluşturma

İş oluşturma başlıkla başlar ve değişmez Proje kapsamında kimlik ile anahtar kazanır. Anahtar kısa kod önekini taşır.

Tür seçimi Özellik, Bug, Görev, Araştırma veya İyileştirme anlamını verir. Tür, epic hiyerarşisi veya alt görev ağacı kurmaz.

Oluşturma Taslak kesinleşmesi veya yakalama triage çıkışı olabilir. Her durumda oluşan İş bağımsız ana kayıttır.

### Durum ve kapanış

Durum, Projedeki akıştaki yeri gösterir. Tamamlandı veya Vazgeçildi kapanış sonucu ayrı bir açık eylemdir.

Kurucu geçişi kendisi başlatır. Kanban sütunu, otomasyon veya GitHub olayı sonucu sessizce yazmaz; yazarsa kendi feature'ının görünür kuralıyla yazar.

Kapanış, arşiv veya Proje aşaması değildir. İş kapanınca kimliği ve geçmişi kalır.

### İş arşivi

İş arşivi kaydı planlama yüzeylerinden ayırır. Desteklenen filtreyle bulunabilir kalır; silinmiş sayılmaz.

Arşiv kapanış sonucu üretmez. Kurucu arşivi geri alabilir; kimlik değişmez.

Bu alt faz Proje arşivi veya Çöp Kutusu değildir. Yalnız İşin çalışma yüzeylerinden çekilmesidir.

### Kopya birleştirme

Kopya birleştirme iki İşin kimlik ve ilişki etkisini önizler. Tek kanonik kayıt kalır; diğeri güvenli kapanır.

Kurucu neyin taşınacağını görür. Gizli alan birleşimi veya sessiz silme olmaz.

Birleştirme başka Projede yeniden oluşturma değildir. Aynı kapsamda tek gerçeği korur.

### Başka Projede yeniden oluşturma

Başka Projede yeniden oluşturma, seçilen taşınabilir içerikten hedefte yeni kimlikli İş üretir. Kaynak İş durur ve değişmez.

Kurucu hangi ilişkilerin gideceğini tek tek seçer. Sahiplik veya yaşam döngüsü bağları taşınmaz.

Bu düzeltme kapsam değiştirme, kimliği koruyan kopya veya İş taşıma değildir.

## Tamamlanma Ölçütleri

- Başlıkla başlayan İş, Proje kapsamında değişmez kimlik ve anahtar kazanır.
- Durum ile Tamamlandı veya Vazgeçildi sonucu açık kullanıcı eylemiyle değişir.
- Arşiv, kopya birleştirme ve başka Projede yeniden oluşturma kimlik etkisini önizleyerek uygulanır.

## Kapsam Sınırları

- İşi ticket, yalnız yapılacak madde veya taşınabilir kapsam sayma.
- Planlama sürüklemesiyle kapanış sonucu üretme.
- Yanlış Projeyi kapsam değiştirerek veya kimliği koruyan kopyayla düzeltme.
