# 00 · Shared Shell

Bütün ekranların içinde durduğu ortak uygulama kabuğu: üst çubuk, kişisel panel, komut paleti ve kayıt önizlemesi. Gezinme de burada.

| Ekran | Ne çizilir |
|---|---|
| [00.1 · App Frame](#001--app-frame) | üst çubuk, skip link, ana içerik alanı |
| [00.2 · Personal Shell Panel](#002--personal-shell-panel) | kişisel yüzeylerin geçici paneli: başlık, yüzey geçişi, kaynak görünüm korunur |
| [00.3 · Daily Focus](#003--daily-focus) | bugünkü liste popover'ı |
| [00.4 · Look again](#004--look-again) | zamanı gelmiş `review-later` öğeleri |
| [00.5 · Notification Center](#005--notification-center) | iki bölümlü, kaynağa göre gruplu sinyaller |
| [00.6 · Capture Inbox](#006--capture-inbox) | en eskiden başlayıp sırayla ayıklanan yakalama popover'ı |
| [00.7 · Drafts](#007--drafts) | yalnız İş taslakları popover'ı |
| [00.8 · Active Working Set](#008--active-working-set) | oturumluk tepsi |
| [00.9 · Favorites](#009--favorites) | panel içi Favori listesi |
| [00.10 · Command Palette](#0010--command-palette) | komut ve kayıt dialog'u |
| [00.11 · Context Record Preview](#0011--context-record-preview) | bağlam içi kayıt önizlemesi |
| [00.12 · Navigation](#0012--navigation) | Kurucunun gidebileceği her yer, tek gezinme yapısı |

Numaralandırma: `00.3`–`00.7` "Comes to me" araçlarıdır, `00.8` ve `00.9` "Kept by me" araçlarıdır. Varyantlar harf almaz: artboard adı `00.N · <Bölüm> · <varyant>` biçimindedir. Birden çok bölümü kapsayan panolar numarasızdır ve `Reference · …` adını taşır.


## 00.1 · App Frame
> Kurucu her yetkili rotada aynı üst çubuğu ve tek odaklı ana içerik alanını görür; çerçeve hiçbir zaman ikinci bir dashboard olmaz.


**Artboard'lar**
- `00.1 · App Frame · Clean list`
- `00.1 · App Frame · Keyboard focus path`
- `00.1 · App Frame · Offline band`
- `00.1 · App Frame · Assign to… popover`
- `00.1 · App Frame · Filter menu + Display options`
- `00.1 · App Frame · Account menu open · Appearance + workspace`
- `00.1 · App Frame · Focus order note`
- `00.1 · App Frame · Focus mode (sidebar hidden, ⌘\)`
- `00.1 · App Frame · 768 · Sidebar as drawer`
- `00.1 · App Frame · 768 · Drawer closed`
- `00.1 · App Frame · Loading`
- `00.1 · App Frame · Session unavailable`

### Skip link
Tanım ve label → `00.12 · Navigation` › Skip link. Bu ekran odak yolunu `Keyboard focus path` artboard'unda çizer.

### Gezinme
Üst çubuk, kişisel yüzeyler, proje alanları ve araç kümesinin tamamı [Navigation](00-shared-shell.md#0012--navigation) bölgesinde tek ve eksiksiz tanımlıdır; bu ekran onu çerçevenin içine yerleştirir. Burada yeniden tarif edilmez.
- **Bu ekrana özgü:** Gezinme, ana içerik alanı, geçici paneller (→ `00.2`) ve `Active Working Set` tepsisi (→ `00.8`) arasındaki yerleşim ve katman sırası.

### Ana içerik alanı
Etkin rotanın tek yüzeyi (örnek: Luma Project shell, `#work`); odaklanabilir hedef (`main-content`) budur.

### More menüsü
Bu ekran `More` menüsünü ayrı artboard olarak çizmez. İçerik tek yerde tanımlıdır: kişisel yüzeyler (`Drafts` → `02.10`, `Contacts` → `06.1`) ve Çalışma Alanı yönetimi grubu → `00.12 · Navigation` › Gruplar. Bu ekran yalnız menünün konumunu ve katman sırasını belirler.

### Appearance menüsü
`Account menu open · Appearance + workspace` artboard'ı Appearance seçicisini hesap menüsüyle birlikte çizer. Değerler (`Light`, `Dark`; `System` yok) ve kural → `01.6 · Preferences`; tetik yeri → `01.3 · Account menu`. Label bu ekranda yeniden yazılmaz.

### Çevrimdışı bant ve sonuç bildirimleri
Katman sırası: bant üst çubuğun hemen altında tam genişlikte durur; sonuç bildirimleri ekranın alt köşesinde yığılır. İçerik ve durumlar → `20.16 · Offline` ve `20.15 · Support Reference Error` (aynı mantık `00.12 › Offline`).

### Durumlar
#### Loading
`Loading` artboard'ı. Üst çubuk hemen çizilir. `Account menu` yerinde yuvarlak bir yer tutucu durur. Ana içerik kendi yükleme durumunu gösterir.
#### Error
`Session unavailable` artboard'ı. Korunan rotada oturum denetimi başarısız olursa üst çubukta yalnız wordmark kalır. İçerik alanında → `20.15 · Support Reference Error` görünür ve `Search` gösterilmez.
#### Public / oturumsuz krom
İçerik → `00.12 · Navigation` › Marka. Bu ekran için ayrı artboard çizilmez.
#### Offline
İçerik → `00.12 · Navigation` › Offline ve `20.16`. `Offline band` artboard'ı bandın çerçevedeki katman sırasını çizer.
#### Many surfaces / dar çubuk
768 katlanması → `00.12 · Navigation` › 768. `768 · Sidebar as drawer` ve `768 · Drawer closed` artboard'ları çizilir.

**Spec:** [72 Personal Shell](../../specs/72-personal-shell/spec.md), [03 Web and macOS Client](../../specs/03-web-macos-client/spec.md), [05 Command Palette](../../specs/05-command-palette/spec.md), [33 Record Discovery](../../specs/33-record-discovery/spec.md), [39 Favorites](../../specs/39-favorites/spec.md), [71 Attention Signals](../../specs/71-attention-signals/spec.md), [02 Account Preferences](../../specs/02-account-preferences/spec.md) (Appearance menüsü)

## 00.2 · Personal Shell Panel
> Kurucu açık Proje, kayıt ve kaynak görünüm konumunu kaybetmeden kişisel dikkat yüzeylerine aynı geçici panelden geçer.

Bu bölüm yalnız panel kabuğunu tanımlar; her yüzeyin kendi artboard'ları kendi bölümündedir: Daily Focus → `00.3`, Look again → `00.4`, Notification Center → `00.5`, Capture Inbox → `00.6`, Drafts → `00.7`, Favorites → `00.9`.

**Artboard'lar**
- `Reference · Tool popovers and record tabs · Dark`
- `Reference · Personal panel popovers`

### Panel başlığı
Seçili yüzeyin adı başlık olur (adlar → Yüzey geçişi); `Open full page` ve kapatma bulunur.
- **Sayım:** `Daily Focus` başlığı kenar çubuğu rozetiyle aynı sayıyı (`2/3`, biten/toplam) ve ilerleme çubuğunu, `Look again` başlığı kenar çubuğu rozetiyle aynı sayıyı gösterir. Panelin içeriği bu sayıyı açıklar: Daily Focus listesi biten ve bekleyen satırları, Look again listesi sayılan öğeleri gösterir.
- **Label'lar:** `Open full page`

### Yüzey geçişi
Dört eş düzey sekme.
- **Label'lar:** `Daily Focus`, `Favorites`, `Notification Center`, `Look again`

### Popover düzeni
`Daily Focus`, `Capture Inbox`, `Drafts` ve `Notification Center` popover'ları aynı düzeni paylaşır: başlık → öne çıkan kart → `Then` satırları → alt şerit. Liste satırlarında tarih `Day N · N d` biçimindedir. Sağdaki bölmeler overlay kaydırma çubuğu gösterir; çubuk içeriği daraltmaz. Klavye kısayol ipucu sistemi kaldırılmıştır; yalnız Komut Paleti tetiğindeki `⌘K` ve Command Palette'in kendi içi (`Esc`, `Enter`) kalır.
- **Spec'e eklenecek etiketler:** `Then` (Paper'da var, spec'te yok).

### Yüzeyler
Her yüzeyin içeriği ve eylemleri kendi bölümündedir; burada yalnız panel içindeki sığdırma çizilir: Daily Focus → `00.3`, Look again → `00.4`, Notification Center → `00.5`, Favorites → `00.9`.

### Durumlar
#### Empty
Her yüzey kendi sahibinin boş metnini gösterir: Favorites → `00.9`, Daily Focus → `04.1`, `Look again` → `00.4`.
#### Loading
Seçili yüzeyin yükleme metni görünür (Favorites → `00.9`; `Look again` → `00.4`). Başlık ve geçiş hemen çizilir.
#### Error
Yalnız seçili yüzey hata verir (Favorites → `00.9`; `Look again` → `00.4`). Diğer sekmeler kullanılabilir kalır.
#### Kaynak görünüm korunur
Panel kapanınca alttaki Luma `#work` yüzeyi aynı scroll ve seçim durumundadır. Bu durum için iki karelik bir karşılaştırma artboard'ı çizilir.
#### Yeni oturum
Panel kapalı başlar. Son açık yüzey, panel içi gezinme ve scroll geri gelmez.

**Spec:** [72 Personal Shell](../../specs/72-personal-shell/spec.md), [39 Favorites](../../specs/39-favorites/spec.md), [71 Attention Signals](../../specs/71-attention-signals/spec.md), [27 Daily Focus](../../specs/27-daily-focus/spec.md), [35 Personal Reminders](../../specs/35-personal-reminders/spec.md)

## 00.3 · Daily Focus
> Kurucu bugünkü Günlük Odak listesini panelden, kendi sahibinin görünümüyle okur ve kaynak kayda tek eylemle geçer.

**Artboard'lar**
- `00.3 · Daily Focus · Daily plan, reasoned suggestions`
- `00.3 · Daily Focus · Popover · Up next first`
- `00.3 · Daily Focus · Popover states`
- `00.3 · Daily Focus · Day closed`

### Yüzey
Günlük Odak'ın bugünkü listesi. İçerik ve eylemler → `04.1`; burada yalnız panel içindeki sığdırma çizilir. Popover düzeni → `00.2 › Popover düzeni`. `Day closed` artboard'ı günün kapandığı hali çizer; kapanış akışı → `04.2`.
- **Label'lar:** `Daily Focus`, `Candidates`, `Open source record` (`04.1`'in label'ları)

**Spec:** [27 Daily Focus](../../specs/27-daily-focus/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md)

## 00.4 · Look again
> Kurucu zamanı gelmiş `review-later` öğelerini kaynak kaydı kopyalamadan tek listede görür.

**Artboard'lar**
- `00.4 · Look again · Popover`
- `00.4 · Look again · Popover states`
- `00.4 · Look again · Document pinned · Tab menu`

### Yüzey
Zamanı gelmiş `review-later` öğelerinin kaynak listesi. Üyelik ve tetik Hatırlatmaya aittir (35). Her satırda sırasıyla kaynak başlığı, tür, kapsam ve tetiklenme zamanı; satır eylemi `Open source record` (spec 72, Record Discovery ortak eylemi).
- **Label'lar:** `Open source record`, `Nothing to look at again.`, `Loading Look again items…`, `Look again items are unavailable.`

**Spec:** [35 Personal Reminders](../../specs/35-personal-reminders/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md), [33 Record Discovery](../../specs/33-record-discovery/spec.md)


## 00.5 · Notification Center
> Kapalı registry'deki Dikkat sinyalleri karar bekleyen ve bilgi akışı olarak ayrılmış, kaynağa göre gruplanmış tek merkezde görünür; okumak kaynağı çözmez.


**Artboard'lar**
- `00.5 · Notification Center · Popover · Action Required first`
- `00.5 · Notification Center · Popover states`
- `00.5 · Notification Center · Triage split`
- `00.5 · Notification Center · Full page`
- `00.5 · Notification Center · Zero state`

### Bölüm seçici
İki bölüm; varsayılan olarak `Action Required` açılır. Her sinyal yalnız bir bölümdedir. `work-blocked` (`Needs Action` sınıfı) ve `external-run-returned` (dönen dış yürütme devri) da `Action Required` altında görünür, üçüncü bir bölüm yoktur.
- **Label'lar:** `Action Required`, `Information Flow`

### Kaynak grubu
Grup başlığında ana kaynağın başlığı, türü ve Projesi; altında o kaynağın sinyalleri ayrı satırlar halinde. Aynı kesin Kaynak sürümü değişikliği birden çok yerde kullanılıyorsa tek grup olur ve her kullanım kendi satırını ve inceleme kararını korur.

  Information Flow:
  - tidekit: `github-activity` ("PR #118 merged").
  - Bir Akıllı Koleksiyon: `smart-collection-entry` ("LUMA-58 entered").

### Sinyal satırı
Her satırda neden, kaynak olayı, zaman ve okunma/kapatılma durumu kendi başına korunur. Nedenleri üretici feature yazar, merkez yeniden yazmaz. Satırda okundu işaretleme ve kapatma eylemleri bulunur; ikisi de kaynak kaydın sonucunu değiştirmez (→ Durumlar › Read / Closed). Okundu ve kapatma eylemlerinin label'ı spec 71'de yoktur; `personal-reminder` satırında kapatma eylemi `Dismiss`'tir (PRD 02). Diğer sinyal türlerinde okundu işaretleme `Mark as read` (okunmuşu geri alan `Mark as unread`), kapatma `Close` (mevcut ad, yeni bağlam: Odak Dönemi `Close` ile aynı label; PRD 02:169). Ek durum label'ı yoktur; `Read` / `Closed` yalnız görsel sessizleşmedir.
- **Label'lar:** `Open source record`, `Create Follow-up Work`, `Dismiss` (yalnız `personal-reminder`), `Mark as read`, `Mark as unread`, `Close`
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
#### Full page
`Open full page` ile açılan tam sayfa aynı iki bölümü, aynı gruplamayı ve aynı satır eylemlerini taşır; panelden farkı yalnız genişliktir ve yeni label yoktur.
#### Many items
Gruplar kaydırılır. Grup sırası zaman sırasıdır. AI önem sıralaması ve sağlık puanı yoktur.

**Spec:** [71 Attention Signals](../../specs/71-attention-signals/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md), [33 Record Discovery](../../specs/33-record-discovery/spec.md)

## 00.6 · Capture Inbox
> Kurucu yakalanmış, henüz ana kayda dönüşmemiş öğeleri en eskiden başlayarak sırayla üç çıkıştan biriyle ayıklar.

**Artboard'lar**
- `00.6 · Capture Inbox · One card triage`
- `00.6 · Capture Inbox · Popover`
- `00.6 · Capture Inbox · Popover states`

### Popover
Başlık → öne çıkan kart → kalan öğe satırları → alt şerit. Öne çıkan kart en eski öğedir: yakalanan içerik (bağlantıysa bağlantı önizlemesiyle), hangi Inbox'tan geldiğini söyleyen `Inbox` satırı ve üç çıkış eylemi `Convert`, `Attach to existing`, `Delete`. Altında diğer öğeler satır olarak sıralanır. Alt şeritte `Sequential triage` ve `Open full page` bulunur. Üç çıkışın kuralları ve önizlemeleri → `03.3`, `03.4`; Sıralı triage → `03.5`; tam sayfa → `03.1`. `One card triage` artboard'ı tek karta odaklı görünümü çizer.
- **Label'lar:** `Capture Inbox`, `Convert`, `Attach to existing`, `Delete`, `Sequential triage`, `Open full page`
- **Spec'e eklenecek etiketler:** `Oldest first` (öne çıkan kartın sıralama ipucu) ve `Inbox` satır etiketi; ikisi de Paper'da var, spec 06'da yok. (`Then` → `00.2 › Popover düzeni`.)

### Durumlar
`Popover states` artboard'ı popover'ın boş, yükleme ve hata hallerini toplar; metinleri → `03.1`. Bu bölüm yeni label üretmez.

**Spec:** [06 Capture Triage](../../specs/06-capture-triage/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md)

## 00.7 · Drafts
> Kurucu yarım kalmış İş formlarını popover'dan bulur, kaldığı yerden sürdürür ya da siler; Taslak ana kayıt değildir.

**Artboard'lar**
- `00.7 · Drafts · Popover`
- `00.7 · Drafts · Popover states`

### Popover
Başlık → öne çıkan kart → `Earlier` satırı → alt şerit. Popover yalnız İş taslaklarını listeler. Öne çıkan kart en son düzenlenen taslaktır: doldurulmuş alanları gösteren bir ölçer, `Last saved` zamanı, `Resume` ve `Delete`. `Earlier` satırı daha eski taslakları tutar. Alt şeritte "Kept until you create or delete" notu ve `Open full page` bulunur; taslak süreyle silinmez (→ `02.10`).
- **Label'lar:** `Drafts`, `Last saved`, `Open full page`
- **Spec'e eklenecek etiketler:** `Resume`, `Delete` (Drafts bağlamında; spec 11 yalnız `Draft`, `Drafts`, `Create`, `Last saved`, `Unsaved changes may be lost` der), `Earlier`, `Kept until you create or delete`. Hepsi Paper'da var, spec 11'de yok.

### Durumlar
`Popover states` artboard'ı popover'ın boş, yükleme ve hata hallerini toplar; kurallar → `02.10`. Bu bölüm yeni label üretmez.

**Spec:** [11 Work Drafts](../../specs/11-work-drafts/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md)


## 00.8 · Active Working Set
> Kurucu üzerinde çalıştığı İş ve Belgeleri kaynak görünüm bağlamını kaybetmeden küçültür ve tek eylemle yeniden açar; set yalnız açık oturumda yaşar.

**Artboard'lar**
- `00.8 · Active Working Set · Recency group · Open`
- `00.8 · Active Working Set · Collapsed rail`
- `00.8 · Active Working Set · Empty and collapsed states`

### Tepsi başlığı
Tepsinin adı ve üye sayısı, ardından kalıcı olmadığını anlatan kısa bir açıklama satırı (`Held for this session only.`).
- **Label'lar:** `Active Working Set`

### Üyeler
Her üye için türü (İş ya da Belge), anahtarı veya başlığı ve kapsamı. Üye eklenir ve çıkarılır; bu kaynak kaydı ya da planlama yüzeylerini değiştirmez, Favori ya da Günlük Odak değildir. Küçültülmüş tepsi ve üyeler kaynak görünüm bağlamı kaybedilmeden tek eylemle yeniden açılır. Üye ekleme ve çıkarma eylemlerinin label'ı spec'te yoktur (spec 72 yeni label'ları PRD 02 sözlüğüne eklemeyi şart koşar).
- **Sabitlenmiş üye:** Sabitlenmiş üyede pin, durum ikonunun köşesinde küçük rozet olarak görünür; ikonun yerini ve boyutunu değiştirmez. Küçültülmüş rail'de (`Collapsed rail`) de aynı rozet kullanılır. Sabitleme eyleminin label'ı spec'te yoktur (spec 72 kararı bekliyor).
- **Üye ekleme/çıkarma:** yalnız İş ve Belge kayıt başlığının taşma menüsünden (→ `DS.11`): `Add to Active Working Set` / `Remove from Active Working Set`. Arşivli ve Çöp Kutusu'ndaki kayıtta gizlidir.
- **Küçültme/yeniden açma:** tepsi başlığında `Collapse` (mevcut ad, yeni bağlam: CONTEXT.md ve PRD 02:772'deki `Collapse`); küçültülmüş tepsinin tetiği `Show tray` (`Reopen` İş yeniden açma eylemiyle karışacağı için kullanılmaz) (`Collapsed` artboard'ı).
- **Label'lar:** `Add to Active Working Set`, `Remove from Active Working Set`, `Collapse`, `Show tray`

### Durumlar
#### Empty
Tepsi kapalı kalır. Üst çubuktaki tetik pasif görünür. Ayrıca bir boş durum ekranı çizilmez.
#### Many items
Tepsi yatay kaydırılır. Sıra yalnız ekleme sırasıdır. Sıralama, tarih ve bildirim yoktur.
#### Oturum sonu
Yeni oturumda set boştur ve geri yükleme teklif edilmez.

**Spec:** [72 Personal Shell](../../specs/72-personal-shell/spec.md)

## 00.9 · Favorites
> Kurucu kişisel Favori işaretli Proje, Belge, İş, Karar ve Akıllı Koleksiyonlarına kopya değil kaynak üzerinden döner.

**Artboard'lar**
- `00.9 · Favorites · Opens a transient tab`
- `00.9 · Favorites · Drag a Work row to add`
- `00.9 · Favorites · Expanded`
- `00.9 · Favorites · Removed (undo)`

### Favori satırı
Panelin açıklama satırı `Open your source records from Favorites.` altında liste; her satırda sırasıyla kaynak başlığı, tür, varsa kapsam ve yaşam işareti.
- **Label'lar:** `Open source record`, `Remove from Favorites`

### Kırık referans satırı
`Broken reference` artboard'ı bu satırı çizer (iki alt durum: `Missing target`, `Deleted source`). Kırık uç gösterimi (neden etiketleri, içerik sızdırmama, `Open source record` koşulu) → `20.10 › Kırık uç`. Bu ekrana özgü: satırda Favoriye eklenme zamanı (Hesap biçimiyle) görünür ve üyelik kaynak kaybolsa da kaldırılabilir.
- **Label'lar:** `Source record is unavailable.`, `Remove from Favorites`

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

## 00.10 · Command Palette
> Kurucu her yetkili bağlamdan klavyeyle komut çalıştırır, Proje değiştirir, kayıt oluşturur ve yetkili kayda atlar; Komut Paleti `Search` değildir.

**Artboard'lar**
- `00.10 · Command Palette · Default · Context commands`
- `00.10 · Command Palette · Choose a target`
- `00.10 · Command Palette · No matching command`
- `00.10 · Command Palette · Live preview`
- `00.10 · Command Palette · Create target`
- `00.10 · Command Palette · Natural-language create`
- `00.10 · Command Palette · Nested page · Change status`

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
- **Label'lar:** `Commands`, `Authorized records`, `Switch Project`, `Create`, `Open Projects`, `Open Sessions`, `Open Preferences`, `Open Contacts`, `Create <type>`, `Copy Context as Markdown` (İş Bağlam Kartı bağlamını panoya aktarır; spec 16), `Scope`, `Target`, `Selection`, `Menu:`, `Enter`

### Durumlar
#### Empty
`No matching command`
#### Filtered
Sorgu yazılınca `Commands` ve `Authorized records` grupları filtrelenir, eşleşmeyen grup gizlenir; hiç eşleşme yoksa `No matching command`.
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
Tetik [Navigation](00-shared-shell.md#0012--navigation) araç kümesinde tanımlıdır (→ `00.12` › Araçlar); burada yeniden tarif edilmez.

**Spec:** [05 Command Palette](../../specs/05-command-palette/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md)

## 00.11 · Context Record Preview
> Kaynak kayıt, bulunulan görünüm kaybedilmeden sağda sabitlenen (docked) bir yan panelde okunur; panel listeyi örtmez, derin çalışma `Open full page` ile yapılır.

**Artboard'lar**
- `00.11 · Context Record Preview · Docked · Blocked Work`
- `00.11 · Context Record Preview · Step through records (j/k)`
- `00.11 · Context Record Preview · Quick Peek (held with Space)`
- `00.11 · Context Record Preview · Space to peek (Work list)`
- `00.11 · Context Record Preview · In Review Work (docked)`
- `00.11 · Context Record Preview · Record pane canonical (tabs, pin, state card)`
- `00.11 · Context Record Preview · Blocked · Next-step handoff`
- `00.11 · Context Record Preview · Archived`
- `00.11 · Context Record Preview · Long content`
- `00.11 · Context Record Preview · Wide pane · In Review (GitHub line)`
- `00.11 · Context Record Preview · Loading`
- `00.11 · Context Record Preview · Error`

### Başlık
Açılan kaydın adı (eylem adı tekrar edilmez) ve açıklama satırı.
- **Label'lar:** `Temporary preview that keeps the current source view in place.`

### Yerleşim ve Quick Peek
Panel listenin üstüne binen bir katman değildir; sağda yer açar ve liste daralır (overlay yerleşimi denendi ve reddedildi: liste sütunlarını örtüyor, ipucu balonu başlığı kapatıyordu). Panelin içeriği kaydın durumuna göre değişir (örnek: Blocked Work'te engelleyen kayıt kartı, In Review Work'te bekleyen dış kontrol kartı). `j/k` ile komşu satıra geçilir. Satırda Space basılı tutulunca aynı panel geçici görünür, bırakınca kapanır ve sekme oluşmaz; `Keep open` onu normal `Preview` sekmesine çevirir. Azaltılmış hareket tercihinde panel yalnız opaklıkla belirir.
- **Açık karar:** Docked yerleşim, Quick Peek, `Keep open` ve sabitleme spec'te yoktur; label'lar spec 72'de karara bağlanmadan kodda kullanılmaz.

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
Yalnız gövde kayar, başlık ve alt şerit sabit kalır. Kaydırma çubuğu overlay'dir; içeriği daraltmaz.

**Spec:** [33 Record Discovery](../../specs/33-record-discovery/spec.md), [72 Personal Shell](../../specs/72-personal-shell/spec.md), [39 Favorites](../../specs/39-favorites/spec.md)

## 00.12 · Navigation
> Kurucunun gidebileceği **her** yeri tek yapıda tutmak. Hangi ekranda olunursa olunsun aynı yapı görünür; yalnız seçili öğe ve açık bölüm değişir.

**Artboard'lar**
- `00.12 · Navigation · Blank Project`
- `00.12 · Navigation · Archived Project`
- `00.12 · Navigation · Loading project areas`
- `00.12 · Navigation · Configuration Mode`

**Biçim kararı (DS.0 #17):** yan gezinme, üst gezinme veya ikisinin birleşimi. Aşağıdaki yapı biçimden bağımsızdır; hangi grup nerede duracağı seçilen biçime göre yerleşir.

**Yapı (grup grup, içerik kesin)**

### Gruplar
- **Kenar çubuğu görünümü:** Yalnız `Comes to me` kartı ve açık Proje kartlıdır; seçim yalnız dolguyla gösterilir (yan çentik yok); satırların altında ikinci satır yoktur. Klavye kısayol ipucu yalnız Komut Paleti tetiğindeki `⌘K`'dır.
- **Marka:** `cantiara` wordmark'ı `/projects` bağlantısıdır. Login ve oturumsuz rotalarda üst çubukta yalnız wordmark ve skip link kalır; gezinme, palet, `Search`, panel tetikleri ve Appearance yoktur. Ziyaretçi Dış yüzeylerinde kurucu paleti hiç yüklenmez (05).
- **Kişisel yüzeyler:** Etkin rota `aria-current="page"` taşır. `Daily Focus` varsayılan olarak Personal shell panelini açar; tam sayfa panelden `Open full page` ile açılır (→ `00.2`). PRD terim tablosuna göre `Projects`, `Daily Focus`, `Capture Inbox` birincil, diğerleri `More` altındadır; biçim kararı bunu belirler. `More` altında en az `Drafts` (→ `02.10`; Create Work formundaki `Drafts` bağlantısı da aynı yüzeye gider, → `09.11`) ve `Contacts` (→ `06.1`; 768'de de `More`'da) bulunur. Tam `More` listesi spec 72'nindir. Emekli kimlik Contacts girişinde sonuç olarak sayılmaz.
- **Label'lar:** `Drafts`, `Contacts`
- **Çalışma Alanı yönetimi:** Hesap menüsü içinde ya da `More` altında yer alan grup (konumu çizen karar verir); girişler `Trash` (→ `02.11`), `Shares and Publications` (→ `02.13`), `Workspace Exit Package` (→ `02.14`), `Archive` (Arşivli Projeler, → `08.27`). Hepsi 768'de `More`'a iner. Proje içindeyken `Shares and Publications` Proje kapsamlı giriş olarak önceden Proje filtreli `02.13`'ü açar; Proje `Archive` girişi → `08.26`.
  - **Label'lar:** `Trash`, `Shares and Publications`, `Workspace Exit Package`, `Archive`
- **Proje seçimi:** `Switch Project` ve `Create` Komut Paletini ilgili komutla açar (→ `00.10`).
- **Proje alanları:** Daima erişilir girişler (`Overview`, `Tags`, `Smart Collection`, `All Tools`), etkin çekirdek alanlar, ince ayırıcı, pinli ek alanlar. Pinlenmemiş etkin alanlar yalnız `All Tools` içindedir (→ `08.2`). `Design` tek seferde bir iç hedef gösterir (iç hedef listesi → `13.1`). Seçili giriş `aria-current="location"`.
- **Configuration Mode:** Mod açıkken günlük yüzey ve gezinme yapılandırma yüzeyine döner; düğme Proje başlığındadır (→ `08.1`); açıkken etiketi `Exit Configuration Mode` olur (→ `08.1`).
- **Araçlar:** Komut Paleti tetiği `Command Palette` etiketi ve `Ctrl+K` / `⌘K` ipucu, solunda `Switch Project` ve `Create` hızlı eylemleri; 768'de yalnız ikon kalır, hızlı eylemler gizlenir; `Search` → `02.7`; `Favorites` → `00.9`, `Notification Center` → `00.5`; `Active Working Set` boşken pasif, doluyken üye sayısı (bildirim sayısı değildir) → `00.8`. `Notification Center` için okunmamış sayı rozeti çizilmez.
- **Hesap:** `Account menu` tetiği 1440'ta `Alex Morgan`, 768'de `A` gösterir. Açık menü içeriği ve artboard'ı → `01.3`; Appearance değerleri (`Light`/`Dark`) → `01.6`.
- **Skip link:** İlk Tab durağı; `Skip to main content` odağı ana içerik alanına taşır.

### Durumlar
#### Inside a Project
Proje alanı grubu görünür; `Luma` seçili. Kişisel grup yerinde kalır.
#### Blank Project
Yalnız `Overview`, `Tags`, `Smart Collection`, `All Tools`, `Work`, `Documents`; ayırıcı ve pinli alan yok.
#### Configuration Mode
Gezinme yapılandırma girişlerini gösterir; günlük yüzey girişleri pasif.
#### Archived Project
Proje seçili, arşiv işaretiyle; `Configuration Mode` pasif; yazma girişleri gizli (Arşivli Proje gezinmesi → `08.1`, bant → `20.21`).
#### Loading / Error
Proje rotası yüklenirken üst çubuk ve kişisel yüzeyler hemen çizilir, Proje alanı grubu iskelet olarak gelir; içerik alanı kendi yüklemesini gösterir. Proje okunamazsa Proje alanı grubu çizilmez, kişisel yüzeyler yerinde kalır; hata metni ve yeniden deneme içerik alanındadır (→ `08.1 › Durumlar`).
#### Gizlenmiş alan
Alan gezinmeden düşer, `All Tools`'ta `Hidden` kalır. Kayıt silinmez.
#### Tools open
Her araç kendi paneliyle: Palette (→ `00.10`), Search (→ `02.7`), Favorites (→ `00.9`), Notification Center (→ `00.5`), Working Set (→ `00.8`).
#### Offline
Gezinme ve üst çubuk değişmez; üstte bant görünür (→ `20.16`). Yazma yapan eylemler kendi yüzeylerinde reddedilir (→ `20.16`).
#### 768
1440'ta tüm etiketler sığar. 768'de birincil girişler kalır, geri kalanı `More` menüsüne katlanır; proje alanları yatay kaydırmaz, tek satırda sığar ya da menüye iner. Hiçbir hedef kaybolmaz.

**Spec:** [72](../../specs/72-personal-shell/spec.md), [07](../../specs/07-project-shell/spec.md), [05](../../specs/05-command-palette/spec.md), [33](../../specs/33-record-discovery/spec.md), [39](../../specs/39-favorites/spec.md), [71](../../specs/71-attention-signals/spec.md), [02](../../specs/02-account-preferences/spec.md), [83](../../specs/83-project-retirement/spec.md), [11](../../specs/11-work-drafts/spec.md), [46](../../specs/46-contact-and-company/spec.md), [76](../../specs/76-external-surface-management/spec.md), [77](../../specs/77-trash/spec.md), [82](../../specs/82-workspace-exit/spec.md).