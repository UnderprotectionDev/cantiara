# Hesap, Platform ve Operasyonlar

Bu belge Hesap oluşturma ve kapatma, Hesap profil tercihleri, oturum güvenliği, çalışma modeli, desteklenen uygulama kabukları, veri bölgesi, hizmet işletimi ve operasyonel kurtarmanın tek normatif sahibidir. Ürün-geneli ölçülebilir kalite hedefleri [Ürün Kalitesi](15-product-quality.md), doğrulama yöntemleri [Ürün Kabulü](16-product-acceptance.md) belgesindedir.

<a id="calisma-ve-dagitim-modeli"></a>
## Çalışma ve dağıtım modeli

- **İlk ürün, kurucu tarafından işletilen yönetilen bulut dağıtımına bağlanan online-only web uygulaması ve aynı ürünün macOS için Tauri masaüstü paketidir.** Web ile masaüstü aynı Hono/Bun backend'ini, Neon doğruluk kaynağını ve ürün sözleşmesini kullanır; Tauri backend'i Rust'a taşımaz veya ikinci bir yerel veri doğruluk kaynağı oluşturmaz. Son kullanıcı self-host kurulumu, Windows Tauri paketi ve çevrimdışı çalışma ilk üründe yoktur. Windows Tauri ancak gerçek kullanım ihtiyacı doğrulanırsa [gelecek yönü](18-future-directions.md#windows-tauri-paketi) olarak ele alınır.

- **Belge okuma ve düzenleme, kayıt oluşturma ve planlama değişikliği aktif internet bağlantısı gerektirir.** Bağlantı kesildiğinde kullanıcı son başarılı kayıt zamanını ve sunucuya yazılmamış değişiklik riskini görür. Yerel çalışma kuyruğu, offline cache veya otomatik eşitleme oluşmaz.

- **Tauri paketi web uygulamasıyla aynı Ürün sürüm adayının ana akışlarını ve güvenlik sınırlarını korur.** macOS paketi platform sertifikasıyla imzalanır ve notarization'dan geçer. Tauri Updater yalnız imzası doğrulanan çıktıyı uygular; değiştirilmiş veya geçersiz imzalı paketi reddeder ve önceki çalışan sürümü bozmaz. Otomatik rollback yoktur; bir önceki imzalı installer indirilebilir tutulur ve belgelenmiş manuel kurtarma yoluyla kurulabilir.

- **macOS paketi her Ürün sürüm adayında o tarihteki güncel macOS ana sürümü ile önceki iki ana sürümü destekler.** Kesin işletim sistemi sürümleri ve test donanımı o adayın Ürün destek matrisine sabitlenir; daha sonra yayımlanan macOS sürümü geçmiş kabulü yeniden yazmaz.

- **Backend her yeni macOS masaüstü sürümünden sonra güncel ve bir önceki imzalı masaüstü API sözleşmesini 30 gün destekler.** Daha eski veya destek süresi dolmuş istemci güvenli olmayan yazma yapmadan önce açık güncelleme hatasıyla durur.

<a id="hesap-ve-calisma-alani"></a>
## Hesap ve Çalışma Alanı

- **GitHub ile oluşturulan ilk Hesap için tek bir Çalışma Alanı oluşturulur.** İlk üründe ikinci Çalışma Alanı oluşturma veya Çalışma Alanı devri yoktur; Çalışma Alanı tek insan sahibi ve tek aktif kullanıcı taşır. Ekip üyeliği arayüzü yoktur.

- **İlk ürünün tek Hesap oluşturma ve giriş yolu GitHub'dır; Hesap değişmeyen GitHub hesap kimliğine bağlanır.** GitHub repository kurulumu ve izinleri Hesap girişinden ayrı, açık bir yetkilendirme adımıdır. Kurtarma anahtarı, e-posta ile giriş veya ad-hoc Hesap yeniden bağlama yoktur. GitHub hesabına erişim kaybedilirse mevcut oturumlar olağan sürelerinde sona erdikten sonra ürün erişimi de kaybedilir. GitHub hesabına bağlı e-postayla kurtarma ayrı bir [gelecek yönüdür](18-future-directions.md#github-hesabina-bagli-e-postayla-kurtarma).

- **GitHub giriş yetkisi ile GitHub App repository installation'ı bağımsız güven sınırlarıdır.** Kullanıcının GitHub login OAuth yetkisini kaldırması ürün oturumlarını sona erdirir ve yeniden girişte yeniden OAuth onayı ister; repository installation'ını veya onun tarihsel kayıtlarını iptal etmez. GitHub App'in kaldırılması repository eşitlemesini durdurur fakat GitHub login kimliğini ya da geçerli ürün oturumunu bozmaz. Hesap kapatma iki yetkiyi ve bunlara ait secret'ları birlikte iptal eder.

- **GitHub ile giriş başlatma ve callback uçları IP ve Hesap kimliği kapsamında hız sınırı ve kötüye kullanım koruması uygular.** Başarısız giriş yanıtları Hesap veya Çalışma Alanı varlığını açıklamaz.

<a id="hesap-profil-tercihleri"></a>
## Hesap profil tercihleri

- **Hesap profil tercihleri locale, saat dilimi, tarih biçimi, haftanın ilk günü ve Appearance değerini bütün Projelerde ortak kullanıcı tercihi olarak yönetir.** İlk girişte tarayıcıdan önerilen locale ve saat dilimi kullanıcıya gösterilir ve ancak açık kayıtla uygulanır; başlangıç varsayılanları locale `en-GB`, saat dilimi `Europe/Istanbul`, haftanın ilk günü `Monday` ve Appearance `Dark`tır. İlk ürün arayüzü İngilizcedir ve değiştirilebilir dil tercihi sunmaz; locale yalnız tarih, saat ve sayı biçimini etkiler, kullanıcı içeriğini veya arayüz metnini çevirmez.

- **Appearance yalnız `Light` ve `Dark` kabul eder; OS-follow `System` Hesap değeri değildir.** Kayıtlı değer web ve macOS Tauri kabuğunda aynı görünümü üretir. İskelet cihaz-yerel tema anahtarı kayıtlı görünümün kaynağı değildir; header Appearance eylemi aynı Hesap kaydını okur ve yazar. `Appearance` tasarım tokenı, tema sistemi, Proje rengi veya white-label ürünü değildir.

- **Saat dilimi değişikliği gelecekteki tarih girişlerini, takvim gün sınırlarını ve tarihsel olayların kullanıcıya dönük gösterimini değiştirir; saklanmış kesin zaman damgalarını yeniden yazmaz.** Bitiriş efektinin Hesap düzeyindeki etkinleştirme, tema ve palet davranışı [İş Yönetimindeki alan sözleşmesini](06-work-management-and-planning.md#bitiris-efektleri) kullanır; profil yüzeyi Proje teması, olay düzeyinde seçim veya efekt oynatma geçmişi oluşturmaz.

<a id="oturum-guvenligi"></a>
## Oturum güvenliği

- **Web oturumu cookie'si `Secure`, `HttpOnly` ve `SameSite=Lax` olur; cookie ile kimlik doğrulanan durum değiştiren istekler CSRF koruması kullanır.** Paketlenmiş Tauri istemcisi sistem tarayıcısındaki GitHub girişinden sonra deep link'te yalnız tek kullanımlık, kısa ömürlü kod alır; kod backend'de iptal edilebilir Better Auth bearer session token ile değiştirilir ve Tauri Stronghold'da saklanır. Session veya GitHub token'ı URL'ye yazılmaz.

- **Web ve Tauri oturumları 12 saat hareketsizlikten veya oluşturulduktan 30 gün sonra sona erer.** Kullanıcı tek oturumu ya da diğer bütün oturumları cihaz ve son etkinlik bilgisiyle iptal edebilir.

- **GitHub kesintisinde mevcut ve geçerli ürün oturumu olağan süresi dolana kadar özel ürün verisinde normal okuma ve yazmaya devam eder; oturum süresi uzatılmaz.** Yeni giriş, GitHub kimliğini yeniden teyit etme ve GitHub eşitlemesi görünür biçimde bekler; teyit gerektiren yüksek riskli eylemler uygulanmaz. Oturum ve Dış yüzey iptali gibi yalnız erişimi azaltan güvenlik eylemleri bu nedenle engellenmez.

### GitHub kimliğini yeniden teyit etme

- **Hesap kapatmayı başlatma veya iptal etme, 30 günlük süreden önce kalıcı silme ve geri döndürülemez kişisel veri redaksiyonu GitHub kimliğini yeniden teyit etmeyi gerektirir.** Ürün PKCE ve `prompt=select_account` ile yeni OAuth authorization-code turu başlatır, callback'te dönen değişmez GitHub kullanıcı kimliğini mevcut Hesapla eşler ve yalnız istenen işlem için tek kullanımlık, en fazla 10 dakika geçerli sunucu yetkisi üretir. Farklı kimlik, süresi dolmuş tur, state/PKCE hatası veya tekrar kullanım hiçbir yüksek riskli yazma yapmadan reddedilir.

- **Bu eylem parola, MFA ya da GitHub'ın yeni credential girişi zorladığı yeniden kimlik doğrulama olarak sunulmaz.** Yıkıcı işlem ayrıca etkilenecek Hesap veya Proje adının kullanıcı tarafından yazıldığı açık onayı ister. Uygulama düzeyinde MFA ilk ürüne eklenmez; GitHub teyidi kullanılamıyorsa yüksek riskli işlem fail-closed kalır.

<a id="hesap-kapatma"></a>
## Hesap kapatma

- **Hesap tek Çalışma Alanının sahibidir.** `Hesabı kapat` eylemi Hesap ile tek Çalışma Alanını aynı yaşam döngüsünde kapatır; ayrı bir Çalışma Alanı kapatma eylemi yoktur.

- **GitHub kimliğini yeniden teyit eden ve `Hesabı kapat` hedefini yazarak onaylayan kullanıcı önce görünür `Kapanış tamamlanıyor` geçişini başlatır:** yeni normal mutasyonlar reddedilir, dış paylaşım ve yayın erişimi hemen fail-closed durur, entegrasyonlar kapatılır ve normal oturumlar sona erdirilir. Commit bariyerinden önceki normal import, yükleme, otomasyon veya eşitleme makbuzla iptal edilir; bariyeri geçmiş iş ile daha önce başlamış geri döndürülemez güvenlik redaksiyonu veya silmesi tam commit ya da tam rollback makbuzuna ulaşır.

- **Bu işlemler tamamlanınca sabit güvenlik olay sınırındaki veri kümesiyle 30 günlük kapanma dondurması başlar ve export açılır.** Dondurma sırasında yeni kullanıcı kaynaklı redaksiyon başlatmak için önce kapanış iptal edilir; dış erişimi kapalı tutan güvenlik uygulaması ve restore replay yükümlülüğü devam eder.

- **Kullanıcı GitHub kimliğini yeniden teyit edip kapatmayı iptal edebilir veya [şifreli Çalışma Alanı çıkış paketini](13-data-security-and-portability.md#calisma-alani-cikis-paketi) ve seçili Markdown/JSON/CSV bağlantılarını alabilir.** Dondurma bu tam paketi üretir ve 30 gün indirilebilir tutar. Kalıcı silme en az bir başarılı paket üretiminden önce olmaz. Unutulan parola paketi okunamaz kılar; ürün parola kurtarmaz ve bu sınırı kapanışta açık yazar. Süre sonunda Hesap ve Çalışma Alanı kalıcı silinir. Aynı kararlı GitHub kimliği daha sonra açıkça yeni ve farklı kimlikli Hesap ile Çalışma Alanı oluşturabilir.

<a id="ab-veri-bolgesi"></a>
## Avrupa Birliği veri bölgesi

- **Birincil üretim verisi ve operasyonel yedekler Avrupa Birliği bölgesinde tutulur:** Neon Frankfurt, Railway Amsterdam, Cloudflare R2 `eu` jurisdiction ve Better Stack Almanya veri bölgesi kullanılır. Özel veri, bağlantıyla sınırlı içerik, yedek ve loglar otomatik failover sırasında AB dışına çıkmaz; AB kesintisi gerekirse fail-closed kesinti olarak yaşanır.

- **Daha önce onaylanmış ve bilerek herkese açık yayımlanmış statik içerik, özel bağımlılıkları açmadan mevcut dağıtım noktasından sunulmaya devam edebilir.** Aktif bölgeler ürün yardımında görünürdür; bölge değiştirmek ayrı taşıma kararıdır. Production deployment bu bölge sözleşmesini doğrulamadan tamamlanamaz. Bu madde kullanıcı yüzeyi veya ayrı teslim işi açmaz.

<a id="hizmet-isletimi"></a>
## Hizmet işletimi

- **Kurucu ilk ürünün hizmet operatörü ve birinci seviye destek sahibidir.** Sağlık, hata oranı, kuyruk gecikmesi ve yedek başarısızlığı için yapılandırılmış metrik ve alarm bulunur; bu alarmlar [operasyonel yedek ve kurtarma](#operasyonel-yedek-ve-kurtarma) ile aynı son kapıdadır. Kullanıcı hatada secret içermeyen destek referansı görür; bu görünür hata sözleşmesi çevrimiçi web ve macOS istemcisine aittir.

- **S1 için `derhâl`, otomatik tespit anından en fazla `5` dakika içinde alarmın üretilmesi ve güvenli olduğunda fail-closed sınırlandırmanın insan beklemeden başlamasıdır; ilk ürün 7/24 insan nöbeti vadetmez.** Bu süre insan müdahalesi değil otomatik zincirin başlama sınırıdır; aşılması operasyonel bir hata olarak kaydedilir. Kurucu sonraki uyanık çalışma döneminde müdahale eder. Tam hizmet kesintisi kullanılabilirlik hesabına dahil edilir. S2 bir iş günü içinde triage edilir.

<a id="operasyonel-yedek-ve-kurtarma"></a>
## Operasyonel yedek ve kurtarma

- **İlk ürün operasyonel yedekleme ve kurtarma sağlar; hedef `RPO ≤ 5 dakika`, `RTO ≤ 8 saat`tir.** Geri yükleme veritabanı ile özgün nesnelerin kesin manifestini tek mantıksal geri yükleme birimi sayar.

- **Geri yüklemenin ardından normal veritabanı ve nesne restore alanından ayrı korunan, append-only ve sürümlü geri döndürülemez güvenlik olay günlüğündeki kalıcı silme, güvenlik redaksiyonu, Dış yüzey/token/parola değişikliği, kimlik doğrulamalı ve ziyaretçi oturumu iptali ile entegrasyon veya anahtar rotasyonu olayları yeniden uygulanır.** Yeni bir geri döndürülemez güvenlik eylemi eşleşen restore kuralı ve testi olmadan yayımlanamaz. Günlüğün güncel sınırına kadar replay ve bütünlük kontrolleri tamamlanana kadar bütün dış erişim fail-closed kalır. Günlük secret veya kullanıcı içeriği taşımaz; hesap ve kayıtlar geri döndürülemez takma kimlikle gösterilir ve Hesap silme tombstone'u en uzun operasyonel backup/restore penceresi artı 30 gün sonunda kaldırılır.

- **Kullanıcıya dönük otomatik restore point sunulmaması hizmetin operasyonel yedek tutmaması anlamına gelmez.** Sağlayıcı, saklama topolojisi, maliyet ve tatbikat sıklığı normal mühendislik uygulaması içinde bu hedefleri karşılayacak biçimde seçilir; ayrı bir ürün karar kapısı oluşturmaz. Operasyonel yedek, restore replay ve hizmet alarmı ilk ürünün son sürüm-adayı kapısıdır; sonraki ürüne veya [Gelecek Yönlerine](18-future-directions.md) ertelenmez. Doğrulanmış kurtarma kanıtı olmadan Ürün sürüm adayı kabul edilmez.
