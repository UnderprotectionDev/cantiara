# Normal Repo Topology

Bu dosya Source Extraction Rules tarafından normal repo olarak çözülen tek
project/deployable topology'sinin otoriter kaynağıdır. Product ownership için
Architecture Decision Rules, framework/provider yerleşimi için Full-Stack Framework
Hints, `src/` ve artifact kuralları için Output Format kazanır.

## Project Sınırı

Tek build/release/deploy hedefi project root'ta kalır. Concrete manifest, config ve
source yerleşimini Output Format ile seçilen framework/provider branch'i belirler.

Aynı deployable içindeki client, server, transport ve helper sınırları project içi
ownership'tir. Bunları ayrı workspace package, app wrapper veya service gibi gösterme.

## App-Local Ownership

Primary JS/TS feature sınırları Architecture Decision Rules'a göre app-local kalır.
Route/transport ağacı seçilen framework convention'ını, server composition ise yalnız
gerçek app-wide consumer varsa app-wide sınırı kullanır.

Shared app-local component, hook, helper, client veya state sınırı yalnız gerçek
cross-feature consumer ya da açık architecture kararı varsa görünür olur. Gelecekte
reuse ihtimali bu sınırları veya package'ı tek başına üretmez.

## Provider ve Persistence

Seçilen provider/persistence branch'ini Full-Stack Framework Hints'tan uygula. Tek
project'in sahip olduğu schema, migration, client ve bootstrap aynı project sınırında
kalır; yalnız type paylaşımı varsayımıyla workspace package üretme.

## Topology Guardrail'leri

Normal repo hedefinde kaynak kararı olmadan şunları üretme:

- workspace config veya `apps/web` wrapper;
- future reuse için `packages/*`;
- tek app feature'ını internal package;
- ayrı deployable kanıtı olmayan `apps/backend`;
- aynı project'in server/helper sınırı için ayrı release birimi.
