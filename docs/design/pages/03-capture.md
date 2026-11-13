# 03 · Capture

Yakalama ve triage: Gelen Kutuları, hızlı yakalama ve Web Capture.

| Ekran | Ne çizilir |
|---|---|
| [03.1 · Capture Inbox](#031--capture-inbox) | Inbox'lara göre gruplu yakalama listesi |
| [03.2 · New capture](#032--new-capture) | Hızlı yakalama modalı ve `Create Bug` |
| [03.3 · Conversion Preview](#033--conversion-preview) | Özgün ve önerilen kayıt karşılaştırması |
| [03.4 · Attach Preview](#034--attach-preview) | Mevcut kayda bağlama önizlemesi ve öneriler |
| [03.5 · Sequential triage](#035--sequential-triage) | Tek öğeye odaklı triage modu |
| [03.6 · Bulk sense-making](#036--bulk-sense-making) | Geçici küme sütunları |
| [03.7 · Undo Preview](#037--undo-preview) | Birleştirmeyi geri alma paneli |
| [03.8 · Web Capture](#038--web-capture) | Tarayıcı uzantısı açılır penceresi |
| [03.9 · Extension links](#039--extension-links) | Hesaptaki eşleme kodu ve bağlantı listesi |

## 03.1 · Capture Inbox
> Henüz sınıflandırılmamış bütün yakalamaları Inbox'larına göre gruplanmış görmek ve her birini üç açık çıkıştan birine götürmek.

**Artboard'lar**
- `03.1 · Capture Inbox · Default · 1440`

### Sayfa başlığı
`Capture Inbox`; "Save a thought before you know which permanent record it belongs to. Captures stay temporary until you choose what happens next."; satır içi bağlantı durumu (Client Shell).
- **Label'lar:** `Capture Inbox`.

### Saved captures başlık satırı
`Saved captures` ve açıklama; toplam sayı ve eylemler. `New capture` → `03.2`.
- **Label'lar:** `Saved captures`, `New capture`, `Sequential triage`, `Bulk sense-making`.
- **Spec etiketleri:** `Sequential triage`, `Bulk sense-making` → spec 06 `English UI labels`.

### Inbox grupları
Grup başlığı (`Workspace Capture Inbox` veya Proje adı + `Project Capture Inbox`), grup sayısı; altında öğeler. Öğe: yakalama zamanı, içerik metni, varsa mini şablon alanları (tanım listesi), `Link:`, `Capture attachment:`, `Origin:` satırları. Her öğede üç açık çıkış: `Convert` (→ `03.3`), `Attach to existing` (→ `03.4`), `Delete`; `Sequential triage` ve `Bulk sense-making` modlarında aynı üç çıkış (→ `03.5`, `03.6`). Dördüncü çıkış, otomatik triage veya tür tahmini yoktur. `Delete` öğenin Yakalama ekini de siler. Popover görünümü (`Oldest first`, `Inbox` satırı) → `00.6 · Capture Inbox`.
- **Label'lar:** `Convert`, `Attach to existing`, `Delete`, `Workspace Capture Inbox`, `Project Capture Inbox`, `Bug Capture`, `Feedback Capture`, `Research Fragment`, `Observed Behavior`, `Expected Behavior`, `Reproduction Context`, `Feedback`, `Channel`, `Contact`, `Note or Excerpt`, `Source Context`.
- **Spec etiketleri:** çıkışlar, Inbox adları ve şablon adları → spec 06 `English UI labels`; şablon alan adları → spec 06 Mini templates.

### Durumlar
#### Empty
Hiç öğe yok: `Workspace Capture Inbox` başlığı ve "No captures in this Inbox."; yalnız `New capture` görünür.
#### Loading
Başlık + "Loading captures…".
#### Error
"Capture Inbox is unavailable. Try loading this page again."
#### Offline
→ `20.16 · Offline`. Burada yalnız triage eylemleri kapalıdır; kuyruk yoktur.
#### Many items
Uzun grup listeleri; gruplar başlıklarıyla ayrık, sayfalama yok. Uzun içerik → `DS.15 · State Patterns` › Long content.
#### Time passed
Eski öğe süreyle silinmez; zaman yalnız bilgi.

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.2 · New capture
> Serbest metni veya isteğe bağlı mini şablonu ana kayıt oluşturmadan Inbox'a kaydetmek; Proje ve tür kesinse doğrudan `Create Bug`.

**Artboard'lar**
- `03.2 · New capture · Default · 1440`
- `03.2 · New capture · Bug Capture template · 1440`
- `03.2 · New capture · Create Bug unavailable · 1440`

### Başlık
`New capture`; "Save keeps a Capture in the Inbox; Create Bug creates a Bug Work directly when a Project is set."; "Capture writes need an active internet connection; nothing is queued…".
- **Label'lar:** `New capture`.

### Alanlar
Yakalama metni; Proje seçici (boş seçim `Workspace Capture Inbox`, Projeler görünür ad + kısa kodla); yardım metni; mini şablon seçici (`None` + üç şablon); seçilince şablonun bütünüyle isteğe bağlı alanları; isteğe bağlı Yakalama eki.
- **Label'lar:** `Capture` (yer tutucu "What do you want to remember?"), `Project`, `Workspace Capture Inbox`, `Leave empty to save to the Workspace Capture Inbox.`, `Mini template`, `None`, `Bug Capture`, `Feedback Capture`, `Research Fragment`, şablon alanları (`03.1` ile aynı), `Capture attachment`.
Şablon alanlarının hiçbiri zorunlu değildir; kaydetme bir alana takılmaz.

### Eylemler
`Save` ve `Create Bug`; `Create Bug` yalnız Proje seçili ve şablon `Bug Capture` veya boşken açık; yanında el verme metni.
- **Label'lar:** `Save` (`Saving…`), `Create Bug` (`Creating…`), `Create Bug is available when Project is set and type is Bug Capture.`, `Create Bug does not stay in the Capture Inbox. A Work record is not stored yet.`

### Durumlar
#### Create Bug unavailable
Proje boş veya şablon `Feedback Capture`/`Research Fragment`: `Create Bug` kapalı ve kullanılabilirlik metni.
#### Error
"Capture could not be saved."; "Work could not be created from this Capture."; Projeler: "Projects could not be loaded. Try loading this page again." (yüklenirken "Loading Projects…").
#### Offline
Kaydetme kapalı; kuyruk yok. Son başarılı kayıt zamanı ve kaydedilmemiş risk → `20.16 · Offline` (`Last saved`, `Unsaved changes may be lost`).

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.3 · Conversion Preview
> Yakalamayı tek yeni ana kayda dönüştürmeden önce özgün içeriği önerilen kayıtla karşılaştırmak.

**Artboard'lar**
- `03.3 · Conversion Preview · Workspace item · 1440`
- `03.3 · Conversion Preview · Project item with template · 1440`

### Kurulum
Dönüşüm hedefi; Workspace öğesinde hedef Proje seçici. Proje Inbox öğesi kendi Proje kapsamını korur, kapsam değiştirilmez. Tek onay tek yeni ana kayıt üretir; oluşturmayı hedef kaydın sahibi feature yapar.
- **Label'lar:** `Conversion Preview`, `Conversion target` (`Choose a target`, `Work`, `Document`), `Project` (`Workspace Capture Inbox` + `Luma (LUMA)`…), `Work conversion requires a Project.`, `Preview`, `Cancel`.
- **Spec etiketleri:** `Work conversion requires a Project.` → spec 06 `English UI labels`; `Conversion Preview`, `Choose a target`, `Conversion target` → PRD 02 sözlüğü.

### Original capture
Özgün metin, bağlantı, ek, yakalama zamanı, köken.
- **Label'lar:** `Original capture`.

### Proposed record
Tür, başlık, alanlar, `Target scope`; mini şablon alan eşlemeleri; ek varsa hedef kapsamı (Dosya Eki terfisi atomik, hata görünür ek bırakmaz).
- **Label'lar:** `Proposed record`, `Target scope`, `Field mappings`.

### Eylemler
Onay ve vazgeçme.
- **Label'lar:** `Confirm` (`Converting…`), `Cancel`.

### Durumlar
#### Error
Uygulanamadı; öğe Inbox'ta kalır ve görünür bir Dosya Eki bırakılmaz ("This action could not be completed." → `20.15 · Support Reference Error`).

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.4 · Attach Preview
> Yakalamayı mevcut bir kayda `Origin` veya `Evidence` olarak bağlamadan önce hedefi ve ilişkiyi göstermek; benzer kayıt önerileri onaysız bağlamaz.

**Artboard'lar**
- `03.4 · Attach Preview · With suggestions · 1440`
- `03.4 · Attach Preview · Cross-Project · 1440`

### Suggestions
`Same Project` birincil grup, `Other Projects` adlı ikincil grup (Proje adlarıyla); her öneride başlık, `Basis`, `Use target`. Öneri onaysız bağlamaz, birleştirmez veya hedef değiştirmez; `Use target` yalnız hedef kimliği Kurulum'a aktarır.
- **Label'lar:** `Show suggestions`, `Suggestions`, `Same Project`, `Other Projects`, `Basis`, `Use target`, `Close suggestions`.

### Kurulum
Hedef kimlik ve ilişki türü.
- **Label'lar:** `Target record ID`, `Relation` (`Origin`, `Evidence`), `Preview`, `Cancel`.

### Önizleme
`Original capture`; ilişki önizlemesinin biçimi ve metni → `20.10 · Relation Picker & Used in` › Seçici (`Relation preview`, yeniden yazılmaz); farklı Projede `Cross-Project bind: <Project>` uyarısı.
- **Label'lar:** `Attach Preview`, `Cross-Project bind`, `Confirm` (`Attaching…`), `Cancel`.

### Durumlar
#### Cross-Project
`Cross-Project` artboard'ı. Hedef tidekit'te: belirgin hedef kapsam onayı.
#### Attached
`Confirm` ile bağ yazıldıktan sonra `20.14 · Write Receipts` Undo toast'ı (`Undo`); `Undo` seçilince `03.7 · Undo Preview` açılır. Öğe Inbox'tan çıkar.
#### Error
Uygulanamadı; öğe Inbox'ta kalır (→ `20.15 · Support Reference Error`).

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.5 · Sequential triage
> Tek öğeye odaklanıp yalnız açık bir çıkışla ilerlemek.

**Artboard'lar**
- `03.5 · Sequential triage · Default · 1440`
- `03.5 · Sequential triage · Resolved · 1440`
- `03.5 · Sequential triage · Complete · 1440`

### Mod başlığı
`Sequential triage`; "Focus on one capture. Convert, attach to existing, or delete to…"; konum (ör. 2 / 5). Mod yeni kuyruk, süre hedefi veya otomatik çözüm üretmez.
- **Label'lar:** `Sequential triage`, `Previous item`, `Next item`, `Back to list`.

### Odak öğesi
`03.1` öğe ayrıntısının tamamı ve üç çıkış (`03.3`, `03.4`, silme). İlerleme yalnız üç çıkıştan biriyle olur; öğeye bakmak veya alan düzenlemek ilerletmez.
- **Label'lar:** `Convert`, `Attach to existing`, `Delete`, `Show suggestions`.

### Durumlar
#### Resolved
"This capture was already handled in this session." ve `Next item`.
#### Complete
"Sequential triage is complete. No captures are waiting in this session." + `Back to list`.

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.6 · Bulk sense-making
> Birden çok yakalamayı geçici görsel kümelerde yan yana görüp anlam kurmak; küme etiket veya ilişki değildir.

**Artboard'lar**
- `03.6 · Bulk sense-making · Default · 1440`

### Başlık ve küme ekleme
`Bulk sense-making`; "Arrange captures side by side before you choose one of the three…"; ad alanı ve ekleme.
- **Label'lar:** `Bulk sense-making`, `New cluster name`, `Name a cluster`, `Add cluster`, `Saving layout…`.

### Sütunlar
Sütun başlığı, sola/sağa taşıma; kartlarda kısa içerik, yerleşim seçici (`Ungrouped` + küme adları), üç çıkış. Küme adı ve konumu yalnız görünüm üstverisidir; etiket, ilişki veya kalıcı sınıflandırma değildir, arama ve dışa aktarmaya girmez.
- **Label'lar:** `Ungrouped`, `Move left`, `Move right`, `Capture`, `Convert`, `Attach to existing`, `Delete`.

### Durumlar
#### Empty cluster
Boş sütun yalnız başlıkla.
#### Saving
`Saving layout…`.
#### Resolved
Üç çıkıştan biriyle çözülen kart sütundan kalkar; kümedeki yerleşim üstverisi de silinir.
#### Error
"Bulk sense-making could not be saved." (düzen kaydedilemedi; kartlar ve çıkışlar değişmez).

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.7 · Undo Preview
> Onaylanmış birleştirmeyi geri alırken Inbox'a neyin döneceğini ve hedeften yalnız bu birleştirmenin yazdıklarının kaldırılacağını göstermek.

Açılış: `03.4` onayı sonrası Undo toast'ındaki `Undo`; `Confirm` onaylar.

**Artboard'lar**
- `03.7 · Undo Preview · Default · 1440`

### İçerik
"Review what returns to the Capture Inbox and what this merge alone…"; geri dönecek özgün öğe (mesaj, bağlantı, ek, yakalama zamanı, köken); kaldırılacak bağlar ve alan anahtarları (yoksa "None"). Hedefteki sonraki ilgisiz düzenlemeler geri sarılmaz.
- **Label'lar:** `Undo Preview`, `Original capture`, `Only this merge`, `Confirm` (`Restoring…`), `Cancel`.

### Durumlar
#### Error
Geri alınamadı; hedef değişmedi. Aynı alan sonradan değiştiyse → `20.14 · Write Receipts` › Durumlar › Undo conflict.

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.8 · Web Capture
> Eşlenmiş tarayıcı uzantısından açıkça seçilen URL, metin, görsel veya ekran görüntüsünü önizleyip seçilen Inbox'a göndermek.

**Artboard'lar**
- `03.8 · Web Capture · Preview · 390`
- `03.8 · Web Capture · Permission · 390`
- `03.8 · Web Capture · Permission declined · 390`
- `03.8 · Web Capture · Unpaired · 390`
- `03.8 · Web Capture · Re-authorization · 390`

### Başlık
`Web Capture`, tarayıcı adı rozeti; "Capture actions read only the active tab after you choose one. Web Capture does not read history or keep an offline queue."
- **Label'lar:** `Web Capture`.

### Capture
Dört yakalama eylemi.
- **Label'lar:** `Capture`, `Capture URL`, `Capture selected text`, `Capture selected image`, `Capture screenshot`.

### Preview
İçerik, köken URL'si, hedef Inbox (aranabilir seçici: Workspace + bütün yetkili Proje Inbox'ları; yalnız son açılanlarla sınırlı değil). Hassas ya da geniş okuma izni gerekiyorsa eylemden önce izin bloğu görünür (`Permission` artboard'ı): başlık `Permission needed`, kapsam satırı `Scope`, risk satırı `Access risk`, eylemler `Allow` / `Cancel`. Gönderim ana kayıt, Kaynak veya canlı sayfa kopyası oluşturmaz; yalnız Inbox öğesi yazar.
- **Label'lar:** `Permission needed`, `Scope`, `Access risk`, `Allow`, `Cancel`, `Preview`, `Content`, `Origin URL`, `Target Inbox`, `Search Inbox`, `Send`; `No selected text`, `Sending…`, `Last successful save`.
- **Spec etiketleri:** `Scope` mevcut ad, yeni bağlam: burada uzantı izin kapsamıdır (Proje profil alanı ve Komut Paleti kapsamı değildir). `Access risk` `Risk` kayıt türüyle karışmasın diye ayrı seçildi (PRD 02).

### Pair this browser
"Generate a Pairing code in Cantiara, then enter it here…"; kod ve cihaz alanları.
- **Label'lar:** `Pair this browser`, `Pairing code`, `Device`, `Pair`; `Pairing…`.

### Durumlar
#### Permission needed
`Permission` artboard'ı. İzin bloğu açık; içerik → Preview.
#### Unpaired
Yalnız eşleme formu; "Pair this browser to choose a Target Inbox.".
#### Re-authorization
30 gün kullanılmamış: "This browser needs to be paired again before it can write." / "…before it can read Inbox targets.".
#### Error
"This Pairing code is invalid, expired, or already used."; "This page cannot be captured."; "Capture could not be sent. No local queue was created."; "Inbox targets are unavailable.".
#### Permission declined
Hassas ya da geniş okuma izni reddedilirse yakalama kendiliğinden genişletilmez; hiçbir şey gönderilmez: `Permission declined. Nothing was sent.`.
#### Unsupported browser
Safari: "This browser cannot pair with Web Capture.".
#### Sent
"Sent to Capture Inbox." ve güncel `Last successful save`.

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).

## 03.9 · Extension links
> Uzantı eşleme kodu üretmek ve eşlenmiş tarayıcıları tek tek iptal etmek.

**Artboard'lar**
- `03.9 · Extension links · Default · 1440`
- `03.9 · Extension links · Code generated · 1440`

Yer: Hesap güvenlik yüzeyi (→ `01.4 · My Account · Sessions` › Extension links); içerik ve durum metinlerinin sahibi bu ekrandır.

### Başlık ve kod
`Extension links`; "Pair a browser with Web Capture and revoke individual links…"; üretilen kod ve süre metni.
- **Label'lar:** `Extension links`, `Generate pairing code` (`Generating…`), `Pairing code`, `This pairing code expires in five minutes and can be used once.`

### Bağlantı listesi
Satır: cihaz, `Browser:`, `Last use:` (yoksa `Never`), `Revoke`. 30 gün kullanılmayan bağlantı yazmadan önce yeniden eşleme ister (→ `03.8` › Re-authorization).
- **Label'lar:** `Browser`, `Last use`, `Never`, `Revoke`.

### Durumlar
#### Empty
"No Extension links."
#### Loading
"Loading Extension links…"
#### Error
"Extension links are unavailable."

**Spec:** [06 Yakalama ve Triage](../../specs/06-capture-triage/spec.md).
