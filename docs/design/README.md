# Cantiara Paper Tasarım Haritası

Cantiara'nın bütün arayüzü Paper'da tek bir yeni dosyada çizilir. Bu klasör hangi sayfaların olduğunu ve her ekranın içinde ne olduğunu tutar. [`pages/`](pages/) altındaki her dosya bir Paper sayfasıdır.

## Sıra

1. [Design System](pages/design-system.md): önce DS.0 kararları, sonra bileşenler ve ortak desenler (sayfa başlığı, kayıt başlığı, liste araç çubuğu, dialog çerçevesi vb.).
2. [00 · Shared Shell](pages/00-shared-shell.md): gezinme, üst çubuk, uygulama çerçevesi.
3. Geri kalan sayfalar numara sırasıyla. `20 · Shared Dialogs & States` ortak dialog ve durumları bir kez tanımlar; diğer sayfalar ona referans verir.

Bir parça birden çok sayfada görünüyorsa tek yerde çizilir (`Design System`, `00` veya `20`); diğer sayfalar yeniden çizmez.

## Sayfalar

| Paper sayfası | Ekran |
|---|---|
| [Design System](pages/design-system.md) | 18 |
| [00 · Shared Shell](pages/00-shared-shell.md) | 8 |
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
| [15 · Tests](pages/15-tests.md) | 20 |
| [16 · Releases](pages/16-releases.md) | 9 |
| [17 · Production](pages/17-production.md) | 3 |
| [18 · GitHub](pages/18-github.md) | 9 |
| [19 · Public Surfaces](pages/19-public-surfaces.md) | 9 |
| [20 · Shared Dialogs & States](pages/20-shared-dialogs-and-states.md) | 21 |

Toplam 264 ekran.

Ekranı olmayan spec: [85 Operasyonel Yedek, Kurtarma ve Alarm](../specs/85-operator-backup-and-alarms/spec.md). Spec "No founder-facing restore UI" ve "No Turkish product UI" der; kurucuya dönük yüzey açmaz.

## Ekran nasıl yazılır

Her ekran yalnız içeriği söyler: amaç, artboard adları, bölgeler (içerik ve label'lar), durumlar ve spec bağlantısı. Neyin nerede duracağı, hiyerarşi ve yerleşim burada yazılmaz; onu çizen karar verir. Artboard adı biçimi: `NN.M · <Screen> · <durum> · <genişlik>`.

## Kurallar

- **Genişlik:** Uygulama ekranları 1440. 768 yalnız layout'u değişen ekranlarda. 390 yalnız `19 · Public Surfaces`. Kimlik doğrulamalı mobil ürün kapsam dışıdır ([PRD 19](../prd/19-out-of-scope.md)).
- **Light / Dark:** Light çizilir. Dark yalnız adında `· Dark` olan artboard'larda.
- **Metin:** Ekrandaki İngilizce metin spec'in kesin UI label'ıdır; terimler [`CONTEXT.md`](../../CONTEXT.md) sözlüğünü izler. Spec'te metni olmayan yerler için seçilen label'lar [PRD 02 sözlüğüne](../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) eklenmiştir.
- **Sahiplik:** Ürün davranışının sahibi [`docs/specs/`](../specs/) ve [`docs/prd/`](../prd/). Bu harita onlarla çelişirse harita güncellenir.

## Örnek Workspace

Bütün ekranlar aynı kurgusal Workspace'i kullanır. Başka proje veya kişi uydurulmaz.

- **Kurucu:** Deniz Aksoy (GitHub `denizaksoy`).
- **Luma:** `Solo SaaS`, serbest çalışanlar için fatura hatırlatıcı. Kısa kodu `LUMA`, aktif. Aşamaları: `Discovery` Tamamlandı, `MVP` Aktif, `Beta` Hazır, `Launch` Planlanmadı. Ana örnek projedir.
- **tidekit:** `Open Source Library`, TypeScript tarih yardımcıları. Kısa kodu `TIDE`, aktif. GitHub, Releases (`v0.9.0`, `v1.0.0`) ve Build in Public ekranlarında kullanılır.
- **Ferry:** `Mobile Application`. Kısa kodu `FRY`, arşivli. Arşiv ve salt okunur durumlarda kullanılır.
- **İşler:**
  - `LUMA-42 Reminder email bounces for Gmail aliases` (Bug, In Progress)
  - `LUMA-51 Stripe webhook retry` (Feature)
  - `LUMA-58 Onboarding checklist copy` (Task)
  - `LUMA-63 Research: late-payment etiquette` (Research)
- **Wiki:** `Pricing heuristics`, `Weekly review template`, `How I write specs`.
- **Kişiler:** `Elif Kaya` (`Studio Kiraz`), `Marco Rossi` (`Rossi Design`).
- **Bugün:** Perşembe, 2026-10-22.
