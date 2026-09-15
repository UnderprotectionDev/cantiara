# Yakalama ve Triage

Kurucu belirsiz girdiyi kaybetmeden geçici Yakalama Gelen Kutusuna alır. Triage, öğeyi üç açık çıkıştan tam biriyle tüketir: kalıcı kayda dönüşüm elini ilgili kayıt feature'ına verir, mevcut kayda köken veya kanıt olarak bağlar ya da siler.

Hızlı not İş, Taslak veya bookmark olmak zorunda değildir. Otomatik kayıt uydurulmaz. Sıralı triage ve Toplu Anlamlandırma aynı üç çıkışı korur. Yakalama eki kalıcı Dosya Eki değildir; Dosya Eki yaşamı Dosya Eki feature'ında kesinleşir.

Bu feature yakalama ve triage'ı tamamlar. Tamamlanmamış İş Taslağı, Belge yazarlığı, Dosya Eki yaşamı ve tarayıcının kalıcı clip arşivi burada yoktur.

## Alt Fazlar

### Hızlı yakalama

Hızlı yakalama serbest metni veya isteğe bağlı mini şablonu Gelen Kutusuna koyar. Kalıcı ana kayıt henüz oluşmaz.

Mini şablon alan zorunlu kılmaz ve yakalamayı kaydetmek için form dayatmaz. Amaç kaybetmemektir. Bağlantı kesildiğinde yerel gönderim kuyruğu tutulmaz; son başarılı kayıt ve yazılmamış risk görünür kalır. Bu kural çevrimiçi web ve macOS istemcisinin online-only sözleşmesidir.

Yakalama öğesi Backlog İşi veya uzun süreli bilgi deposu değildir. Triage edilene kadar geçicidir.

### Triage

Triage her öğeyi üç açık çıkıştan tam birine götürür. Dördüncü örtük durum yoktur.

Kurucu dönüşümü açıkça seçer. Sistem tür tahmin edip kayıt oluşturmaz. İsteğe bağlı benzer kayıt önerisi dayanağını gösterir; onay olmadan birleştirmez. Yeni kalıcı içerik, ilgili İş, Belge veya başka kayıt feature'ının sonucudur; bu kart o kaydı tamamlamış saymaz.

Triage sonucu Yakalama öğesini tüketir. Aynı girdi hem İş hem belirsiz not olarak yaşamaz.

### Sıralı triage

Sıralı triage tek yakalamaya odaklanır. Yalnız üç çıkıştan biri açıkça çözülünce sıradaki öğeye ilerler.

Kayda bakmak, alan düzenlemek veya öneriyi kapatmak ilerleme sayılmaz. Önceki öğeye dönmek ve liste görünümüne çıkmak açıktır.

Bu alt faz yeni kuyruk, sahiplik, SLA veya otomatik çözüm üretmez.

### Toplu Anlamlandırma

Toplu Anlamlandırma birden fazla yakalamayı yan yana getirir. Kurucu geçici görsel kümeler kurar; küme adı ve yerleşim çözümlemeye kadar görünüm üstverisi olarak kalır.

Küme ana kayıt, etiket, ilişki veya kalıcı sınıflandırma oluşturmaz. Her yakalama yine üç çıkıştan tam biriyle biter; çözülen öğenin yerleşim üstverisi kalkar.

Bu üstveri arama, planlama, paylaşım, yayın ve dışa aktarmaya girmez.

### Yakalama eki

Yakalama eki yalnız öğeye ait şifreli staging nesnesidir. Arama, paylaşım, yayın ve export dışında kalır.

Kalıcı kayda dönüşümde hedef kapsam gösterilir. Staging nesnesinin Dosya Eki olarak yaşaması Dosya Eki feature'ında atomik kesinleşir; başarısızlık görünür ek bırakmaz. Yakalama silinince staging nesnesi silinir.

Bu alt faz paylaşılan medya kütüphanesi veya bağımsız Dosya Eki yaşamı değildir.

### Tarayıcı yakalaması

Eşlenmiş tarayıcı uzantısı seçilen web bağlamını Gelen Kutusuna idempotent gönderir. Tekrarlayan gönderim kopya öğe üretmez.

Yakalama, sayfanın canlı kopyası veya Kaynak kaydı değildir. Kurucu triage'da neye dönüşeceğine karar verir.

Uzantı ürün oturumu olmadan yazmaz. Eşleşmemiş istemci Gelen Kutusuna giremez. Uzantı çevrimdışı gönderim kuyruğu tutmaz.

## Tamamlanma Ölçütleri

- Serbest biçimli veya mini şablonlu girdi kalıcı kayıt olmadan güvenle saklanır.
- Her yakalama üç açık çıkıştan tam biriyle tüketilir; yeni kalıcı kayıt ilgili kayıt feature'ında oluşur.
- Sıralı triage yalnız açık çözümle ilerler; Toplu Anlamlandırma kalıcı küme üretmez.
- Yakalama eki staging olarak kalır; Dosya Eki yaşamı Dosya Eki feature'ındadır.
- Eşlenmiş uzantı web bağlamını idempotent biçimde Gelen Kutusuna gönderir.
- Bağlantı kesildiğinde yakalama veya uzantı çevrimdışı kuyruk tutmaz.

## Kapsam Sınırları

- Yakalamayı İş, Taslak veya kaydedilmiş bookmark sayma.
- Otomatik triage veya zorunlu form alanıyla kayıt dayatma.
- Sıralı triage veya Toplu Anlamlandırmayı yeni kuyruk, etiket veya kalıcı sınıflandırma sayma.
- Yakalama ekini Dosya Eki veya paylaşılmış kütüphane sayma.
- Tarayıcı yakalamasını harici clip arşivi veya canlı sayfa aynası yapmak.
