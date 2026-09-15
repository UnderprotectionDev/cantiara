# İş Yaşam Döngüsü

Kurucu Özellik, Bug, Görev, Araştırma ve İyileştirme türlerini değişmez Proje anahtarı, açık durum ve kapanış sonucu ile yönetir.

İş bağımsız kimlik ve geçmişle yaşar. Durum ile Tamamlandı veya Vazgeçildi sonucu ayrıdır; planlama yüzeyi yaşamı örtük kapatmaz. Arşiv, kopya birleştirme ve başka Projede yeniden oluşturma kimlik ile ilişki etkisini açık önizlemeyle yönetir. Özellik isteğe bağlı bir seviye altında başka tam İşleri kapsar; Kapsam Ağacı bu ilişkiyi salt okunur açar.

Bu feature İş yaşam döngüsünü tamamlar. Planlama yüzeyleri, İş Bağlam Kartı, taslak ve başka Projede yeniden oluşturmanın taşınabilir ilişki seçimi burada netleşir ama yüzeyler ayrıdır.

## Alt Fazlar

### İş oluşturma

İş oluşturma başlıkla başlar ve değişmez Proje kapsamında kimlik ile anahtar kazanır. Anahtar kısa kod önekini taşır.

Tür seçimi Özellik, Bug, Görev, Araştırma veya İyileştirme anlamını verir. Tür, epic hiyerarşisi veya alt görev ağacı kurmaz. Feature dışındaki türler arasında değişim serbesttir; Feature'a dönüş veya Feature'dan çıkış etki önizlemesi ister.

Oluşturma Taslak kesinleşmesi veya yakalama triage çıkışı olabilir. Her durumda oluşan İş bağımsız ana kayıttır.

### Durum ve kapanış

Durum, Projedeki akıştaki yeri gösterir. Korunan semantik `Not Started`, `In Progress`, `Blocked` ve terminal `Closed` değerleridir; kullanıcıya dönük ad değişebilir, semantik silinemez. Tamamlandı veya Vazgeçildi kapanış sonucu ayrıdır. `Closed` her geçişte açık kapatma adımı sonuç seçtirir; iptal durum değişikliğini uygulamaz.

Kurucu geçişi kendisi başlatır. Kanban sütunu kapanış adımını atlatmaz. Otomasyon veya GitHub olayı sonucu sessizce yazmaz; yazarsa kendi feature'ının görünür kuralıyla yazar. Yeniden açma açık onay ve `Not Started`, `In Progress` veya `Blocked` hedefi ister; önceki sonuç geçmişte kalır.

Kapatma adımında tamamlanmamış kontrol listesi veya aktif blokaj varsa engelleyici olmayan `Kapanış kontrolü` durur; `İşe dön` ve `Yine de kapat` vardır. Not veya öğrenim varsa atlanabilir `Kalıcı bağlamı koru` seçilen içeriği Karar veya yeni Kişisel Wiki belgesine önizlemeyle alır. Kontrol kapatmayı zorunlu engellemez, blokaj çözmez ve metin üretmez.

Kapanış, arşiv veya Proje aşaması değildir. İş kapanınca kimliği ve geçmişi kalır. Vazgeçilen iş otomatik arşivlenmez.

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

### Özellik kapsamı

Özellik isteğe bağlı olarak bir seviye altında başka tam İşleri kapsar. Her İş aynı anda en fazla bir birincil Özelliğin ilerleme kapsamına girer.

Kapsanan İş kendi tür, durum, planlama üyeliği, ilişkileri ve geçmişiyle bağımsız ana kayıt kalır. Özellik türetilen ilerlemeyi gösterebilir; bu özet Özelliğin durumunu otomatik değiştirmez. İsteğe bağlı `Yolunda`, `Riskli` veya `Yolunda değil` sağlık güncellemesi Özellikte kalır; bildirim, ilerleme hesabı veya Manuel Proje Güncellemesi yerine geçmez.

Başka Özelliklere katkı gerekçeli standart ilişkilerle durur; ikinci bir Özellik kapsamı veya ilerleme sayımı üretmez.

### Kapsam Ağacı

Kapsam Ağacı mevcut `Proje → Özellik → Kapsanan işler` ilişkisini açılıp kapanabilen salt okunur görünümde sunar. Durum, blokaj, ilgili kilometre taşı ve Özellikten türetilen ilerleme ana kaynaklardan gelir.

Kurucu kapsamı ağaçta görür ve kaydı ortak `Kaynak kaydı aç` ile açar. Ağaç içinde sürükleme kapsamı değiştirmez. Bir İş yalnız birincil Özelliğinin altında görünür.

Ağaç Proje yapısı, klasör, Kilometre Taşı kırılımı veya planlama üyeliği değildir. Yeni parent–child, içerik kopyası, bağımsız durum veya manuel ağaç sırası üretmez.

## Tamamlanma Ölçütleri

- Başlıkla başlayan İş, Proje kapsamında değişmez kimlik ve anahtar kazanır.
- Durum ile Tamamlandı veya Vazgeçildi sonucu açık kapatma adımıyla değişir; kapanış kontrolü kapatmayı zorunlu engellemez.
- Arşiv, kopya birleştirme ve başka Projede yeniden oluşturma kimlik etkisini önizleyerek uygulanır.
- Özellik kapsamı bir seviye ve tek birincil Özellik ile sınırlıdır; kapsanan İş bağımsız kalır.
- Kapsam Ağacı aynı kanonik ilişkiyi salt okunur sunar; sürükleme parent–child üretmez.

## Kapsam Sınırları

- İşi ticket, yalnız yapılacak madde veya taşınabilir kapsam sayma.
- Planlama sürüklemesiyle kapanış sonucu üretme veya kapanış adımını atlatma.
- Yanlış Projeyi kapsam değiştirerek veya kimliği koruyan kopyayla düzeltme.
- Kapsam Ağacında sürükleyerek parent–child üretme.
- İç içe epic veya subtask hiyerarşisi kurma.
