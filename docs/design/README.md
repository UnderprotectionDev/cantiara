# Cantiara Paper Tasarım Haritası

Cantiara'nın arayüzü Paper'da `Cantiara/` klasöründeki 9 dosyada çizilir. Bu klasör hangi sayfaların olduğunu ve her ekranın içinde ne olduğunu tutar. [`pages/`](pages/) altındaki her dosya bir Paper sayfasıdır.

## Paper dosyaları

Tek dosya Paper'ın node ve artboard sınırını aştığı için tasarım 9 dosyaya bölünmüştür. Bütçe: dosya başına en çok 25k node ve 100 artboard; sayfa başına yaklaşık 12k node ve 60 artboard. Eski tek dosya `Cantiara · Product` arşivdedir; ona çizilmez.

| Paper dosyası | Sayfalar |
|---|---|
| `Cantiara · 00 Foundations` | Index, Brand · Logo, DS · Foundations, DS · Foundations · Dark |
| `Cantiara · 01 Components` | DS · Components, DS · Components · Dark |
| `Cantiara · 02 Patterns` | DS · Patterns, DS · Patterns · Dark |
| `Cantiara · 03 Shell` | 00 · Shared Shell, 20 · Shared Dialogs & States |
| `Cantiara · 04 Account & Personal` | 01 · Account – 07 · Product Gaps |
| `Cantiara · 05 Project Core` | 08 · Project Shell & Overview, 09 · Work |
| `Cantiara · 06 Project Records` | 10 · Documents, 11 · Discovery, 12 · Decisions |
| `Cantiara · 07 Project Tools` | 13 · Design, 14 · Technical Diagrams, 15 · Tests |
| `Cantiara · 08 Delivery & Public` | 16 · Releases – 19 · Public Surfaces |

- Token'ların tek kaynağı `00 Foundations`'tır. Token değişince `Copy theme` ile alınıp diğer dosyalara `Paste theme` ile yeniden yapıştırılır; dosyalar arası otomatik güncelleme yoktur.
- `03 Shell` içindeki `00 · Shared Shell` kabuğun kanonik çizimidir: düz kabuk (sidebar | hairline | main, iç içe yuvarlak kart yok), üst çubuk yok, 48px breadcrumb başlık, liste satırları 38px, popover'lar 380px ve oksuz, kayıt panelinde 40px şerit içinde 26px düz sekmeler. Design System dosyaları ve ekran dosyaları kabuk parçalarını buradan kopyalar; yeniden çizmez.
- `20 · Shared Dialogs & States` ekranları `02 Patterns` içindeki DS.15, DS.16 ve DS.19 desenlerinin klonudur; o desenler değişince `20` yeniden klonlanır.

## Sıra

1. [Design System](pages/design-system.md): önce DS.0 kararları, sonra bileşenler ve ortak desenler (sayfa başlığı, kayıt başlığı, liste araç çubuğu, dialog çerçevesi vb.).
2. [00 · Shared Shell](pages/00-shared-shell.md): gezinme, 48px breadcrumb başlık, uygulama çerçevesi.
3. Geri kalan sayfalar numara sırasıyla. `20 · Shared Dialogs & States` ortak dialog ve durumları bir kez tanımlar; diğer sayfalar ona referans verir.

Bir parça birden çok sayfada görünüyorsa tek yerde çizilir (`Design System`, `00` veya `20`); diğer sayfalar yeniden çizmez.

İstisna: Design tuvallerinin ortak kabuğu (araç çubuğu, zoom, `Fit View`, `Presentation Mode`, kişisel viewport) [13.2](pages/13-design.md#132--canvas-chrome) içinde tek yerde tanımlıdır. Design System yalnız ona işaret eder; `09`, `13` ve `14` yeniden listelemez.

## Sayfalar

| Paper sayfası | Ekran |
|---|---|
| [Design System](pages/design-system.md) | 18 |
| [00 · Shared Shell](pages/00-shared-shell.md) | 12 |
| [01 · Account](pages/01-account.md) | 8 |
| [02 · Workspace](pages/02-workspace.md) | 14 |
| [03 · Capture](pages/03-capture.md) | 9 |
| [04 · Personal Planning](pages/04-personal-planning.md) | 5 |
| [05 · Personal Wiki](pages/05-personal-wiki.md) | 3 |
| [06 · Contacts](pages/06-contacts.md) | 8 |
| [07 · Product Gaps](pages/07-product-gaps.md) | 3 |
| [08 · Project Shell & Overview](pages/08-project-shell-and-overview.md) | 28 |
| [09 · Work](pages/09-work.md) | 30 |
| [10 · Documents](pages/10-documents.md) | 14 |
| [11 · Discovery](pages/11-discovery.md) | 13 |
| [12 · Decisions](pages/12-decisions.md) | 10 |
| [13 · Design](pages/13-design.md) | 13 |
| [14 · Technical Diagrams](pages/14-technical-diagrams.md) | 9 |
| [15 · Tests](pages/15-tests.md) | 21 |
| [16 · Releases](pages/16-releases.md) | 9 |
| [17 · Production](pages/17-production.md) | 3 |
| [18 · GitHub](pages/18-github.md) | 9 |
| [19 · Public Surfaces](pages/19-public-surfaces.md) | 9 |
| [20 · Shared Dialogs & States](pages/20-shared-dialogs-and-states.md) | 22 |

Toplam 266 ekran.

Ekranı olmayan spec: [85 Operasyonel Yedek, Kurtarma ve Alarm](../specs/85-operator-backup-and-alarms/spec.md). Spec "No founder-facing restore UI" ve "No Turkish product UI" der; kurucuya dönük yüzey açmaz.

## Ekran nasıl yazılır

Her ekran yalnız içeriği söyler: amaç, artboard adları, bölgeler (içerik ve label'lar), durumlar ve spec bağlantısı. Neyin nerede duracağı, hiyerarşi ve yerleşim burada yazılmaz; onu çizen karar verir. Artboard adı biçimi: `NN.M · <Screen> · <durum> · <genişlik>`. `Loading`, `Error`, `Empty`, `Offline`, `Many items`, `Long content` ve `Validation` gibi durumlar artboard'sız `####` olarak yazılır; yalnız yerleşimi veya içeriği ayırt edici biçimde değişen durumlar artboard alır. Ekran numaraları kalıcıdır; kaldırılan ekranın numarası yeniden kullanılmaz, bu yüzden numaralarda aralıklar vardır.

## Kurallar

- **Genişlik:** Uygulama ekranları 1440. 768 yalnız layout'u değişen ekranlarda. 390 yalnız `19 · Public Surfaces` ve `03.8 · Web Capture` (uzantı açılır penceresi). Kimlik doğrulamalı mobil ürün kapsam dışıdır ([PRD 19](../prd/19-out-of-scope.md)).
- **Light / Dark:** Varsayılan tema Dark'tır. Ekranlar Dark çizilir; Light yalnız adında `· Light` olan artboard'larda. Design System dosyaları (00–02) iki temayı ayrı sayfalarda tutar; Dark artboard'lar `-dark` token setini kullanır.
- **Metin:** Ekrandaki İngilizce metin spec'in kesin UI label'ıdır; terimler [`CONTEXT.md`](../../CONTEXT.md) sözlüğünü izler. Spec'te metni olmayan yerler için seçilen label'lar [PRD 02 sözlüğüne](../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) eklenmiştir.
- **Sahiplik:** Ürün davranışının sahibi [`docs/specs/`](../specs/) ve [`docs/prd/`](../prd/). Bu harita onlarla çelişirse harita güncellenir.

## Örnek Workspace

Bütün ekranlar aynı kurgusal Workspace'i kullanır. Başka proje veya kişi uydurulmaz.

- **Kurucu:** Alex Morgan (GitHub `alexmorgan`).
- **Luma:** `Solo SaaS`, serbest çalışanlar için fatura hatırlatıcı. Kısa kodu `LUMA`, aktif. Aşamaları: `Discovery` Tamamlandı, `MVP` Aktif, `Beta` Hazır, `Launch` Planlanmadı. Ana örnek projedir.
- **tidekit:** `Open Source Library`, TypeScript tarih yardımcıları. Kısa kodu `TIDE`, aktif. GitHub, Releases (`v0.9.0`, `v1.0.0`) ve Build in Public ekranlarında kullanılır.
- **Ferry:** `Mobile Application`. Kısa kodu `FRY`, arşivli. Arşiv ve salt okunur durumlarda kullanılır.
- **İşler:**
  - `LUMA-42 Reminder email bounces for Gmail aliases` (Bug, In Progress)
  - `LUMA-51 Stripe webhook retry` (Feature)
  - `LUMA-58 Onboarding checklist copy` (Task)
  - `LUMA-63 Research: late-payment etiquette` (Research)
- **Wiki:** `Pricing heuristics`, `Weekly review template`, `How I write specs`.
- **Kişiler:** `Emma Clark` (`Brightwave Studio`), `Daniel Reed` (`Reed Design`).
- **Bugün:** Cuma, 2026-11-13.
