# 19 · Public Surfaces

Ziyaretçiye dönük, salt okunur Dış yüzeyler.

| Ekran | Ne çizilir |
|---|---|
| [19.1 · Public Frame & Shared Blocks](#191--public-frame--shared-blocks) | Ziyaretçi çerçevesi ve ortak bloklar |
| [19.2 · Link Share Password Gate](#192--link-share-password-gate) | Ortada tek parola formu |
| [19.3 · Link Share Viewer](#193--link-share-viewer) | Paylaşılan kök varyantları (Roadmap ana) |
| [19.4 · Published Wiki Page](#194--published-wiki-page) | Tek sütun Belge okuma görünümü |
| [19.5 · Build in Public · Project View](#195--build-in-public--project-view) | Proje özeti, gezinme, üyeler, gelişim akışı |
| [19.6 · Build in Public · Roadmap](#196--build-in-public--roadmap) | Herkese açık durum grupları |
| [19.7 · Build in Public · Changelog](#197--build-in-public--changelog) | Kronolojik sürüm girdileri |
| [19.8 · Link Access Ended](#198--link-access-ended) | İçeriksiz tek mesaj |
| [19.9 · 410 Gone](#199--410-gone) | Boş gövdeli tarayıcı görünümü |

## 19.1 · Public Frame & Shared Blocks
> Bütün Dış yüzeylerin paylaştığı ziyaretçi çerçevesini ve tekrar eden blokları (snapshot etiketi, YouTube kartı, dondurulmuş canlı blok, Dosya Eki görüntüleyici) tek yerde tanımlamak; 19.3–19.7 bunları yeniden çizmez, buraya referans verir.

**Artboard'lar**
- `19.1 · Public Frame & Shared Blocks · Components · 1440`
- `19.1 · Public Frame & Shared Blocks · Components · 390`
- `19.1 · Public Frame & Shared Blocks · YouTube before load · 1440`
- `19.1 · Public Frame & Shared Blocks · YouTube loaded · 1440`

390: aynı sütun tam genişlik; başlık iki satıra kırılır, blok kartları tam genişlikte alt alta.

`Components` artboard'ı (1440 ve 390) yüzey başlığı, snapshot etiketi, dondurulmuş canlı blok, Dosya Eki görüntüleyici ve alt bilgiyi yan yana gösterir; YouTube kartı ayrı iki artboard'dadır (`YouTube before load`, `YouTube loaded`).

### Yüzey başlığı
Üstte ince başlık: yüzey başlığı (Wiki'de Belge başlığı; Build in Public'te yayın başlığı, alanı `08.24 · Yayın başlığı, özeti ve adresi`'nde tanımlı; bağlantı paylaşımında paylaşılan kökün adı), isteğe bağlı Proje logosu (yalnız Build in Public Roadmap ve changelog), snapshot etiketi, son kapsam onay zamanı (yalnız bağlantı paylaşımı).
- **Label'lar:** `Approved snapshot`, `Some fields live`, `Live`; Build in Public başlık/özet label'ları → `08.24`. Genel `Current` etiketi hiçbir yerde kullanılmaz.

### Snapshot etiketi
Yüzeyin tamamı donmuşsa tek `Approved snapshot` etiketi. Kayıt düzeyinde: canlılığı ayrıca onaylanmış alanın yanında `Live`; donmuş ve canlı alan taşıyan kayıtta `Some fields live`, ayrıntıda hangi kesin alanların canlı olduğu yazılır.
- **Label'lar:** `Approved snapshot`, `Live`, `Some fields live`.

### YouTube kartı
Kart etiketleri, statik kart durumu, üçüncü taraf uyarısı ve yükleme eylemi → `11.1 · YouTube canlı kartı` (burada yeniden tarif edilmez). Ziyaretçi farkı yalnız: ziyaretçide kartı kaydetme/düzenleme yoktur; yükleme tek eylemle yapılır (autoplay yok).
- **Label'lar:** → `11.1`.

### Dondurulmuş canlı blok
Onaylanmış canlı Akıllı Koleksiyon özeti veya canlı içerik bölümünün salt okunur snapshot'ı: kesin kayıt listesi ve onaylı alanlar, kaynak görünüm adı, tarih etiketi.
- **Label'lar:** `Snapshot`, `As of`.

### Dosya Eki görüntüleyici (ziyaretçi)
Onay anındaki kesin Dosya Eki sürümünün salt okunur önizlemesi (görsel, sayfalı PDF, sınırlı CSV satırları, güvenli düz metin, kullanıcı başlatmalı ses/video). İşaretleme katmanı yalnız ayrıca onaylandıysa görünür.
Bileşen ve label seti `20.13 · File Attachment Viewer · Önizleme`'dedir, yeniden tarif edilmez. Ziyaretçi farkı: yükleme, sürüm yönetimi ve köken bağlama yoktur; yalnız onay anındaki kesin sürüm görünür.
- **Label'lar:** → `20.13`; bileşen kullanılamazsa `Unavailable`.

### Alt bilgi
Altta sessiz alt bilgi: ürün adı, tek satır "salt okunur" açıklaması. Görüntülenme sayısı, abonelik, iletişim formu yoktur.
- **Label'lar:** `This page is read-only.`

### Durumlar
#### Loading
İlk kullanılabilir içerik bütçesi p95 2,5 sn / p99 4 sn; yükleme yalnız içerik alanında sakin bir iskelet çizgisi olarak görünür, kabuk ya da spinner tam sayfayı kaplamaz.
#### Error
YouTube kartı kullanılamazsa güvenli bağlantı veya açıklanabilir hata metnine döner; kırık iframe çizilmez. Dosya önizlemesi üretilemezse `Unavailable` gösterilir.
#### YouTube before load
Statik kart (`11.1`); sayfa açılırken üçüncü tarafa istek yoktur.
#### YouTube loaded
Kartın yerini oynatıcı alır; etiket ve özgün URL `11.1`'deki gibi oynatıcının altında kalır.
#### Kaldırılan öğe
Kapsamdan çıkarılan içerik boşluk, sayaç, sıra atlaması, boş grup başlığı veya kırık çizgi bırakmaz; komşu bloklar boşluk yokmuş gibi akar.

**Spec:** [73 Link Sharing](../../specs/73-link-sharing/spec.md), [74 Wiki Publishing](../../specs/74-wiki-publishing/spec.md), [75 Build in Public](../../specs/75-build-in-public/spec.md), [14 File Attachments](../../specs/14-file-attachments/spec.md) (kesin Dosya Eki sürümü). Sayfa geneli katkı veren: [76 External Surface Management](../../specs/76-external-surface-management/spec.md) (durum adları), [65 Release Communication](../../specs/65-release-communication/spec.md) (changelog içeriği), [01 Account Access](../../specs/01-account-access/spec.md) (ziyaretçi oturumu Hesap oturumu değildir).

## 19.2 · Link Share Password Gate
> Parolalı bir bağlantıyla gelen ziyaretçiden ortak parolayı istemek ve doğrulama sonrası temiz URL'ye geçirmek; yüzeyin var olup olmadığını hiçbir hata metninde ele vermemek.

**Artboard'lar**
- `19.2 · Link Share Password Gate · Default · 1440`
- `19.2 · Link Share Password Gate · Default · 390`
- `19.2 · Link Share Password Gate · Error · 1440`
- `19.2 · Link Share Password Gate · Cooldown · 1440`
- `19.2 · Link Share Password Gate · Error · 390`

390: aynı blok tam genişlik, klavye açıkken parola alanı görünür kalır.

### Parola formu
Ekran ortasında tek dar form bloğu, başka içerik yok: kısa açıklama (bu bağlantı ortak bir parolayla korunuyor), parola alanı, gönderme eylemi. Paylaşılan kökün adı, kurucu adı veya kapsam ipucu gösterilmez.
- **Label'lar:** `Enter the password to view this page.`, `Password`, `View`.

### Durumlar
#### Default
Boş parola alanı, odak alanda.
#### Error
Yanlış parola veya geçersiz token aynı genel hatayı gösterir; yüzeyin var olduğu, parolanın varlığı veya kaçıncı deneme olduğu söylenmez.
#### Cooldown
Tekrarlanan denemeden sonra artan bekleme süresi: gönderme eylemi devre dışı, kalan süre metin olarak; yine genel dil.
#### Parolasız bağlantı
Parola yoksa bu ekran görünmez; token doğrulaması arka planda yapılır ve ziyaretçi doğrudan temiz URL'deki 19.3'e iner.

**Spec:** [73 Link Sharing](../../specs/73-link-sharing/spec.md)

## 19.3 · Link Share Viewer
> Bağlantıyı (ve varsa parolayı) elinde tutan ziyaretçiye yalnız onaylanmış kapalı dünyayı salt okunur göstermek.

**Artboard'lar**
- `19.3 · Link Share Viewer · Roadmap · 1440`
- `19.3 · Link Share Viewer · Roadmap · 768`
- `19.3 · Link Share Viewer · Roadmap · 390`
- `19.3 · Link Share Viewer · Single Work · 1440`
- `19.3 · Link Share Viewer · Single Work · 390`
- `19.3 · Link Share Viewer · Document · 1440`
- `19.3 · Link Share Viewer · External diagram card · 1440`
- `19.3 · Link Share Viewer · Project Wall · 1440`
- `19.3 · Link Share Viewer · Project Wall · 390`

### Başlık
19.1 yüzey başlığı: paylaşılan kökün adı, snapshot etiketi, son kapsam onay zamanı; etiketler → `19.1 · Snapshot etiketi`.

### Paylaşılan içerik — Roadmap (ana örnek)
19.1 çerçevesinde; içerik paylaşılan kökün türüne göre tek sütun (Belge, tekil kayıt) veya geniş tuval/şerit (Roadmap, Ekran, Proje Duvarı, Moodboard, Teknik Diyagram, Akıllı Koleksiyon). Roadmap: onaylanmış İşler ufuk gruplarında (`Now`, `Next`, `Later`), Kilometre Taşları. Yalnız tek tek onaylanmış kayıtlar; filtreye sonradan giren adaylar görünmez ve varlıkları sayaçla da sezdirilmez.
- **Label'lar:** `Now`, `Next`, `Later`, `Live`, `Some fields live`.

#### Tekil kayıt varyantı (artboard `Single Work`)
İş, Karar, Risk, Geri Bildirim, Üretim Olayı, Kilometre Taşı veya Proje Sürümü tek sayfa olarak: başlık, onaylı alanlar, onaylı Dosya Ekleri (19.1 görüntüleyici). Ör. `LUMA-42` ayrıntısı.
#### Belge varyantı (artboard `Document`)
Onaylı Belge sürümünün okuma görünümü; onaylı gömüler ve dondurulmuş canlı bloklar 19.1'deki gibi.
#### Ekran varyantı
Seçilen kesin Wireframe sürümü; sonraki Wireframe sürümleri görünmez.
#### Teknik Diyagram varyantı (artboard `External diagram card` dış kaynak bağlantılı kart)
Ürün-owned: kesin Diyagram Sürümü ve Diyagram Görünümü salt okunur. Dış kaynak bağlantılı: iframe yok; yalnız sağlayıcı simgesi, kesin URL, bilinen revizyon/güncelleme zamanı, son kontrol zamanı ve sağlayıcı etiketinden oluşan statik link kartı; dış kaynağın hâlâ güncel olduğu iddia edilmez.
#### Proje Duvarı / Moodboard varyantı (artboard `Project Wall`)
Onaylı kartlar, kesin Dosya Eki sürümleri, onaylı yerleşim/grup başlığı/görsel çizgi/işaretleme katmanı. Çıkarılan özel öğeler çizgi ucu, boş grup veya konum boşluğu bırakmaz.
#### Akıllı Koleksiyon varyantı
Onaylanmış kayıt satırları; görünüm adı bir erişim izni gibi sunulmaz.

### Durumlar
#### Loading
19.1 Loading.
#### Error
Genel, içeriksiz hata; yüzey bilgisini sızdırmaz. Asset isteği reddedilirse ilgili blok `Unavailable` olur.
#### Long content / Many items
Roadmap'te uzun gruplar dikey akar; sayfalama veya "N daha" sayacı yoktur (sayaç gizli kapsamı ele verebilir).
#### Oturum sona erdi
12 saat dolduğunda veya tarayıcı kapanıp açıldığında sonraki istek 19.8'e düşer; açık sayfa sessizce eski içeriği göstermeye devam etmez.

**Spec:** [73 Link Sharing](../../specs/73-link-sharing/spec.md), [14 File Attachments](../../specs/14-file-attachments/spec.md)

## 19.4 · Published Wiki Page
> Tek bir Kişisel Wiki Belgesini, Proje Build in Public yüzeyinden bağımsız, herkese açık salt okunur snapshot olarak okutmak.

**Artboard'lar**
- `19.4 · Published Wiki Page · Default · 1440`
- `19.4 · Published Wiki Page · Default · 390`
- `19.4 · Published Wiki Page · With frozen block and YouTube · 1440`

390: tek sütun, bölüm listesi başlığın altında katlanır.

### Belge başlığı
Belge başlığı, isteğe bağlı Belgeye özgü herkese açık özet (`Public summary`; alanın sahibi `05.4`), `Approved snapshot` etiketi (→ `19.1`); isteğe bağlı başlık içi bölüm listesi yalnız Belge başlıklarından türetilir.
- **Label'lar:** `Public summary` (→ `05.4`); `Approved snapshot` (→ `19.1`).

### Belge gövdesi
Onaylı sürümün Markdown okuma görünümü; yalnız onaylanan çocuk belgeler, ekler, satır içi referanslar ve gömüler. Onaylanmamış referans düz metin olarak kalır veya hiç görünmez; geri bağlantı listesi yoktur.
- **Label'lar:** `Live external source` (YouTube varsa).

### Durumlar
#### Loading
19.1 Loading.
#### Unpublished
Kurucu `Unpublish` ettiğinde URL → 19.9 `410 Gone`; yaşam döngüsü yönetimi → `02.13`.
#### Long content
Uzun Belge tek sütunda akar; bölüm listesi yapışkan değil, başta durur.

**Spec:** [74 Wiki Publishing](../../specs/74-wiki-publishing/spec.md), [73 Link Sharing](../../specs/73-link-sharing/spec.md) (paylaşılan erişim/cache/YouTube kuralı)

## 19.5 · Build in Public · Project View
> Bir Projenin son onaylanmış herkese açık özetini ve onaylı üyelerini (Roadmap, İş, Belge, tasarım, Karar, seçili Proje Duvarı) aynı Onaylı snapshot revizyonundan göstermek.

**Artboard'lar**
- `19.5 · Build in Public · Project View · Default · 1440`
- `19.5 · Build in Public · Project View · Default · 768`
- `19.5 · Build in Public · Project View · Default · 390`
- `19.5 · Build in Public · Project View · Featured record · 1440`
- `19.5 · Build in Public · Project View · Founder viewing · 1440`

### Proje başlığı
19.1 çerçevesinde üstte Proje özeti: yayın başlığı ve özeti, Proje logosu (varsa), `Approved snapshot`. Proje, Roadmap indeksi ve changelog indeksi için üç ayrı başlık/özet çifti vardır; hiçbiri ötekinden miras almaz. Alanlar ve miras kuralı `08.24 · Yayın başlığı, özeti ve adresi`'nde.
- **Label'lar:** `Build in Public` (ürün adı, alt bilgi düzeyinde); `Approved snapshot` (→ `19.1`); başlık/özet label'ları → `08.24`.

### Yüzey gezinmesi
Proje görünümü, Roadmap (19.6), changelog (19.7) arasında geçiş. Üçü aynı revizyondan gelir.
- **Label'lar:** `Roadmap`, `Changelog`; Proje görünümü sekmesi `Project`.

### Öne çıkarılmış kayıt
Kural `08.24 · Öne çıkarılan kayıt`'tadır (varsayılan kapalı, en fazla bir kayıt, bitiş zamanı); burada yalnız ziyaretçi görünümü: açıksa onaylı Proje Sürümü veya Karar üstte.
- **Label'lar:** `Featured`.

### Onaylı üyeler
Onaylı Belgeler, tasarımlar, Kararlar ve seçili Proje Duvarı snapshot'ları; her biri yalnız bu revizyondaki üyeler. Canlı Çalışma Alanı sorgusu yoktur.
- **Label'lar:** Kayıt türü başlıkları (`Documents`, `Decisions` vb. — mevcut UI adları).

### Gelişim akışı
Yalnız kurucunun onayladığı tarihsel olaylar, kronolojik; bir Roadmap farkı için yazılmış `Explain the change` notu aynı olaya bağlı görünür. Özel yorum, ilişki, taslak yoktur; otomatik metin üretilmez.
- **Label'lar:** Bölüm başlığı `Development feed`; `Explain the change` metni kurucunun yazdığı serbest metin olarak gösterilir (etiketin kendisi ziyaretçiye gösterilmez).

### Durumlar
#### Loading
19.1 Loading.
#### Empty
Yalnız Proje özeti yayımlanmışsa üye bölümleri hiç çizilmez; "henüz bir şey yok" sahte doluluğu veya boş bölüm başlığı yoktur.
#### Kurucu kendi sayfasında
Oturum açmış Proje sahibi aynı sayfayı açtığında yalnız ona görünen `Open source record` ve `Review publish diff` eylemleri kayıt ve sayfa düzeyinde belirir; snapshot'ta yerinde düzenleme yoktur. `Review publish diff` sayfa 08'deki yayın farkını açar. Ziyaretçi bu kontrolleri görmez.
#### Unpublished
URL → 19.9 `410 Gone`.

**Spec:** [75 Build in Public](../../specs/75-build-in-public/spec.md), [73 Link Sharing](../../specs/73-link-sharing/spec.md) (erişim adaptörü)

## 19.6 · Build in Public · Roadmap
> Projenin herkese açık Roadmap'ini iç durum adları yerine yalnız Herkese açık durum etiketleriyle göstermek.

**Artboard'lar**
- `19.6 · Build in Public · Roadmap · Default · 1440`
- `19.6 · Build in Public · Roadmap · Default · 768`
- `19.6 · Build in Public · Roadmap · Default · 390`
- —

### Roadmap başlığı
Başlık, etiketler ve gezinme `19.5`'teki gibi; fark: Roadmap indeksinin kendi başlık/özet çifti vardır (Proje'ninkini devralmaz; → `08.24`).
- **Label'lar:** `Roadmap` (diğerleri → `19.5`).

### Durum grupları
Herkese açık durum etiketlerine göre gruplanmış sütunlar veya bölümler (iç durumdan etikete eşleme `08.24 · Public Status Label eşlemesi`'ndedir, burada yalnız ziyaretçi görünümü): `Planned`, `In Progress`, `Completed`, `Released`; her İş kartında İşin herkese açık başlığı ve kısa özeti (yoksa onaylı başlık; alanlar `08.24 · Roadmap İşleri`'nde), Herkese açık durum etiketi, hedef tarih sunumu.
- **Label'lar:** `Planned`, `In Progress`, `Completed`, `Released`. İç adlar (`Not Started`, `Blocked`, `Closed`, `Abandoned`) hiçbir yerde görünmez.

### Durumlar
#### Loading
19.1 Loading.
#### Empty grup
Hiç İşi olmayan grup çizilmez.
#### Kurucu kendi sayfasında
→ `19.5`; fark: kurucuya yalnız kartlarda `Open source record`.
#### Unpublished
→ 19.9.

**Spec:** [75 Build in Public](../../specs/75-build-in-public/spec.md)

## 19.7 · Build in Public · Changelog
> Yayımlanmış Proje Sürümü notlarını ziyaretçiye kronolojik changelog olarak göstermek; Roadmap ve Proje görünümüyle aynı revizyondan.

**Artboard'lar**
- `19.7 · Build in Public · Changelog · Default · 1440`
- `19.7 · Build in Public · Changelog · Default · 390`
- —

390: aynı sütun tam genişlik.

### Changelog başlığı
Başlık, etiketler ve gezinme `19.5`'teki gibi; fark: Changelog indeksinin kendi başlık/özet çifti vardır (Proje'ninkini devralmaz; → `08.24`).
- **Label'lar:** `Changelog` (diğerleri → `19.5`).

### Sürüm girdileri
Girdi anatomisi `16.8 · Girdi listesi`'ndeki gibi, yalnız onaylı alanlarla. Ziyaretçi farkı: yeni→eski tek sütun; girdiye özgü başlık ve özet (alanlar `08.24`); `Why was this done?` izi yalnız onaylı snapshot olarak.
- **Label'lar:** `Release notes`, `Why was this done?`.

### Durumlar
#### Loading
19.1 Loading.
#### Empty
Yayımlanmış sürüm notu yoksa changelog sekmesi gezinmede görünmez.
#### Unpublished
→ 19.9.

**Spec:** [75 Build in Public](../../specs/75-build-in-public/spec.md), [65 Release Communication](../../specs/65-release-communication/spec.md) (not içeriği)

## 19.8 · Link Access Ended
> Süresi dolmuş bir bağlantıya veya sona ermiş Paylaşım erişim oturumuna gelen ziyaretçiye içerik ve yüzey bilgisi sızdırmadan erişimin bittiğini söylemek.

**Artboard'lar**
- `19.8 · Link Access Ended · Expired · 1440`
- `19.8 · Link Access Ended · Expired · 390`
- `19.8 · Link Access Ended · Session ended · 1440`

390: aynı blok tam genişlik.

### Mesaj
Tek kısa mesaj bloğu: tek cümlelik açıklama ve yeni bağlantı isteme yönlendirmesi. Paylaşılan kökün adı, kurucu adı, son onay zamanı veya snapshot önizlemesi yoktur. Alt bilgi (`19.1 · Alt bilgi`) bu ekranda çizilmez.
- **Label'lar:** `This link has expired.`, `Ask the person who sent the link for a new link.`

### Durumlar
#### Expired
Bağlantı süre dolumu. Kurucu daha sonra `Reopen the same link` derse aynı URL tekrar 19.2/19.3'e açılır; bu ekran bunu vaat etmez.
#### Session ended
Temiz URL'de oturum yok (12 saat doldu, tarayıcı kapandı, başka tarayıcı, parola değişti/kaldırıldı): ziyaretçiden özgün bağlantıyı yeniden açması istenir.
> Spec açığı: spec süre dolumu ile oturum bitişinin ziyaretçiye ayrı metinle gösterilip gösterilmeyeceğini söylemez. İkisi de içeriksiz kalmalıdır; iptal (`Revoke`) ve yayından kaldırma (`Unpublish`) bu ekranı değil 19.9'u kullanır.

**Spec:** [73 Link Sharing](../../specs/73-link-sharing/spec.md)

## 19.9 · 410 Gone
> `Revoke` ile iptal edilmiş (bağlantı paylaşımı), `Unpublish` ile yayından kaldırılmış (Wiki yayını, Build in Public) veya terminal iptal edilmiş (Proje/Çalışma Alanı/Hesap silme) her Dış yüzey URL'sinin genel, gövdesiz `410 Gone` yanıtını belgelemek. Bu ekran `410 Gone` kamuya açık davranışının sahibidir; yaşam döngüsü yönetimi (dizin, `Change expiry`, `Reactivate`, `Revoke`/`Unpublish`) → `02.13`.

**Artboard'lar**
- `19.9 · 410 Gone · Empty response · 1440`
- `19.9 · 410 Gone · Empty response · 390`
- —

390: aynı; ürün çerçevesi yok, tarayıcının boş gövdeli yanıt görünümü.

### Boş yanıt
Artboard `Empty response` (1440 ve 390). Ürün çerçevesi yok; yanıt gövdesi boştur ve `noindex` taşır. Ürün logosu, mesaj, eski başlık, yeni yüzeye veya özel içeriğe yönlendirme yoktur; URL hiçbir zaman yeniden kullanılmaz.
- **Label'lar:** Yok.

### Durumlar
#### Asset
Aynı yanıt görsel/PDF/video byte-range isteğinde de döner; daha önce açılmış sayfadaki medya bir sonraki istekte yüklenemez (19.1 Dosya Eki görüntüleyicinin `Unavailable` hâli değil, istek düzeyinde ret).

**Spec:** [73 Link Sharing](../../specs/73-link-sharing/spec.md), [74 Wiki Publishing](../../specs/74-wiki-publishing/spec.md), [75 Build in Public](../../specs/75-build-in-public/spec.md)
