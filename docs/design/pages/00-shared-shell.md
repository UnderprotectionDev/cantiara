# 00 · Shared Shell

Bütün ekranların içinde durduğu ortak uygulama kabuğu: üst çubuk, kişisel panel, komut paleti ve kayıt önizlemesi. Gezinme de burada.

| Ekran | Ne çizilir |
|---|---|
| [00.1 · App Frame](#001--app-frame) | üst çubuk, skip link, ana içerik alanı |
| [00.2 · Personal Shell Panel](#002--personal-shell-panel) | dört yüzeyli geçici panel |
| [00.3 · Active Working Set](#003--active-working-set) | oturumluk tepsi |
| [00.4 · Favorites List](#004--favorites-list) | panel içi Favori listesi |
| [00.5 · Notification Center](#005--notification-center) | iki bölümlü, kaynağa göre gruplu sinyaller |
| [00.8 · Command Palette](#008--command-palette) | komut ve kayıt dialog'u |
| [00.9 · Context Record Preview](#009--context-record-preview) | bağlam içi kayıt önizlemesi |
| [00.11 · Navigation](#0011--navigation) | Kurucunun gidebileceği her yer, tek gezinme yapısı |

## 00.1 · App Frame
> Kurucu her yetkili rotada aynı üst çubuğu ve tek odaklı ana içerik alanını görür; çerçeve hiçbir zaman ikinci bir dashboard olmaz.

**Artboard'lar**
- `00.1 · App Frame · Default · 1440`
- `00.1 · App Frame · Default · 768`
- `00.1 · App Frame · Default · Dark · 1440`
- `00.1 · App Frame · Default · Dark · 768`
- `00.1 · App Frame · More open · 1440`
- `00.1 · App Frame · Appearance menu open · 1440`
- `00.1 · App Frame · Skip link focused · 1440`
- `00.1 · App Frame · Public header · 1440`
- `00.1 · App Frame · Offline band · 1440`

### Skip link
Sayfanın ilk Tab durağı; odak alana kadar görünmez, odakta belirir.
- **Label'lar:** `Skip to main content`

### Gezinme
Üst çubuk, kişisel yüzeyler, proje alanları ve araç kümesinin tamamı [Navigation](00-shared-shell.md#0011--navigation) bölgesinde tek ve eksiksiz tanımlıdır; bu ekran onu çerçevenin içine yerleştirir. Burada yeniden tarif edilmez.
- **Bu ekrana özgü:** Gezinme, ana içerik alanı, geçici paneller (→ `00.2`) ve `Active Working Set` tepsisi (→ `00.3`) arasındaki yerleşim ve katman sırası.

### Ana içerik alanı
Etkin rotanın tek yüzeyi (örnek: Luma Project shell, `#work`); odaklanabilir hedef (`main-content`) budur.

### Çevrimdışı bant ve sonuç bildirimleri (yer tutucu)
Bağlantı kesildiğinde üst çubuğun hemen altında tam genişlikte, nazik duyurulu bant görünür; sonuç bildirimleri ekranın alt köşesinde yığılır. İçerik ve durumlar → `20.16 · Offline` ve `20.15 · Support Reference Error`.

### Durumlar
#### Loading
Üst çubuk hemen çizilir. `Account menu` yerinde yuvarlak bir yer tutucu durur. Ana içerik kendi yükleme durumunu gösterir.
#### Error
Korunan rotada oturum denetimi başarısız olursa üst çubukta yalnız wordmark kalır. İçerik alanında → `20.15 · Support Reference Error` görünür ve `Search` gösterilmez.
#### Public / oturumsuz krom
Login ve oturumsuz rotalarda üst çubukta yalnız `cantiara` wordmark'ı ve skip link bulunur. Gezinme, palet, `Search`, panel tetikleri ve Appearance yoktur. Ziyaretçi Dış yüzeylerinde kurucu paleti hiç yüklenmez (05).
#### Offline
Bant görünür, üst çubuk değişmez. Yazma yapan eylemler kendi yüzeylerinde reddedilir (→ `20`).
#### Many surfaces / dar çubuk
1440'ta tüm etiketler sığar. 768'de birincil gezinme `More` menüsüne katlanır. Yatay kaydırma gerekmez.

**Spec:** [72 Personal Shell](../../specs/72-personal-shell/spec.md), [03 Web and macOS Client](../../specs/03-web-macos-client/spec.md), [05 Command Palette](../../specs/05-command-palette/spec.md), [33 Record Discovery](../../specs/33-record-discovery/spec.md), [39 Favorites](../../specs/39-favorites/spec.md), [71 Attention Signals](../../specs/71-attention-signals/spec.md), [02 Account Preferences](../../specs/02-account-preferences/spec.md) (Appearance menüsü)

## 00.2 · Personal Shell Panel
> Kurucu açık Proje, kayıt ve kaynak görünüm konumunu kaybetmeden dört kişisel dikkat yüzeyine aynı geçici panelden geçer.

**Artboard'lar**
- `00.2 · Personal Shell Panel · Daily Focus · 1440`
- `00.2 · Personal Shell Panel · Daily Focus · 768`
- `00.2 · Personal Shell Panel · Favorites · 1440`
- `00.2 · Personal Shell Panel · Notification Center · 1440`
- `00.2 · Personal Shell Panel · Look again · 1440`
- `00.2 · Personal Shell Panel · Look again empty · 1440`
- `00.2 · Personal Shell Panel · Source view preserved · 1440`
- `00.2 · Personal Shell Panel · Notification Center · Dark · 1440`
- `00.2 · Personal Shell Panel · Favorites · Dark · 768`

### Panel başlığı
Seçili yüzeyin adı başlık olur; `Open full page` ve kapatma bulunur.
- **Label'lar:** `Daily Focus` / `Favorites` / `Notification Center` / `Look again`, `Open full page`

### Yüzey geçişi
Dört eş düzey sekme.
- **Label'lar:** `Daily Focus`, `Favorites`, `Notification Center`, `Look again`

### Yüzey · Daily Focus
Günlük Odak'ın bugünkü listesi, kendi sahibinin görünümüyle. İçerik ve eylemler → `Daily Focus` sayfası (27); burada yalnız panel içindeki sığdırma çizilir.
- **Label'lar:** `Daily Focus`, `Candidates`, `Open source record` (27'nin label'ları)

### Yüzey · Favorites
Favoriler listesi (39). Kuralları → `00.4`.

### Yüzey · Notification Center
Birleşik Bildirim Merkezi (71), varsayılan bölüm `Action Required`. Kuralları → `00.5`.

### Yüzey · Look again
Zamanı gelmiş `review-later` öğelerinin kaynak listesi. Üyelik ve tetik Hatırlatmaya aittir (35).

### Durumlar
#### Empty
Her yüzey kendi sahibinin boş metnini gösterir. Örnekler: `No Favorites yet.`, 27'nin `No Work in Daily Focus for this day.` metni. `Look again` için boş metin `Nothing to look at again.`
#### Loading
Seçili yüzeyin yükleme metni görünür (örnek `Loading Favorites…`). Başlık ve geçiş hemen çizilir.
#### Error
Yalnız seçili yüzey hata verir (örnek `Favorites are unavailable.`). Diğer sekmeler kullanılabilir kalır.
#### Kaynak görünüm korunur
Panel kapanınca alttaki Luma `#work` yüzeyi aynı scroll ve seçim durumundadır. Bu durum için iki karelik bir karşılaştırma artboard'u çizilir.
#### Yeni oturum
Panel kapalı başlar. Son açık yüzey, panel içi gezinme ve scroll geri gelmez.

**Spec:** [72 Personal Shell](../../specs/72-personal-shell/spec.md), [39 Favorites](../../specs/39-favorites/spec.md), [71 Attention Signals](../../specs/71-attention-signals/spec.md), [27 Daily Focus](../../specs/27-daily-focus/spec.md), [35 Personal Reminders](../../specs/35-personal-reminders/spec.md)

## 00.3 · Active Working Set
> Kurucu üzerinde çalıştığı İş ve Belgeleri kaynak görünüm bağlamını kaybetmeden küçültür ve tek eylemle yeniden açar; set yalnız açık oturumda yaşar.

**Artboard'lar**
- `00.3 · Active Working Set · Two items · 1440`
- `00.3 · Active Working Set · Collapsed · 1440`
- `00.3 · Active Working Set · Many items · 1440`

### Tepsi başlığı
Tepsinin adı ve üye sayısı, ardından kalıcı olmadığını anlatan kısa bir açıklama satırı (`Held for this session only.`).
- **Label'lar:** `Active Working Set`

### Üyeler
Her üye için türü (İş ya da Belge), anahtarı veya başlığı ve kapsamı.

### Durumlar
#### Empty
Tepsi kapalı kalır. Üst çubuktaki tetik pasif görünür. Ayrıca bir boş durum ekranı çizilmez.
#### Many items
Tepsi yatay kaydırılır. Sıra yalnız ekleme sırasıdır. Sıralama, tarih ve bildirim yoktur.
#### Oturum sonu
Yeni oturumda set boştur ve geri yükleme teklif edilmez.

**Spec:** [72 Personal Shell](../../specs/72-personal-shell/spec.md)

## 00.4 · Favorites List
> Kurucu kişisel Favori işaretli Proje, Belge, İş, Karar ve Akıllı Koleksiyonlarına kopya değil kaynak üzerinden döner.

**Artboard'lar**
- `00.4 · Favorites List · Default · 1440`
- `00.4 · Favorites List · Broken reference · 1440`
- `00.4 · Favorites List · Empty · 1440`
- `00.4 · Favorites List · Loading · 1440`
- `00.4 · Favorites List · Error · 1440`

### Favori satırı
Panelin açıklama satırı `Open your source records from Favorites.` altında liste; her satırda sırasıyla kaynak başlığı, tür, varsa kapsam ve yaşam işareti.
- **Label'lar:** `Open source record`

### Kırık referans satırı
Başlık ve içerik gösterilmez; yalnız durum metni, neden ve Favoriye eklenme zamanı (Hesap biçimiyle) görünür.
- **Label'lar:** `Source record is unavailable.`, `No access`, `Permanently deleted`

### Durumlar
#### Empty
`No Favorites yet.`
#### Loading
`Loading Favorites…`
#### Error
`Favorites are unavailable.`
#### Açma başarısız
Satırda `Source record is unavailable.` uyarısı görünür. Liste yenilenip kaynak erişilebilir dönerse eylem geri gelir ve panel açık kalır.

**Spec:** [39 Favorites](../../specs/39-favorites/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md), [33 Record Discovery](../../specs/33-record-discovery/spec.md)

## 00.5 · Notification Center
> Kapalı registry'deki Dikkat sinyalleri karar bekleyen ve bilgi akışı olarak ayrılmış, kaynağa göre gruplanmış tek merkezde görünür; okumak kaynağı çözmez.

**Artboard'lar**
- `00.5 · Notification Center · Action Required · 1440`
- `00.5 · Notification Center · Information Flow · 1440`
- `00.5 · Notification Center · Read and closed rows · 1440`
- `00.5 · Notification Center · Missing target · 1440`
- `00.5 · Notification Center · Deleted source · 1440`
- `00.5 · Notification Center · Empty · 1440`
- `00.5 · Notification Center · Full page · 1440`

### Bölüm seçici
İki bölüm; varsayılan olarak `Action Required` açılır. Her sinyal yalnız bir bölümdedir. `work-blocked` (`Needs Action` sınıfı) ve `external-run-returned` (dönen dış yürütme devri) da `Action Required` altında görünür, üçüncü bir bölüm yoktur.
- **Label'lar:** `Action Required`, `Information Flow`

### Kaynak grubu
Grup başlığında ana kaynağın başlığı, türü ve Projesi; altında o kaynağın sinyalleri ayrı satırlar halinde. Aynı kesin Kaynak sürümü değişikliği birden çok yerde kullanılıyorsa tek grup olur ve her kullanım kendi satırını ve inceleme kararını korur.

  Information Flow:
  - tidekit: `github-activity` ("PR #118 merged").
  - Bir Akıllı Koleksiyon: `smart-collection-entry` ("LUMA-58 entered").

### Sinyal satırı
Her satırda neden, kaynak olayı, zaman ve okunma/kapatılma durumu kendi başına korunur. Nedenleri üretici feature yazar, merkez yeniden yazmaz.
- **Label'lar:** `Open source record`, `Create Follow-up Work`
- **Kapalı sinyal türleri:** `due-date`, `reappear-date`, `personal-reminder`, `review-later`, `work-blocked`, `open-risk`, `smart-collection-entry`, `external-run-returned`, `handoff-result-after-cancel`, `unreviewed-test-report`, `test-result-conflict`, `source-version-in-use`, `unlinked-open-pr`, `work-pr-status-conflict`, `github-check-failed`, `github-activity`, `automation-failed`, `published-release-open-scope`, `release-observation-missing`; isteğe bağlı `public-roadmap-review-due` (Build in Public). Her türün hangi bölümde (`Action Required` / `Information Flow`) durduğu spec 71 kayıt defterindedir.

### Durumlar
#### Empty
Bölüm boşsa sessiz tek bir satır görünür. Metin `No signals in this section.`; metin "her şey yolunda" ya da "dikkat gerektiren her şey" iddiası taşımamalıdır.
#### Loading
Bölüm seçici hemen çizilir, gruplar yer tutucu satırlarla gelir.
#### Error
Merkezin okunamadığını söyleyen uyarı → `20.15 · Support Reference Error`.
#### Read / Closed
Okunmuş satır sessizleşir. Kapatılmış satır listeden çıkar ya da en sessiz halde kalır. Her iki durumda da kaynak kaydın durumu değişmez.
#### Missing target
Kesin olay artık çözülemiyorsa kayıt açılır ve kayıp hedef bir açıklama satırıyla belirtilir. Başka bir olaya sessizce kaydırılmaz.
#### Deleted source
Grup başlığı yerine güvenli bir mezar taşı satırı görünür: içerik ve başlık sızdırılmaz.
#### Many items
Gruplar kaydırılır. Grup sırası zaman sırasıdır. AI önem sıralaması ve sağlık puanı yoktur.

**Spec:** [71 Attention Signals](../../specs/71-attention-signals/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md), [33 Record Discovery](../../specs/33-record-discovery/spec.md)

## 00.8 · Command Palette
> Kurucu her yetkili bağlamdan klavyeyle komut çalıştırır, Proje değiştirir, kayıt oluşturur ve yetkili kayda atlar; Komut Paleti `Search` değildir.

**Artboard'lar**
- `00.8 · Command Palette · Default · 1440`
- `00.8 · Command Palette · Filtered · 1440`
- `00.8 · Command Palette · Choose a target · 1440`
- `00.8 · Command Palette · Can’t run this here · 1440`
- `00.8 · Command Palette · No matching command · 1440`
- `00.8 · Command Palette · Running · 1440`

### Başlık
İkon, başlık, amaç satırı ve `Esc` ipucu.
- **Label'lar:** `Command Palette`, `Run an authorized product command.`, `Esc`

### Hedef alt listesi başlığı
Komutun birden çok hedefi olduğunda görünür.
- **Label'lar:** `Back to commands`, `Choose a target`

### Giriş
Paletin sorgu alanı.
- **Label'lar:** Yer tutucu `Type a command or authorized record…`. Erişilebilir adı `Filter Command Palette commands`.

### Hata bandı
Komutun nedenli ve görünür başarısızlığı; hiçbir yazma yapılmaz.
- **Label'lar:** `Can’t run this here`. Neden metni ayrı satırda gelir, varsayılanı `The command could not be completed.`

### Komut listesi
İki grup: önce `Commands`, sonra `Authorized records`.
- **Label'lar:** `Commands`, `Authorized records`, `Switch Project`, `Create`, `Open Projects`, `Open Sessions`, `Open Preferences`, `Create <type>`, `Scope`, `Target`, `Selection`, `Menu:`, `Enter`

### Durumlar
#### Empty
`No matching command`
#### Loading
Giriş hemen odaklanır. `Authorized records` grubu bir kare sonra dolar, komutlar beklemez.
#### Error
Hata bandı `Can’t run this here` ve nedenle görünür. Liste açık kalır.
#### Choose a target
`Switch Project` → `Luma`, `tidekit`. `Create` → kayıt türleri.
#### Running
Satırın kısayol yerinde dönen gösterge belirir. Diğer satırlar pasifleşir.
#### Visitor
Dış yüzeyde palet yüklenmez. Çizim gerekmez, App Frame'in public header durumu bunu gösterir.
#### Tetik
Tetik [Navigation](00-shared-shell.md#0011--navigation) araç kümesinde durur: `Command Palette` etiketi ve `Ctrl+K` / `⌘K` ipucu; solunda `Switch Project` ve `Create` hızlı eylemleri paleti ilgili komutla açar. 768'de yalnız ikon kalır, hızlı eylemler gizlenir. Kısayol ipucu sessizdir ama okunur.

**Spec:** [05 Command Palette](../../specs/05-command-palette/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md)

## 00.9 · Context Record Preview
> Kaynak kayıt, bulunulan görünüm kaybedilmeden geçici bir yan panelde okunur; derin çalışma `Open full page` ile yapılır.

**Artboard'lar**
- `00.9 · Context Record Preview · Work · 1440`
- `00.9 · Context Record Preview · Document · 1440`
- `00.9 · Context Record Preview · Project read-only · 1440`
- `00.9 · Context Record Preview · Loading · 1440`
- `00.9 · Context Record Preview · Unavailable · 1440`

### Başlık
Açılan kaydın adı (eylem adı tekrar edilmez) ve açıklama satırı.
- **Label'lar:** `Temporary preview that keeps the current source view in place.`

### Gövde · Work
Sırasıyla açıklama, `Horizon`, `Planned start`, `Target date` ve varsa arşiv durumu. Koleksiyon oluşturma kontrolleri yoktur.
- **Label'lar:** `Horizon`, `Planned start`, `Target date`, `No description.`, `No horizon`

### Gövde · Document
Belge gövdesi; içindeki canlı İş referansları yine `Open source record` ile önizlemede açılır.
- **Label'lar:** `Loading document preview…`

### Gövde · Project / Smart Collection / Test Gap
Salt okunur özet. Smart Collection canlı koşulları korur, abonelik durumunu ilerletmez. Test Gap satırı `Test Gap · <state>` biçimindedir.

### Alt şerit
Panelin sabit alt şeridi.
- **Label'lar:** `Open full page`

### Durumlar
#### Loading
`Loading source record…`
#### Error
`Source record is unavailable.`
#### Archived / read-only
Arşiv işareti başlık altında görünür. Salt okunur kayıtlarda kişisel hatırlatma eylemleri yoktur.
#### Long content
Yalnız gövde kayar, başlık ve alt şerit sabit kalır.

**Spec:** [33 Record Discovery](../../specs/33-record-discovery/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md), [39 Favorites](../../specs/39-favorites/spec.md)

## 00.11 · Navigation
> Kurucunun gidebileceği **her** yeri tek yapıda tutmak. Hangi ekranda olunursa olunsun aynı yapı görünür; yalnız seçili öğe ve açık bölüm değişir.

**Artboard'lar**
- `00.11 · Navigation · Default · 1440`
- `00.11 · Navigation · Default · 768`
- `00.11 · Navigation · Default · 1440 · Dark`
- `00.11 · Navigation · Inside a Project · 1440`
- `00.11 · Navigation · Blank Project · 1440`
- `00.11 · Navigation · Configuration Mode · 1440`
- `00.11 · Navigation · Archived Project (Ferry) · 1440`
- `00.11 · Navigation · Tools open · 1440`
- `00.11 · Navigation · Account menu open · 1440`
- `00.11 · Navigation · Offline band · 1440`

**Biçim kararı (DS.0 #17):** yan gezinme, üst gezinme veya ikisinin birleşimi. Aşağıdaki yapı biçimden bağımsızdır; hangi grup nerede duracağı seçilen biçime göre yerleşir.

**Yapı (grup grup, içerik kesin)**

### Gruplar
- **Marka:** `cantiara` wordmark'ı `/projects` bağlantısıdır. Oturumsuz rotalarda yalnız wordmark ve skip link kalır.
- **Kişisel yüzeyler:** Etkin rota `aria-current="page"` taşır. `Daily Focus` varsayılan olarak Personal shell panelini açar; tam sayfa panelden `Open full page` ile açılır (→ `00.2`). PRD terim tablosuna göre `Projects`, `Daily Focus`, `Capture Inbox` birincil, diğerleri `More` altındadır; biçim kararı bunu belirler.
- **Proje seçimi:** `Switch Project` ve `Create` Komut Paletini ilgili komutla açar (→ `00.8`).
- **Proje alanları:** Daima erişilir girişler (`Overview`, `Tags`, `Smart Collection`, `All Tools`), etkin çekirdek alanlar, ince ayırıcı, pinli ek alanlar. Pinlenmemiş etkin alanlar yalnız `All Tools` içindedir (→ `08.2`). `Design` tek seferde bir iç hedef gösterir: `Project Wall`, `Screen`, `User Flow`, `Moodboard`. Seçili giriş `aria-current="location"`.
- **Configuration Mode:** Mod açıkken günlük yüzey ve gezinme yapılandırma yüzeyine döner; düğme `Exit Configuration Mode` olur (→ `08.13`).
- **Araçlar:** Komut Paleti tetiği `Open Command Palette (Ctrl+K)` / `⌘K`; `Search` (`Ctrl+/`) → `02.7`; `Favorites`, `Notification Center` → `00.2`; `Active Working Set` boşken pasif, doluyken üye sayısı (bildirim sayısı değildir) → `00.3`. `Notification Center` için okunmamış sayı rozeti çizilmez.
- **Hesap:** Appearance menüsü yalnız `Light` ve `Dark` taşır, `System` yoktur. `Account menu` 1440'ta `Deniz Aksoy`, 768'de `D` gösterir.
- **Skip link:** İlk Tab durağı; `Skip to main content` odağı ana içerik alanına taşır.

### Durumlar
#### Inside a Project
Proje alanı grubu görünür; `Luma` seçili. Kişisel grup yerinde kalır.
#### Blank Project
Yalnız `Overview`, `Tags`, `Smart Collection`, `All Tools`, `Work`, `Documents`; ayırıcı ve pinli alan yok.
#### Configuration Mode
Gezinme yapılandırma girişlerini gösterir; günlük yüzey girişleri pasif.
#### Archived Project
Proje seçili, arşiv işaretiyle; `Configuration Mode` pasif; yazma girişleri gizli (→ `08.27`).
#### Gizlenmiş alan
Alan gezinmeden düşer, `All Tools`'ta `Hidden` kalır. Kayıt silinmez.
#### Tools open
Her araç kendi paneliyle: Palette (→ `00.8`), Search (→ `02.7`), Favorites ve Notification Center (→ `00.2`), Working Set (→ `00.3`).
#### Offline
Gezinme değişmez; üstte bant (→ `20.16`).
#### 768
Birincil girişler kalır, geri kalanı katlanır; proje alanları yatay kaydırmaz, tek satırda sığar ya da menüye iner. Hiçbir hedef kaybolmaz.

**Spec:** [72](../../specs/72-personal-shell/spec.md), [07](../../specs/07-project-shell/spec.md), [05](../../specs/05-command-palette/spec.md), [33](../../specs/33-record-discovery/spec.md), [39](../../specs/39-favorites/spec.md), [71](../../specs/71-attention-signals/spec.md), [02](../../specs/02-account-preferences/spec.md), [83](../../specs/83-project-retirement/spec.md).
