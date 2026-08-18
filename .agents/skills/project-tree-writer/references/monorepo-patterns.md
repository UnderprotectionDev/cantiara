# Monorepo Topology

Bu dosya Source Extraction Rules tarafından monorepo olarak çözülen workspace'te
deployable app, Nx app-scoped library ve cross-app package yerleşiminin otoriter
kaynağıdır. Product ownership için Architecture Decision Rules,
framework/provider-specific yerleşim için Full-Stack Framework Hints kazanır.

## Workspace Sınırı

Package-manager workspace'te deployable app/service `apps/*`, import edilen reusable
source `packages/*` altında düşünülür. Nx project graph'ında app-specific feature
library `libs/<app-scope>/feature-*` altında bulunabilir.

Target root'u Source Extraction Rules belirler. Workspace root release/topology
sınırını, her deployable kendi project sınırını korur; concrete dosya yerleşimini
Output Format ve framework/provider referansı belirler.

## Deployable App

Ayrı process, build veya deploy hedefi app/service'tir: web, mobile, desktop,
API/backend, worker/job runner veya ortak provider backend. App manifest/config'i app
root'ta, application source Output Format'taki `src/` default'unda kalır; framework
zorunlu özel layout veriyorsa onu koru.

Ortak backend'i ağ üzerinden kullanan client app'ler backend source dosyalarını
doğrudan import etmez. Backend server-side product behavior, transport adapter,
backend-only persistence ve runtime/provider bootstrap'ın sahibidir. Import edilen
stable contract veya client yüzeyi gerekiyorsa onu ayrı cross-app leaf package olarak
değerlendir.

## Aynı Domain, Farklı App Ownership'i

Aynı domain adı backend, web, mobile veya desktop app'lerinde ayrı ownership parçaları
taşıyabilir. Bu code duplication kararı değildir: backend server behavior'ı, client
app'ler kendi platform UI/state'ini taşır. Her app'e aynı feature listesini otomatik
kopyalama; yalnız gerçek surface veya behavior'ı göster.

## Cross-App Package Eşiği

Leaf package yalnız şu kanıtlardan biri varsa açılır:

- en az iki gerçek app consumer;
- workspace dependency/import;
- manifest exports;
- açık greenfield architecture kararı.

“İleride paylaşılabilir” yeterli değildir. Domain rule, API contract,
provider-independent client, platform-uyumlu UI veya repo tooling paylaşılabilir;
platform UI/state, app adapter, tek-app route/server function ve future reuse adayı
app-local kalır.

## Package Grupları ve Leaf Package

`packages/` altındaki ara klasörler içeriğe göre açılan organizasyon gruplarıdır;
kendi manifestleri yoktur. Sabit boş `domain`, `contracts`, `libraries`, `ui` veya
`tooling` listesi basma.

Leaf package:

- kendi `package.json` veya project config'ini;
- Output Format'taki varsayılan `src/` sınırını;
- kaynak manifestteki gerçek public entry/exports kararını taşır.

Workspace glob'u nested leaf'i kapsamalıdır. Parent group ile child leaf'i aynı anda
package yapma. Consumer'ı leaf iç dosyaya deep import ettirme; `dist` veya build cache'i
hedef source tree sayma.

## UI Paylaşımı

UI yalnız platform runtime ve component modeli gerçekten uyumluysa paylaşılır. Domain
ve contract paylaşımı UI paylaşımından bağımsızdır.

## Nx Branch

Nx'te app-specific feature library cross-app olmak zorunda değildir:

```text
apps/
  web/
libs/
  web/
    feature-orders/
```

Project graph, tags veya mevcut `libs/<scope>/feature-*` convention'ı varsa bunu koru.
Nx branch'ini package-manager workspace'in `packages/*` modeline dönüştürme.

## Çözümsüz Ownership

Kaynaklardan çözülemeyen deployable, backend, app ownership, consumer veya grouping
kararını Source Extraction Rules'taki sırayla sor. Kanıt yetersizse app-local ve daha
küçük yapıyı öner.
