# Design System

Foundations ve Components tek bir Paper sayfasında durur. Önce DS.0 kararları verilir, sonra bileşenler çizilir; bütün ekranlar bunları klonlar.

Bağlayıcı ilkeler ([`PRODUCT.md`](../../../PRODUCT.md)):
- Kişilik "Exact, quiet, durable".
- Her yüzeyin tek bir işi vardır.
- Hiyerarşi kart veya renkle değil, tipografi ve boşlukla kurulur.
- Boş durum dürüsttür; sahte İş veya widget göstermez.

Anti-referanslar: sağlık skorları, widget dashboard'ları, krem SaaS landing'leri, ikiz `Sign In` CTA'ları, birincil eylem olarak mavi ham link, üst üste binen tema ikonları.

| Bölüm | Ne çizilir |
|---|---|
| [DS.0 · Decisions](#ds0--decisions) | Karar listesi; Paper token'ları |
| [DS.1 · Color roles](#ds1--color-roles) | Light ve Dark renk rolleri |
| [DS.2 · Type scale](#ds2--type-scale) | Tip ölçeği |
| [DS.3 · Spacing, density, grid](#ds3--spacing-density-grid) | Boşluk, yoğunluk, ızgara |
| [DS.4 · Radius, border, elevation, focus](#ds4--radius-border-elevation-focus) | Kenar, yükselti, odak |
| [DS.5 · Icons and motion](#ds5--icons-and-motion) | İkon kuralları, motion |
| [DS.6 · Actions and forms](#ds6--actions-and-forms) | Buton ve form primitive'leri |
| [DS.7 · Navigation and layers](#ds7--navigation-and-layers) | Gezinme, dialog, menü |
| [DS.8 · Feedback and data](#ds8--feedback-and-data) | Toast, alert, tablo, liste |
| [DS.9 · Product components](#ds9--product-components) | Cantiara'ya özgü parçalar |
| [DS.10 · Page Header](#ds10--page-header) | Sayfa ve alan başlığı |
| [DS.11 · Record Header](#ds11--record-header) | Kayıt başlığı ve eylem menüsü |
| [DS.12 · Record Properties](#ds12--record-properties) | Kayıt özellik paneli |
| [DS.13 · Record Sections](#ds13--record-sections) | İlişkiler, ekler, geçmiş bölümleri |
| [DS.14 · Collection Views](#ds14--collection-views) | Liste, tablo, pano araç çubuğu |
| [DS.15 · State Patterns](#ds15--state-patterns) | Boş, yükleniyor, hata durumları |
| [DS.16 · Dialog and Panel Frames](#ds16--dialog-and-panel-frames) | Dialog ve panel çerçevesi |
| [DS.17 · Record Representations](#ds17--record-representations) | Kaydın göründüğü biçimler |

## DS.0 · Decisions
- [ ] Kararlar tamam

> Bu bölümün tek çıktısı: her satır karar verilip Paper token'ı olarak yazılır, sonra `Karar` sütunu doldurulur.

| # | Karar | Kapsam | Kısıtlar | Karar |
|---|---|---|---|---|
| 1 | Mood ve görsel yön | Tek cümlelik yön, mood kelimesi | `PRODUCT.md` kişiliği ve anti-referansları | açık |
| 2 | Renk rolleri | Zemin, yükseltilmiş yüzey, metin, sessiz metin, ayırıcı, birincil eylem, odak halkası, seçim | Gövde metni ≥4.5:1 kontrast; anlam yalnız renkle aktarılmaz (WCAG 2.2 AA, [PRD 15](../../prd/15-product-quality.md)) | açık |
| 3 | Semantik renkler | Success, warning, danger, info; durum rozetleri | Her durum metin veya ikonla da okunur; Light ve Dark ayrı doğrulanır | açık |
| 4 | Light / Dark | `Appearance` değerleri `Light`, `Dark`; `System` yok | [spec 02](../../specs/02-account-preferences/spec.md); "tema sistemi" değildir, Proje rengi yoktur | açık |
| 5 | Tipografi | Font ailesi; display, heading, subhead, body, label, caption, mono/data; ağırlık; satır yüksekliği | %200 ölçekte okunur; uzun içerik kırılır; İş anahtarı ve tarihte tabular rakam | açık |
| 6 | Spacing ölçeği | Temel birim; bileşen içi, grup arası, bölge arası | Yoğun liste ile geniş okuma yüzeyi aynı ölçekten çıkar | açık |
| 7 | Yoğunluk | Liste ve tablo satır yüksekliği | Linear sınıfı araç kullanıcısı; satır başına tek bilgi hattı | açık |
| 8 | Layout ızgarası | 1440 içerik genişliği, kenar boşluğu, kabuk kolonları, 768 kırılımı | 768'de hiçbir eylem kaybolmaz, yalnız yer değiştirir | açık |
| 9 | Radius | Kontrol, yüzey, dialog, rozet | Radius dekor değildir | açık |
| 10 | Kenar ve gölge | Ayırıcı, yükselti seviyeleri (popover, dialog, toast) | Yükselti yalnız katman anlamı taşır | açık |
| 11 | İkonografi | Boyut, çizgi kalınlığı, ikon + metin kuralı | Set [tech-stack](../../tech-stack.md) kararıyla **Lucide React**; yalnız ikonlu kontrolün erişilebilir adı var | set seçili |
| 12 | Odak | Odak halkası biçimi, kalınlığı, ofseti | Her etkileşimli öğede görünür odak | açık |
| 13 | Motion | Süreler, easing, giriş/çıkış | `prefers-reduced-motion`; Bitiriş efekti ≤1,2 sn, odağı ve girdiyi almaz ([spec 23](../../specs/23-completion-effects/spec.md)) | açık |
| 14 | Veri gösterimi | Tarih, saat, sayı; göreli zaman | `Locale`, `Time zone`, `Date format`, `First day of week`; arayüz dili İngilizce | açık |
| 15 | Kanvas temelleri | Zemin, ızgara, seçim, bağlantı çizgisi, kilit işareti | Wall, User Flow, Wireframe, Moodboard, Technical Diagram ortak; her kanvasın erişilebilir outline'ı var | açık |
| 16 | Metin tonu | Boş durum, hata, onay metinleri | Sakin, kesin; sözlük `_Avoid_` listeleri bağlayıcı | açık |
| 17 | Gezinme biçimi | [Navigation](00-shared-shell.md#0011--navigation) içeriğinin yerleşimi: yan, üst veya birleşim; 768'de katlanma | İçerik 00.11'de sabit; biçim yalnız yerleşimi belirler; hiçbir hedef kaybolmaz | açık |

## DS.1 · Color roles
**Artboard'lar**
- `DS.1 · Foundations · Color roles · Light`
- `DS.1 · Foundations · Color roles · Dark`

Karar 2, 3, 4'ün görsel tablosu: her rol için örnek yüzey, metin üstünde kontrast oranı, semantik rozetler.

## DS.2 · Type scale
**Artboard'lar**
- `DS.2 · Foundations · Type scale`

Karar 5: her tip rolü gerçek Cantiara metniyle (`Projects`, `LUMA-42 Reminder email bounces for Gmail aliases`, `2026-10-22`).

## DS.3 · Spacing, density, grid
**Artboard'lar**
- `DS.3 · Foundations · Spacing, density, grid`

Karar 6, 7, 8: ölçek merdiveni, kompakt ve rahat liste satırı, 1440 ve 768 ızgarası.

## DS.4 · Radius, border, elevation, focus
**Artboard'lar**
- `DS.4 · Foundations · Radius, border, elevation, focus`

Karar 9, 10, 12: radius örnekleri, ayırıcı, popover/dialog/toast katmanları, odak halkası.

## DS.5 · Icons and motion
**Artboard'lar**
- `DS.5 · Foundations · Icons and motion`

Karar 11, 13: Lucide boyut ve çizgi örnekleri, ikon + metin hizası, motion süre tablosu.

## DS.6 · Actions and forms
**Artboard'lar**
- `DS.6 · Components · Actions and forms`

Her bileşen için default, hover, focus, pressed, disabled; varsa loading ve error.

| Grup | Bileşenler | Varyantlar |
|---|---|---|
| Eylem | Button, Button group, Toggle, Toggle group, Icon button, Kbd | Primary, secondary, ghost, destructive; boyutlar; ikonlu; yükleniyor |
| Form | Input, Input group, Textarea, Select, Native select, Combobox, Checkbox, Radio group, Switch, Slider, Date picker, Calendar, Field + Label + yardım + hata | Boş, dolu, odak, hata, disabled, salt okunur |

## DS.7 · Navigation and layers
**Artboard'lar**
- `DS.7 · Components · Navigation and layers`

| Grup | Bileşenler | Varyantlar |
|---|---|---|
| Gezinme | Tabs, Breadcrumb, Navigation menu, Menubar, Pagination, Sidebar öğesi | Aktif, pasif, `aria-current` |
| Katman | Dialog, Alert dialog, Sheet, Drawer, Popover, Hover card, Tooltip, Dropdown menu, Context menu, Command | Başlık + gövde + eylem satırı; yıkıcı onay; uzun içerik kaydırma |

## DS.8 · Feedback and data
**Artboard'lar**
- `DS.8 · Components · Feedback and data`

| Grup | Bileşenler | Varyantlar |
|---|---|---|
| Geri bildirim | Toast / Sonner, Alert, Progress, Spinner, Skeleton, Empty, Badge | Info, success, warning, danger; `Undo` eylemli toast |
| Veri | Table, Item / liste satırı, Avatar, Accordion, Collapsible, Scroll area, Resizable, Separator | Seçili, çoklu seçim, sürükleme tutamacı, uzun metin |

## DS.9 · Product components
**Artboard'lar**
- `DS.9 · Components · Product components`

| Bileşen | Kullanıldığı yerler | Varyantlar |
|---|---|---|
| Record row | Listeler, Backlog, arama, Smart Collection | Anahtar + başlık + durum + meta; seçili; çoklu seçim; sürüklenebilir |
| Status badge | İş, Risk, Karar, test sonucu, senkron | Her kapalı katalog değeri; metinli |
| Record header | Bütün kayıt detayları | Başlık, anahtar, durum, eylem menüsü (`Add to Favorites`, `Remind me`, `Move to Trash`, `Share`, `Export`) |
| Property list | Kayıt detay yan paneli | Alan + değer; boş; özel alan; salt okunur |
| Relation chip, `Used in` | Kayıt detayları | Normal, `Blocks` / `Blocked by`, silinmiş hedef |
| Tag chip | Kayıtlar | Seçili, yeni oluştur, çok sayıda |
| Kanban card | `Board` | Normal, sürükleniyor, `Soft WIP` aşımı |
| Context record preview | Kanban, Calendar, Roadmap, Favorites, Smart Collection | Kayıt türüne göre; `Open full page` |
| Empty state | Bütün listeler | İlk kullanım, filtre boş, arşivli |
| Archived / read-only banner | Arşivli Proje ve kayıtlar | Tek güvenlik eylemli |
| Offline banner | Bütün uygulama | `You're offline`, `Last saved` |
| Undo toast | Bütün mutasyonlar | `Undo`, conflict, `Finalizing` |
| Canvas chrome | Kanvaslar | Araç çubuğu, `Fit View`, `Presentation Mode`, outline geçişi |
| Editor toolbar | Belge editörü, Wiki | Tam; dar ekran kaydırmalı (`Swipe for more formatting tools →`) |

## DS.10 · Page Header
> Tam sayfa yüzeylerin ve Proje alanlarının üstündeki başlık: ad, açıklama, alan içi görünüm geçişi, birincil ve ikincil eylemler.

**Artboard'lar**
- `DS.10 · Page Header · Page · 1440`
- `DS.10 · Page Header · Area · 1440`
- `DS.10 · Page Header · Area · 768`
- `DS.10 · Page Header · Page with count and actions · 1440`
- `DS.10 · Page Header · Area with view switch · 1440`
- `DS.10 · Page Header · Archived Project · 1440`

- **Page:** Sayfa adı, açıklama, en çok bir birincil eylem. Örnekler: `Capture Inbox` + `New capture`; `Calendar` + `Day`/`Week`/`Month`/`Agenda`; `Daily Focus`.
- **Area:** Proje alanı adı + alan içi görünüm geçişi + birincil oluşturma eylemi. Hepsi aynı iskeleti kullanır; yalnız parametreler değişir:

| Alan | Görünüm geçişi | Birincil eylem |
|---|---|---|
| `Documents` | `Archived` filtresi | `Create Document` |
| `Discovery` | `Sources`, `Research Sessions`, `Feedback`, `Feed`, `Validation Records` | türe göre oluştur |
| `Decisions` | `Decisions`, `Risks`, `Assumptions`, `Open Questions` | `Create` |
| `Design` | `Project Wall`, `Screen`, `User Flow`, `Moodboard` (bölüm dizini, kayıt sayılarıyla) | bölüme göre |
| `Technical Diagrams` | — | `New Technical Diagram` |
| `Tests` | `Tests overview`, `Planned Test Cases`, `Test Handoffs`, `Test Sessions`, `Test Gaps`, `Recent Test Assessments` | `Record Test Session` |
| `Releases` | `Changelog` bağlantısı | `Create Project Release` |
| `Production` | — | `Record Production Incident` (öneri) |
| `GitHub` | `Repository`, `GitHub records` | `Connect repository` |

- **Kural:** Başlık bir dashboard bandı olmaz; sayaç, sağlık skoru ve widget içermez. Arşivli Projede birincil oluşturma eylemi gizlenir.


## DS.11 · Record Header
> Bir kaydın kimliğini ve ortak eylemlerini her kayıt türünde aynı biçimde göstermek.

**Artboard'lar**
- `DS.11 · Record Header · Work (Bug) · 1440`
- `DS.11 · Record Header · Work (Bug) · 768`
- `DS.11 · Record Header · Work (Bug) · 1440 · Dark`
- `DS.11 · Record Header · Document · 1440`
- `DS.11 · Record Header · Decision · 1440`
- `DS.11 · Record Header · Without key · 1440`
- `DS.11 · Record Header · Archived · 1440`
- `DS.11 · Record Header · In Trash · 1440`
- `DS.11 · Record Header · Overflow menu · 1440`

- **Kimlik:** İş anahtarı (`LUMA-42`) varsa başlıkla birlikte; anahtarı olmayan kayıtlarda yalnız başlık ve tür.
- **Eylemler (ortak):** `Add to Favorites` (→ `20.12`), `Remind me` / `Review Later` (→ `20.9`), taşma menüsü: `Share` (→ `20.4`), `Export` (→ `20.5`), `Move to Trash` (→ `20.2`). Kayıt türüne göre taşmaya `Archive`, `Duplicate`, `Redact` (→ `20.7`) girer.
- **Türe özgü eylemler:** İş için `Record Action`, `Copy Context as Markdown`, `Start Work`, `Not now`; Belge için `Convert to template`, `Personal Review`. Her türün tam listesi sahibi ekran kartındadır; iskelet bu bölgedir.
- **Durumlar:** `Archived` ve `In Trash` kayıtlarda yazma eylemleri gizlenir, geri yükleme eylemi görünür.


## DS.12 · Record Properties
> Kaydın alanlarını etiket + değer satırları olarak, satır içi düzenlemeyle göstermek.

**Artboard'lar**
- `DS.12 · Record Properties · Work · 1440`
- `DS.12 · Record Properties · Work · 768`
- `DS.12 · Record Properties · Editing a field · 1440`
- `DS.12 · Record Properties · Empty values · 1440`
- `DS.12 · Record Properties · Read-only · 1440`
- `DS.12 · Record Properties · Save error · 1440`

- **Satır:** sabit genişlikli etiket sütunu + değer; boş değer `Not evaluated` ya da `—` olarak açıkça gösterilir (`False`'tan farklıdır).
- **Düzenleme:** satır içi; hata satırın altında ("… could not be saved.").
- **Gruplar:** durum ve planlama, öncelik ölçütleri, özel alanlar, etiketler.
- **Salt okunur:** arşivli ve çöpteki kayıtlarda değerler okunur, kontroller gizli.

**Spec:** [09](../../specs/09-work-lifecycle/spec.md), [10](../../specs/10-custom-fields/spec.md), [13](../../specs/13-tags/spec.md), [20](../../specs/20-priority/spec.md).

## DS.13 · Record Sections
> Kayıt detayının gövdesindeki ortak bölümler: ilişkiler, `Used in`, ekler, kanıt, geçmiş.

**Artboard'lar**
- `DS.13 · Record Sections · Relations and Used in · 1440`
- `DS.13 · Record Sections · Attachments and History · 1440`
- `DS.13 · Record Sections · Evidence · 1440`
- `DS.13 · Record Sections · Empty section · 1440`
- `DS.13 · Record Sections · Broken target · 1440`
- `DS.13 · Record Sections · Collapsed · 1440`

- **Relations:** Kapalı tür kataloğu (kullanıcı yeni tür icat etmez), her tür iki uçta iki ayrı adla görünür: `Related`, `Origin` / `Derived`, `Evidence` / `Provides evidence`, `Contributes to Goal` / `In Goal`, `Blocks` / `Blocked by`, `Includes` / `Included in`, `Contributes to Milestone` / `In Milestone`, `Primary spec`, `Supersedes` / `Superseded by`, `Implements` / `Implemented by`, `Belongs to Company`, `Participant`, `Required for completion` / `Contextual`. `Blocks` / `Blocked by` ayrıca `Active` / `Resolved` taşır. Ekleme relation picker ile (→ `20.10`).
- **Used in:** ilişki geri bağlantıları ve kullanım bağları iki ayrı grup.
- **Attachments:** liste + önizleme (→ `20.13`).
- **Evidence:** Kanıt Rolü, kaynak türü, durum, `Open source record` (→ `11.13`).
- **History:** kronolojik olay listesi.
- **Boş bölüm:** bölüm başlığı ve desteklenen ekle/bağla eylemi; sahte içerik yok.
- **Kırık hedef:** silinmiş, arşivli, erişilemez hedef içerik sızdırmadan ortak işaretle (→ `20.10`).

**Spec:** [12](../../specs/12-relations/spec.md), [19](../../specs/19-blockers/spec.md), [14](../../specs/14-file-attachments/spec.md), [45](../../specs/45-evidence/spec.md).

## DS.14 · Collection Views
> Bir kayıt kümesini listeleyen her yüzeyin ortak iskeleti: araç çubuğu, görünüm biçimi, seçim.

**Artboard'lar**
- `DS.14 · Collection Views · List · 1440`
- `DS.14 · Collection Views · List · 768`
- `DS.14 · Collection Views · List · 1440 · Dark`
- `DS.14 · Collection Views · Table · 1440`
- `DS.14 · Collection Views · Board · 1440`
- `DS.14 · Collection Views · Gallery · 1440`
- `DS.14 · Collection Views · Agenda · 1440`
- `DS.14 · Collection Views · Multi-select · 1440`
- `DS.14 · Collection Views · Filtered empty · 1440`
- `DS.14 · Collection Views · Grouped · 1440`

- **Biçimler:** `List`, `Table`, `Board`, `Gallery`, `Agenda`. Hangi ekranın hangi biçimi sunduğu sahibi spec'te tanımlıdır; araç çubuğu hepsinde aynıdır.
- **Araçlar:** görünüm seçici, filtre, sıralama, gruplama, `Saved views`.
- **Seçim:** çoklu seçim, seçim çubuğu, `Bulk Edit` (→ `20.8`).
- **Gruplu liste:** grup başlığı (durum, yaşam ya da klasör) sessiz bir başlıktır; örnekler: `Open`/`Watching`/`Resolved` (olaylar), `Draft`/`Preparing`/`Published` (sürümler), klasör başlıkları (Belgeler).
- **Satır / kart:** [DS.17](#ds17--record-representations) biçimlerini kullanır.
- **Boş:** ilk kullanım ile filtre sonucu boş ayrı metinler taşır (→ [DS.15](#ds15--state-patterns)).

**Spec:** [25](../../specs/25-kanban/spec.md), [26](../../specs/26-backlog/spec.md), [33](../../specs/33-record-discovery/spec.md), [34](../../specs/34-smart-collections/spec.md), [22](../../specs/22-bulk-editing/spec.md).

## DS.15 · State Patterns
> Her ekranın paylaştığı durum kalıpları, tek kez çizilir.

**Artboard'lar**
- `DS.15 · State Patterns · Empty, loading, error · 1440`
- `DS.15 · State Patterns · Offline and write risk · 1440`
- `DS.15 · State Patterns · Read-only and archived · 1440`
- `DS.15 · State Patterns · No access and broken reference · 1440`
- `DS.15 · State Patterns · Long content · 1440`

- **Empty (ilk kullanım):** neyin burada olacağını ve tek bir sonraki eylemi söyler; sahte İş veya örnek içerik üretmez.
- **Empty (filtre sonucu):** filtreyi temizleme eylemi.
- **Loading:** iskelet satırlar; üst çerçeve hemen çizilir.
- **Error:** ne olduğu, yeniden dene, `Support reference` (→ `20.15`).
- **Offline:** `You're offline`, `Last saved`, yazılmamış risk (→ `20.16`).
- **Read-only / archived:** şerit ve gizli yazma kontrolleri (→ `20.21`).
- **No access / broken reference:** içerik sızdırmayan işaret (→ `20.10`).
- **Long content:** uzun başlık ve metin kırpılmaz, sarılır ya da erişilebilir biçimde kısaltılır.

**Spec:** [03](../../specs/03-web-macos-client/spec.md), [04](../../specs/04-mutation-and-undo/spec.md).

## DS.16 · Dialog and Panel Frames
> Dialog, yan panel, açılır pencere ve önizleme için ortak iskelet.

**Artboard'lar**
- `DS.16 · Dialog and Panel Frames · Dialog and Sheet · 1440`
- `DS.16 · Dialog and Panel Frames · Dialog and Sheet · 1440 · Dark`
- `DS.16 · Dialog and Panel Frames · Destructive confirm · 1440`
- `DS.16 · Dialog and Panel Frames · Preview before apply · 1440`
- `DS.16 · Dialog and Panel Frames · Side panel · 1440`
- `DS.16 · Dialog and Panel Frames · Popover and picker · 1440`
- `DS.16 · Dialog and Panel Frames · Toast and Undo · 1440`

- **Dialog:** başlık, gövde, hata satırı, eylem satırı (iptal ya da ikincil, birincil).
- **Yıkıcı onay:** eylemin ne sildiğini ve geri alınıp alınamayacağını söyler (→ `20.2`, `20.3`).
- **Preview before apply:** önce etki önizlemesi, sonra uygulama; Cantiara'nın birçok eyleminin kalıbıdır (`Bulk Edit`, `Import`, `Copy project structure`).
- **Yan panel:** Personal shell, Favorites, Notification Center (→ `00.2`).
- **Popover ve seçici:** relation picker, tag picker (→ `20.10`, `20.11`).
- **Toast ve Undo:** sonuç bildirimi ve `Undo` (→ `20.14`).
- **Odak:** açılışta odak dialog içine girer, kapanınca tetikleyiciye döner.


## DS.17 · Record Representations
> Aynı kaydın farklı ekranlarda aynı kimlikle görünmesi: her kayıt türü için satır, kart, kompakt etiket ve önizleme biçimleri.

**Artboard'lar**
- `DS.17 · Record Representations · Work · 1440`
- `DS.17 · Record Representations · Documents and knowledge · 1440`
- `DS.17 · Record Representations · Discovery and decisions · 1440`
- `DS.17 · Record Representations · Design and diagrams · 1440`
- `DS.17 · Record Representations · Tests, releases, production · 1440`
- `DS.17 · Record Representations · People and capture · 1440`

**Dört biçim:** *satır* (listeler, aramalar), *kart* (Board, Gallery, Wall), *kompakt etiket* (Calendar, ilişkiler, `Used in`, Favorites), *önizleme* (`00.9 · Context Record Preview`).

**Kural:** Bir kayıt her biçimde aynı çekirdeği taşır: tür işareti, anahtar (varsa), başlık, durum. Satırda çekirdeğin yanında aşağıdaki **satır meta**'sı görünür. Kart satır metasının ilk ikisini taşır. Kompakt etiket yalnız çekirdektir. Önizleme çekirdek + satır meta + kaydın kendi ilk bölümüdür.

| Kayıt türü | Çekirdek | Satır meta | Örnek | Sahibi |
|---|---|---|---|---|
| İş | `LUMA-42` · başlık · tür · durum | `Time in status`, öncelik ölçütü değerleri, planlanan başlangıç / hedef / `Reappear date`, blokaj ve risk, checklist ilerlemesi, `Not now` | `LUMA-51` · `Not now: Waiting for Stripe API v2 GA` | [09.2](09-work.md#092--work-list) |
| Belge | başlık · tür | kapsam rozeti, klasör, sürüm | `Reminder engine spec` · Spec | [10.1](10-documents.md#101--documents) |
| Karar | başlık · yaşam | — | `Retry failed webhooks for 72 hours` · `Valid` | [12.1](12-decisions.md#121--decisions) |
| Risk | başlık · yaşam | — | `Gmail flags reminder emails as spam` · `Mitigating` | [12.4](12-decisions.md#124--risks) |
| Varsayım | başlık · yaşam | — | `Clients read reminders on mobile first` · `Refuted` | [12.6](12-decisions.md#126--assumptions) |
| Açık Soru | başlık · yaşam | — | `Which email provider handles aliases correctly?` · `Answered` | [12.8](12-decisions.md#128--open-questions) |
| Kaynak | başlık · alan adı | tazelik, kaynak türü | `Receive Stripe events in your webhook endpoint` · `stripe.com` | [11.1](11-discovery.md#111--sources) |
| Geri Bildirim | başlık · durum | kanal, zaman, kişi | `Reminders land in spam with Gmail alias` · Email · `Reviewed` · Elif Kaya | [11.8](11-discovery.md#118--feedback) |
| Araştırma Oturumu | başlık · durum | zaman, kanal, katılımcı (izinliyse) | `Interview: chasing late invoices` · `Completed` · Video call | [11.5](11-discovery.md#115--research-sessions) |
| Doğrulama Kaydı | başlık · durum | — | `Fake-door pricing page` · Active | [11.12](11-discovery.md#1112--validation-records) |
| Ekran, Akış, Moodboard, Wall | başlık · önizleme | kayıt sayısı (Wall: kart sayısı) | `MVP story (14)` | [13.1](13-design.md#131--design) |
| Teknik Diyagram | başlık · tür | otorite kipi, son Diyagram Sürümü, köken | `Reminder pipeline` · `Technical Architecture` · `Product-authored Model` | [14.1](14-technical-diagrams.md#141--technical-diagrams) |
| Planlı Test Senaryosu | başlık · sürüm no | — | `Reminder reaches Gmail alias` v3 | [15.2](15-tests.md#152--planned-test-cases) |
| Test Oturumu | başlık · inceleme durumu | yürüten türü, yürüten, raporlayan, giriş yolu, rapor zamanı | `Codex · Gmail alias regression` · `Unreviewed` · `MCP` | [15.7](15-tests.md#157--test-sessions) |
| Proje Sürümü | ad · durum | `Version label`, kapsam sayısı, GitHub Release/tag | `tidekit 1.0` · `v1.0.0` · `Preparing` | [16.1](16-releases.md#161--project-releases) |
| Üretim Olayı | başlık · durum | `Occurred at`, etki özeti, ilişki sayısı | `Reminder emails delayed 3 hours` · `Watching` | [17.1](17-production.md#171--production-incidents) |
| Kişi | görünen ad (yoksa ilk e-posta, yoksa `Unnamed Contact`) | güncel Şirket | `Elif Kaya` · `Studio Kiraz` | [06.1](06-contacts.md#061--contacts) |
| Şirket | ad | Kişi sayısı | `Studio Kiraz · 1 Contact` | [06.1](06-contacts.md#061--contacts) |
| Yakalama öğesi | metin | zaman, köken, mini şablon alanları | `Idea: weekly digest of overdue invoices` | [03.1](03-capture.md#031--capture-inbox) |
| Proje Hedefi | başlık | canlı özet | `Freelancers get paid within 7 days` | [08.6](08-project-shell-and-overview.md#086--project-goals) |

Bu tablo ekran kartlarındaki liste bölgelerinden derlendi. Bir ayrıntı iki ekranda farklıysa bu tablo karar verir, ekran uyar. Tabloda `—` olan satırlarda ekran kartı şu an ek meta tanımlamıyor.

**Spec:** [33](../../specs/33-record-discovery/spec.md), [39](../../specs/39-favorites/spec.md), [28](../../specs/28-unified-calendar/spec.md).

