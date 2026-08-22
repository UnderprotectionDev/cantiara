# Yakalama ve Triage

Kurucu belirsiz girdiyi kaybetmeden geçici Yakalama Gelen Kutusuna alır ve onu yeni kayda, mevcut kayda bağlı kanıta veya silme sonucuna açıkça dönüştürür.

Hızlı not İş, Taslak veya bookmark olmak zorunda değildir. Triage üç çıkıştan tam biriyle biter; otomatik kayıt uydurulmaz.

Bu feature yakalama ve triage'ı tamamlar. Tamamlanmamış İş Taslağı, Belge yazarlığı ve tarayıcının kalıcı clip arşivi burada yoktur.

## Alt Fazlar

### Hızlı yakalama

Hızlı yakalama serbest metni veya isteğe bağlı mini şablonu Gelen Kutusuna koyar. Kalıcı ana kayıt henüz oluşmaz.

Mini şablon alan zorunlu kılmaz ve yakalamayı kaydetmek için form dayatmaz. Amaç kaybetmemektir. Bağlantı kesildiğinde yerel gönderim kuyruğu tutulmaz; son başarılı kayıt ve yazılmamış risk görünür kalır.

Yakalama öğesi Backlog İşi veya uzun süreli bilgi deposu değildir. Triage edilene kadar geçicidir.

### Triage

Triage her öğeyi yeni kayıt, mevcut kayda bağlı kanıt veya silme sonuçlarından tam birine götürür. Dördüncü örtük durum yoktur.

Kurucu dönüşümü açıkça seçer. Sistem tür tahmin edip kayıt oluşturmaz.

Triage sonucu Yakalama öğesini tüketir. Aynı girdi hem İş hem belirsiz not olarak yaşamaz.

### Tarayıcı yakalaması

Eşlenmiş tarayıcı uzantısı seçilen web bağlamını Gelen Kutusuna idempotent gönderir. Tekrarlayan gönderim kopya öğe üretmez.

Yakalama, sayfanın canlı kopyası veya Kaynak kaydı değildir. Kurucu triage'da neye dönüşeceğine karar verir.

Uzantı ürün oturumu olmadan yazmaz. Eşleşmemiş istemci Gelen Kutusuna giremez. Uzantı çevrimdışı gönderim kuyruğu tutmaz.

## Tamamlanma Ölçütleri

- Serbest biçimli veya mini şablonlu girdi kalıcı kayıt olmadan güvenle saklanır.
- Her yakalama üç açık çıkıştan tam biriyle sonuçlanır.
- Eşlenmiş uzantı web bağlamını idempotent biçimde Gelen Kutusuna gönderir.
- Bağlantı kesildiğinde yakalama veya uzantı çevrimdışı kuyruk tutmaz.

## Kapsam Sınırları

- Yakalamayı İş, Taslak veya kaydedilmiş bookmark sayma.
- Otomatik triage veya zorunlu form alanıyla kayıt dayatma.
- Tarayıcı yakalamasını harici clip arşivi veya canlı sayfa aynası yapmak.
