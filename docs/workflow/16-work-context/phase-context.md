# İş Bağlam Kartı

Kurucu İşin nedenini, beklenen sonucunu, kanıtını ve ilişkili proje gerçeğini aşamalı ve yapılandırılabilir tek bağlamda görür. Karar, Risk, Varsayım, Açık Soru ve araştırma kayıtları ayrı bir İş yüzeyi kurmaz; kart onları kendi kaynaklarıyla gösterir.

İş Bağlam Kartı kaynaklarında canlı gösterir; içerik kopyası, bağımsız sorgu veya durum kapısı değildir. Düzen Yapılandırma modunda Proje ve İş türü başına ayarlanır; kartın anlamı Başlangıç yapılandırmasına göre bölünmez. Bu feature İş Bağlam Kartını tamamlar. Proje kabuğu, planlama yüzeyleri ve paylaşım kapsamı ayrıdır.

## Alt Fazlar

### Hazır tür düzenleri

Hazır düzen yalnız İş türüne göredir ve bütün Projelerde aynı başlangıç anlamını taşır. Feature, Bug, Task, Research ve Improvement kendi kapalı bölüm setini kullanır.

Bölümler isteğe bağlıdır. `Bağlam ekle` ile aşamalı açılır; hiçbir bölüm oluşturma veya durum geçişi kapısı değildir.

Düzen Başlangıç yapılandırmasına göre farklı İş anlamı yaratmaz. Aynı İş türü bütün Projelerde aynı kayıttır.

### Canlı bağlam ve neden zinciri

Kart; problem, beklenen sonuç, Proje Hedefi, köken araştırma, birincil Özellik, Birincil spec ve desteklenen doğrudan ilişkilerdeki Karar, Risk, Varsayım, Açık Soru, kanıt ve GitHub/Sürüm kayıtlarını kaynağından gösterir.

`Neden bu işi yapıyorum?` zinciri en yakın anlamlı kaynakları görünür adlarıyla bağlar. Yeni kayıt veya ilişki üretmez; çözülemeyen adım içerik sızdırmaz.

Boş görünür bölüm tarafsız boş durum ve desteklenen ekleme eylemi sunar. Eksiklik durum, öncelik, kapanış veya Sürüm kapsamını değiştirmez.

### Düzen yapılandırması

Kurucu Yapılandırma modunda Proje ve İş türü başına bölümleri gösterir, gizler ve sıralar. Desteklenen kayıt türü, doğrudan ilişki veya Kanıt Rolü ile adlandırılmış özel bölüm kurulabilir.

Bölüm yalnız açık İşten desteklenen ilişkilerle erişilen kayıtları getirir. Serbest sorgu, formül, grafik veya keyfî veri kaynağı çalışmaz.

Uygulanmadan önce etkilenecek türler ve bölüm farkı görünür. Onaylanan değişiklik sürümlü yapılandırma geçmişindedir; geri alma yalnız düzeni döndürür. İş alanları ve ilişkileri değişmez.

### Bağlamı kopyalama ve öncelik dayanakları

`Bağlamı Markdown kopyala` iş anahtarı, başlık, tür, durum, açıklama, kontrol listesi, neden zinciri, Birincil spec, ilgili belirsizlik ve izinli dış bağlantıları okunabilir Markdown olarak panoya aktarır. Yeni kayıt veya kalıcı snapshot oluşmaz.

`Öncelik dayanakları` hedef, tarih, blokaj, risk, kilometre taşı, geri bildirim ve ölçütleri kaynaklarına bağlı toplar. Sayısal skor veya otomatik sıra hükmü üretmez.

Kart özel iç çalışma düzenidir. Görünen bölüm bağlantıyla paylaşım veya Build in Public kapsamı açmaz.

## Tamamlanma Ölçütleri

- Beş İş türünün hazır bölüm seti bütün Projelerde aynı başlangıç anlamını taşır; bölümler kapı oluşturmaz.
- Kart bağlamı kaynaklarında canlı gösterir; kopya, sorgu sonucu veya durum kapısı üretmez.
- Düzen değişikliği eşleşen İşlerde aynı canlı sunumu kullanır; İş verisini değiştirmez.
- Markdown kopyası ve öncelik dayanakları yeni kayıt veya otomatik skor üretmez.
- Boş görünür bölüm eksikliği tarafsız açıklar; gizlenen bölüm eksik sayılmaz.

## Kapsam Sınırları

- Kartı dashboard, ikinci İş özeti veya serbest sorgu sonucu sayma.
- Başlangıç yapılandırmasına göre farklı İş anlamı üretme.
- Bağlam kartını planlama yüzeyi, sağlık skoru veya yayın kapısı yapmak.
- Düzeni kayıt başına ayrı şema veya içerik kopyası sayma.
- Paylaşım kapsamını karttaki bölüm sırasından türetme.
