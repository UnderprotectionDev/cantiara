# Source Extraction Rules

Bu dosya target root, kaynak keşfi, karar otoritesi, repo topology ve soru
protokolünün tek otoriter kaynağıdır. Buradaki `CONTEXT.md`, yalnız hedef projede
keşfedilen domain kaynağıdır; skill paketinin bakım `CONTEXT.md` dosyası runtime
girdisi değildir.

## İçindekiler

- Target root ve aşamalı tarama
- Karar otoritesi, product scope ve repo modeli
- Deployable/package ve root artifact kanıtı
- Soru protokolü ve capability checklist

## Target Root

CWD ve kullanıcının verdiği erişilebilir yerel yollar için en yakın proje/workspace sinyallerini ara:

- `package.json`, `Gemfile`, `composer.json` veya framework manifesti;
- `pnpm-workspace.yaml`, root workspaces alanı, `nx.json` veya eşdeğer workspace config;
- framework config ve lockfile;
- açık user-provided target path.

Kullanıcı yazma hedefi olarak erişilebilir bir local directory'yi açıkça verdiyse o
directory veya onun kaynaklarla kanıtlanan workspace root'u CWD'den üstündür. Kaynakları
başka dizinden okumuş olmak target root'u çalışma dizinine taşımaz.

Tek güçlü aday varsa kullan. Birden fazla app/workspace root'u eşit derecede mümkünse
seçenekli soru sor. Sırf CWD mevcut diye oraya yazma.

Monorepo seçildiyse varsayılan output root workspace root'udur. Kullanıcı açıkça yalnız bir app'i hedeflerse app-local tree üretilebilir.

Hedef root'ta `structure.md` varsa overwrite kararı çözülene kadar dosyaya yazma.

## Aşamalı Tarama

### Aşama 1 — Root

- manifest ve lockfile;
- workspace config;
- framework/runtime config;
- mevcut `structure.md`;
- eski `architecture.md`;
- `CONTEXT.md`, tech-stack ve PRD-equivalent product scope.

### Aşama 2 — Karar indexleri

- `docs/README.md` ve bir seviye altındaki açık indexler;
- `docs/adr/`, `docs/architecture/` veya açık eşdeğeri;
- indexin doğrudan işaret ettiği product/workflow brief.

### Aşama 3 — Topology

Workspace manifestinin tanımladığı app/package/project root'ları için:

- manifest;
- package exports ve workspace dependency'leri;
- framework config;
- `src`, `app`, `routes`, `features`, `prisma`, `convex` gibi sığ ownership sınırları.

Tüm repo, tüm docs veya tüm Markdown dosyalarını recursive tarama. Bir kaynak açıkça başka bir karar dosyasını işaret ediyorsa bir seviye takip et.

Kaynak keşfi yerel ve erişilebilir girdilerle sınırlıdır. Web araması yapma; URL'yi
veya erişilemeyen kaynağı okunmuş kanıt sayma.

## Karar Otoritesi

Tek global kaynak sırası kullanma. Her ekseni kendi otoritesiyle çöz:

| Karar ekseni | Birincil kanıt |
|---|---|
| Aktif product scope | Kullanıcı kararı, PRD veya eşdeğeri |
| Domain dili/ilişkiler | Kullanıcı kararı, `CONTEXT.md`, domain kaynağı |
| Framework/runtime/provider | Manifest, config, tech-stack |
| Repo topology/package graph | Workspace manifesti, project/package manifestleri |
| Architecture/ownership | Kullanıcı kararı, güncel ADR |
| Naming/mevcut convention | Kısmi scaffold |

Kullanıcının aynı eksendeki açık kararı yerel convention'dan üstündür. Tekrar onay isteme.

Bir kaynağın kendi ekseni dışındaki tesadüfi notunu otorite sayma. Örneğin PRD product scope için güçlüdür; eski bir “tek repo” cümlesi güncel workspace manifestini geçersiz kılmaz.

Aynı eksendeki güçlü kaynaklar çelişiyor ve seçim tree'yi değiştiriyorsa soru sor.

## Product Scope

PRD dosya adı zorunlu değildir. README, product brief, issue epic, exported spec, workflow brief veya kullanıcı capability listesi yeterli olabilir.

Product scope'tan çıkar:

- aktif ve future capability ayrımı;
- kullanıcı akışları ve ana surface'ler;
- form/list/detail ve lifecycle davranışları;
- server/client ownership sinyalleri;
- ayrı deployable veya client hedefleri.

Product scope yoksa feature tree uydurma. Framework skeleton'ı yalnız route/provider convention'ı verir; product feature vermez.

`CONTEXT.md` domain dilini güçlendirir fakat aktif scope'u tek başına belirlemez.

## Evidence-Weighted Repo Modeli

Güçlü monorepo kanıtları:

- workspace manifesti veya root workspaces alanı;
- workspace tarafından kapsanan birden fazla project/package manifesti;
- Nx project graph/config;
- açık kullanıcı/ADR monorepo kararı.

Güçlü normal-repo kanıtları:

- tek project manifesti;
- workspace config yokluğu;
- aynı deployable içinde client/server boundary kararı;
- açık kullanıcı/ADR normal-repo kararı.

Zayıf kanıtlar:

- yalnız `apps`, `packages` veya `libs` adlı klasör;
- product brief'te birden fazla client adı;
- future shared-code ihtimali;
- tek bir package benzeri klasör.

Web/mobile/desktop veya ayrı backend planlanmış fakat topology seçilmemişse monorepo seçeneğini önererek sor. Birden fazla deployable otomatik monorepo kararı değildir.

## Deployable ve Package Kanıtı

Ayrı process, build veya deploy hedefi app/service sinyalidir. Import edilen kaynak sınırı package sinyalidir.

Package için güçlü kanıt:

- leaf manifest/project config;
- exports;
- iki gerçek consumer dependency'si;
- açık cross-app architecture kararı.

“İleride paylaşılabilir” package açmak için yeterli değildir.

## Root ve Artifact Sinyalleri

Yalnız kaynak kararı veya gerçek convention varsa tree'ye taşı:

- package manager manifest/lock/workspace config;
- framework config;
- ORM/provider config;
- `proxy.ts`, provider bootstrap veya worker entry;
- `.env.example`, Dockerfile veya platform artifact'i;
- test structure;
- kalıcı docs/ADR boundary.

Deployment platform adı, observability vendor'ı, test framework adı veya env kullanımı tek başına dosya/klasör üretmez.

PRD, `CONTEXT.md`, tech-stack ve brief dosyaları input oldukları için otomatik final tree'ye girmez. Kalıcı repo dokümanı olmaları ayrıca kaynakta seçilmelidir.

## Soru Protokolü

Tree'yi değiştiren bilgi eksikse her turda yalnız bir Türkçe soru sor. Soru:

- 2 veya 3 seçeneği sıralı `- A)`, `- B)` ve gerekirse `- C)` biçiminde taşır;
- tam bir seçenek içinde yalnız bir `(önerim)` etiketi taşır;
- her seçenekte `:` sonrasında kısa gerekçe verir;
- kanıt yetersizse en küçük ve geri alınabilir seçeneği önerir.

Tree'yi değiştiren ilk unresolved ekseni sor:

1. target root;
2. overwrite;
3. repo modeli;
4. framework/deployable sınırı;
5. product scope;
6. app/domain ownership;
7. cross-app package, provider, persistence veya supporting-state.

Overwrite sorusunu tam olarak şu biçimde kullan:

```text
**Mevcut structure.md:** Hedef root'taki dosya için nasıl ilerleyeyim?
- A) Üzerine yaz (önerim): Güncel hedef tree aynı dosyaya yazılır.
- B) Yalnız cevapta göster: Dosya değiştirilmez.
- C) İptal et: Hiçbir çıktı yazılmaz.
```

## Capability Checklist

Yazmadan önce içerden doğrula:

- yazma yolu çözülen target root'un doğrudan altındaki `structure.md` yoludur;
- her aktif product capability değerlendirildi;
- ana route/surface karşılığı var;
- primary JS/TS product behavior feature boundary'sinde;
- route/API entry ince adapter;
- provider/persistence doğru sahibinde;
- supporting-state ve core behavior doğru sınıflandırıldı;
- monorepo app/package/Nx ownership'i topology ile uyumlu;
- root/config/test/deploy artifact'leri source-backed;
- input dokümanları kaynak envanteri olarak tree'ye taşınmadı.

Checklist'i output'a veya ayrı dosyaya yazma.
