# 01 · Account

Hesap düzeyi yüzeyler: giriş, oturumlar, tercihler ve Hesabı kapatma.

| Ekran | Ne çizilir |
|---|---|
| [01.1 · Login](#011--login) | tek düğmeli GitHub giriş bloğu |
| [01.3 · Account menu](#013--account-menu) | üst çubuktan açılan Hesap menüsü |
| [01.4 · My Account · Sessions](#014--my-account--sessions) | oturum listesi ve `Close Account` girişi |
| [01.5 · Revoke Session](#015--revoke-session) | oturum iptal onay dialog'u |
| [01.6 · Preferences](#016--preferences) | Hesap tercih formu ve `Preview` |
| [01.7 · Completion effects](#017--completion-effects) | Bitiriş efekti tema ve palet seçimi |
| [01.9 · Close Account](#019--close-account) | adımlı Hesap kapatma dialog'u |
| [01.10 · Account Closure Status](#0110--account-closure-status) | `Closing` ve dondurma durum ekranı |

## 01.1 · Login
> Kurucu yalnız GitHub kimliğiyle Hesabına ve tek Çalışma Alanına girer.

**Artboard'lar**
- `01.1 · Login · Default · 1440`
- `01.1 · Login · Default · 768`
- `01.1 · Login · Waiting for GitHub · 1440`
- `01.1 · Login · GitHub outage · 1440`
- `01.1 · Login · Sign-in failed · 1440`

### Giriş bloğu
Sırasıyla başlık, tek açıklama satırı, tek birincil düğme ve bekleme durumu satırı.
- **Label'lar:** `Welcome to Cantiara`, `Sign in with the GitHub identity that owns your Workspace.`, `Continue with GitHub`, `Waiting for GitHub`

### Durumlar
#### Waiting
Düğme pasif ve `aria-busy` durumda. Altında `Waiting for GitHub` yazar.
#### Waiting · Tauri
Sistem tarayıcısı açıktır. Blokta `Waiting for GitHub` görünür. Uygulamaya dönüş kısa ömürlü tek kullanımlık kodla olur, kodun kendisi görünmez.
#### GitHub outage
GitHub erişilemiyorsa `Waiting for GitHub` sürekli görünür ve giriş bekler. Geçerli oturumu olan kurucu bu ekranı zaten görmez, çünkü oturumu düşmez.
#### Sign-in failed
Bu durum GitHub onayının reddedilmesini, onay ekranından vazgeçilmesini, state ya da PKCE hatasını, hız sınırını ve geri çekilmiş OAuth sonrası başarısız denemeyi kapsar. Hepsinde aynı genel bildirim görünür: `Sign-in could not be completed. Please try again.` Metin bilinen ve bilinmeyen kimliği ayırt etmez. Düğme yeniden kullanılabilir.
#### Signed out
`Sign Out` sonrası kurucu bu ekrana döner. Korunan krom görünmez.
#### Session ended
Süresi dolan oturumlar (12 saat hareketsizlik ya da 30 günlük mutlak sınır), iptal edilen oturumlar ve GitHub login OAuth'u geri çekildiği için biten oturumlar sonraki korunan rota denetiminde bu ekrana yönlenir. Açıklama bildirimi → `20.20 · Session Ended`. OAuth geri çekildiyse GitHub yeniden onay ister.

**Spec:** [01 Account Access](../../specs/01-account-access/spec.md)

## 01.3 · Account menu
> Hesap ve oturum eylemlerine üst çubuktan tek bir erişilebilir menüyle ulaşılır.

**Artboard'lar**
- `01.3 · Account menu · Open · 1440`
- —

### Menü
Tetiğin altında dar menü; sırasıyla grup başlığı, Hesap kimliği satırı, gezinme öğeleri, ayraç ve `Sign Out`.
- **Label'lar:** `Account menu` (tetiğin adı), `My Account`, `Sessions`, `Preferences`, `Completion effects`, `Sign Out`

### Durumlar
#### Loading
Tetik yerinde yuvarlak bir yer tutucu durur.

**Spec:** [01 Account Access](../../specs/01-account-access/spec.md), [02 Account Preferences](../../specs/02-account-preferences/spec.md), [23 Completion Effects](../../specs/23-completion-effects/spec.md), [84 Account Closure](../../specs/84-account-closure/spec.md)

## 01.4 · My Account · Sessions
> Kurucu hangi cihazların Hesaba erişebildiğini görür ve tanımadığı erişimi hemen keser; Hesabı kapatma girişi de bu sayfadadır.

**Artboard'lar**
- `01.4 · My Account · Sessions · Default · 1440`
- `01.4 · My Account · Sessions · Only current session · 1440`
- `01.4 · My Account · Sessions · Loading · 1440`
- `01.4 · My Account · Sessions · Error · 1440`

### Sayfa başlığı
Başlık, açıklama ve toplu iptal.
- **Label'lar:** `Sessions`, `Review the devices signed in to your Account and revoke access you no longer recognize.`, `Revoke Other Sessions`

### Active sessions
Liste başlığı ve oturum sayısı; her satırda cihaz, `Current` işareti ve son etkinlik.
- **Label'lar:** `Active sessions`, `Device`, `Current`, `Last activity`, `Revoke Session`

### Extension links
Yakalama uzantısı bağlantıları. Sahibi 06'dır, ayrıntıları Capture sayfasında çizilir; burada yalnız yer ve sıra gösterilir.
- **Label'lar:** `Extension links`, `Loading Extension links…`, `Extension links are unavailable.`, `No Extension links.`

### Close Account
Ayrılmış bölüm. Kısa açıklama Hesabın ve tek Çalışma Alanının birlikte kapandığını, 30 günlük dondurmayı ve sonundaki kalıcı silmeyi anlatır.
- **Label'lar:** `Close Account`

### Durumlar
#### Loading
`Loading sessions…` yer tutucu satırlarla.
#### Error
`Sessions are unavailable.` · `Try loading this page again.`
#### Only current session
Liste tek satırdır. `Revoke Other Sessions` pasif görünür.
#### GitHub outage
Sayfa aynı kalır. İptal etmek erişimi yalnız azalttığı için GitHub kesintisinde de çalışır. `Close Account` için GitHub teyidi gerekir, bu yüzden akış bekler (→ `01.9 · Waiting for GitHub`).
#### Revoked
İptal edilen satır listeden çıkar ve sonuç bildirimi görünür. İptal edilen cihazdaki sonraki yazma kapalı başarısız olur ve o cihaz `01.1 · Session ended` durumuna düşer.
#### Revoke failed
→ `20.15 · Support Reference Error`. Satır yerinde kalır.

**Spec:** [01 Account Access](../../specs/01-account-access/spec.md), [84 Account Closure](../../specs/84-account-closure/spec.md), [06 Capture Triage](../../specs/06-capture-triage/spec.md) (`Extension links` bölümü)

## 01.5 · Revoke Session
> Bir oturumun ya da diğer bütün oturumların erişimi kesilmeden önce sonuç açıkça söylenir.

**Artboard'lar**
- `01.5 · Revoke Session · One session · 1440`
- `01.5 · Revoke Session · Other sessions · 1440`

### Onay
Küçük onay dialoğu: soru, sonuç cümlesi ve iki düğme.
- **Label'lar:** `Revoke this session?`, `<device> will lose access immediately.`, `Revoke other sessions?`, `Every session except this one will lose access immediately.`, `Cancel`, `Revoke Session`, `Revoke Other Sessions`

### Durumlar
#### Revoking
Onay düğmesi bekleme durumunda.

**Spec:** [01 Account Access](../../specs/01-account-access/spec.md)

## 01.6 · Preferences
> Locale, saat dilimi, tarih biçimi, haftanın ilk günü ve Appearance tercihi Hesap düzeyinde bir kez seçilir ve bütün Projelerde aynı görünür.

**Artboard'lar**
- `01.6 · Preferences · Default · 1440`
- `01.6 · Preferences · First login suggestion · 1440`
- `01.6 · Preferences · Disconnected · 1440`
- `01.6 · Preferences · Save failed · 1440`
- `01.6 · Preferences · Loading · 1440`

### Browser suggestion
Formun üstünde, ilk girişte önerilen locale ve saat dilimi; öneri uygulanmış sayılmaz.
- **Label'lar:** `Browser suggestion`, `Use suggested locale and time zone`

### Form
Alt alta beş alan; her birinin altında bir açıklama satırı.
- **Label'lar:** `Locale`, `Time zone`, `Date format` (`Locale default`), `First day of week`, `Appearance` (`Light`, `Dark`), `Save`, `Saving…`

### Preview
Seçimin kayıttan önceki gösterim sonucu.
- **Label'lar:** `Preview`, `Before saving`, `Date`, `Example number`, `Week`, `Historical event`, `Work title`

### Kaydetme durumu
Formun altında son kayıt ve bağlantı durumu.
- **Label'lar:** `Last successful save`, `Never`, `Unsaved risk`, `Disconnected`, `Reconnect to save.`, `These changes are still unsaved.`, `These changes will be lost if you leave this page before reconnecting.`

### Durumlar
#### First login suggestion
Öneri bloğu görünür, form ürün varsayılanlarındadır (`en-GB`, `Europe/Istanbul`, haftanın ilk günü `Monday`), `Last successful save` değeri `Never`.
#### Loading
`Loading preferences…`
#### Error
`Preferences are unavailable.`
#### Save failed
`Preferences could not be saved.` · `Data was not written.` · `Try Save again.`
#### Disconnected
`Disconnected` · `Reconnect to save.` `Save` pasif. Değişiklik varsa `Unsaved risk` ile `These changes will be lost if you leave this page before reconnecting.` Yerel kuyruk yoktur.
#### Stale revision
Kayıt sırasında başka bir yerden kaydedilmiş güncel değer gösterilir ve kurucu yeniden seçer.
#### Non-English locale
`tr-TR` seçiliyken bütün arayüz metinleri İngilizce kalır, yalnız Preview değerleri değişir.

**Spec:** [02 Account Preferences](../../specs/02-account-preferences/spec.md), [03 Web and macOS Client](../../specs/03-web-macos-client/spec.md)

## 01.7 · Completion effects
> Varsayılan olarak kapalı, deneysel Bitiriş efekti Hesap düzeyinde açılır ve kapalı katalogdan tek tema ile tek palet seçilir; hareket yalnız `Preview` ile başlar.

**Artboard'lar**
- `01.7 · Completion effects · Default off · 1440`
- `01.7 · Completion effects · Enabled · 1440`
- `01.7 · Completion effects · Previewing · 1440`
- `01.7 · Completion effects · Reduce Motion · 1440`
- `01.7 · Completion effects · Error · 1440`

### Başlık
Sayfa başlığı ve `Experimental` rozeti.
- **Label'lar:** `Completion effects`, `Experimental`

### Enable
Efekti açan tek kontrol.
- **Label'lar:** `Enable`

### Theme
Tek satırda dört durağan örnek; seçim tek bir radyo grubudur.
- **Label'lar:** `Theme`, `Calm`, `Weave`, `Arc`, `Nova`

### Palette
Seçili temanın dört paleti.
- **Label'lar:** `Palette`. `Calm` için `Haze`, `Pebble`, `Linen`, `Moss`. `Weave` için `Loom`, `Cord`, `Lattice`, `Knot`. `Arc` için `Gleam`, `Trace`, `Halo`, `Span`. `Nova` için `Ember`, `Pulse`, `Orbit`, `Flare`.

### Preview
Seçili tema ve paletin durağan örneği ve hareketin kısa açıklaması.
- **Label'lar:** `Preview`, `Preview finished.`

### Kaydet
Ki kaydetme eylemi.
- **Label'lar:** `Save`, `Saving…`, `Completion effects saved.`

### Durumlar
#### Default off
`Enable` kapalı, tema `Calm`, palet `Haze`.
#### Enabled
`Nova` · `Orbit` seçili.
#### Previewing
Örnek alanı hareket halinde. Bu kare hareketin ortası olarak çizilir.
#### Reduce Motion
`Preview` hareket başlatmaz. Son kare durağan gösterilir ve `Static sample shown. <description>` metni görünür.
#### Loading
`Loading completion effects…`
#### Error
`Completion effects are unavailable.` Kaydetme hatası: `Completion effects could not be saved. Refresh to try again.`

**Spec:** [23 Completion Effects](../../specs/23-completion-effects/spec.md)

## 01.9 · Close Account
> Hesabı ve tek Çalışma Alanını kapatma GitHub teyidi ve yazılan Hesap adıyla başlar; akış sonuçlarını önceden açıkça söyler.

**Artboard'lar**
- `01.9 · Close Account · Not confirmed · 1440`
- `01.9 · Close Account · Ready · 1440`
- `01.9 · Close Account · Confirmation failed · 1440`
- `01.9 · Close Account · Waiting for GitHub · 1440`

### Sonuçlar
Adımlı dialog'un başında, sırayla şunları söyleyen kısa liste:
  - Önce görünür `Closing` geçişi başlar: yeni yazmalar reddedilir, paylaşım ve yayın hemen kapanır, entegrasyonlar ve uzantı bağlantıları kapanır, oturumlar sona erer.
  - Ardından 30 günlük sabit dondurma gelir. Bu sürede yalnız iptal ve export mümkündür.
  - Dondurmada `Workspace Exit Package` üretilir ve 30 gün indirilebilir. Unutulan paket parolası kurtarılamaz.
  - Süre sonunda kalıcı silme yapılır ve geri dönüş yoktur.
  - Aynı GitHub kimliği daha sonra yeni ve farklı bir Hesap açabilir.
- **Label'lar:** `Close Account`, `Closing`, `Workspace Exit Package`

### GitHub teyidi
Teyit durumu satırı.
- **Label'lar:** `Confirm GitHub Identity`

### Hesap adı
Etkilenecek Hesap adının yazıldığı alan.

### Durumlar
#### Not confirmed
Teyit bekleniyor, `Close Account` pasif.
#### Confirmation failed
Farklı kimlik, süresi dolmuş tur, state veya PKCE hatası ya da tekrar kullanılmış yetki durumunda hiçbir şey yazılmaz. Teyit yeniden başlatılabilir (→ `20.1 · Confirm GitHub Identity`).
#### Waiting for GitHub
GitHub kesintisinde `Waiting for GitHub` görünür ve akış kapalı başarısız kalır. Oturum iptali yine kullanılabilir.
#### Name mismatch
Alan altında sessiz bir uyumsuzluk satırı. Metni `The name does not match.`
#### Starting
Düğme bekleme durumunda.

**Spec:** [84 Account Closure](../../specs/84-account-closure/spec.md), [01 Account Access](../../specs/01-account-access/spec.md), [82 Workspace Exit](../../specs/82-workspace-exit/spec.md)

## 01.10 · Account Closure Status
> `Closing` boşaltması ve ardından 30 günlük dondurma tek bir dürüst durum ekranında görünür; bu ekrandan iptal edilebilir ve çıkış paketi alınabilir.

**Artboard'lar**
- `01.10 · Account Closure Status · Closing · 1440`
- `01.10 · Account Closure Status · Freeze no package · 1440`
- `01.10 · Account Closure Status · Freeze package ready · 1440`
- `01.10 · Account Closure Status · Cancel waiting for GitHub · 1440`

### Durum başlığı
Geçerli aşamanın adı ve tek cümlelik açıklama. Üstte yalnız wordmark ve `Account menu` (içinde yalnız `Sign Out`) bulunur; gezinme, palet ve `Search` yoktur.
- **Label'lar:** `Closing`

### Zaman çizelgesi
Dört aşama: canlı → `Closing` → 30 günlük dondurma → kalıcı silme. Geçerli aşama işaretlidir; dondurmanın bitiş tarihi ve kalıcı silme tarihi yazılıdır.

### Boşaltma makbuzları (Closing)
Bariyerden önce iptal edilen işler (import, yükleme, otomasyon, eşitleme) makbuzlarıyla listelenir. Bariyeri geçmiş işler ve başlamış geri döndürülemez güvenlik işleri tam commit ya da tam rollback makbuzuyla listelenir.

### Export (dondurma)
`Workspace Exit Package` üretimi ve indirilmesi (→ 82 sayfası), seçili Markdown/JSON/CSV bağlantıları (→ 79); parola kaybı sınırı yeniden yazılır.
- **Label'lar:** `Workspace Exit Package`, `Download Workspace Exit Package`

### Cancel closing
Kapatmayı geri alma bölümü.
- **Label'lar:** `Cancel closing`, `Confirm GitHub Identity`

### Durumlar
#### Closing
Makbuzlar dolmaktadır. Export ve `Cancel closing` henüz kapalıdır, ekran bunu söyler.
#### Freeze · no package yet
Paket henüz üretilmedi, kalıcı silme bu yüzden beklemede.
#### Freeze · package ready
İndirme açık. Paketin indirilebilir kalacağı son tarih yazılır.
#### Cancel waiting for GitHub
GitHub kesintisinde iptal bekler ve kapalı başarısız kalır.
#### Redaction blocked
Dondurmada yeni redaksiyon için önce iptal gerektiğini söyleyen not.

Not: Spec bu ekran için `Closing` ve `Cancel closing` dışında label vermiyor. Aşama metinleri ve tarih satırları terim tablosuna eklenmeli.

**Spec:** [84 Account Closure](../../specs/84-account-closure/spec.md), [82 Workspace Exit](../../specs/82-workspace-exit/spec.md), [79 Data Export](../../specs/79-data-export/spec.md), [01 Account Access](../../specs/01-account-access/spec.md)
