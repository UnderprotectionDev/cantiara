---
name: project-tree-writer
description: Greenfield full-stack proje kaynaklarından normal repo veya monorepo hedef ağacını çıkarır, eksik yapısal kararları seçenekli sorar ve hedef root'a yalnız structure.md yazar.
disable-model-invocation: true
---

# Project Tree Writer

Greenfield full-stack proje kaynaklarından nihai hedef klasör ağacını çıkar ve hedef
root'a `structure.md` yaz. Mevcut dosyaları yalnız greenfield hedef kararları ve kısmi
convention sinyalleri için kanıt say; bu bir migration veya refactor akışı değildir.

## Kapsam

Birincil kapsamda Next.js, TanStack Start/Router, Vite, React Router Framework Mode,
Hono, Bun, oRPC, Prisma, Drizzle ve bunların normal repo, package-manager workspace,
Turborepo veya Nx biçimlerini destekle.

Rails, Laravel ve SvelteKit'i convention-preserving fallback olarak ele al.

## 1. Kaynakları ve Kararları Çöz

[Source Extraction Rules](references/source-extraction-rules.md) dosyasını tamamen
oku. Oradaki aşamalı keşifle target root'u, overwrite durumunu, kaynak rollerini,
repo modelini, deployable sınırlarını ve product scope'u çöz.

**Tamamlanma ölçütü:** Her karar ekseni kendi otoritesiyle değerlendirilmiştir;
target root ve kaynak seti kesindir. Tree'yi değiştiren ilk çözümsüz eksen varsa
referanstaki tek-soru protokolü uygulanmış ve bu tur bitirilmiştir.

## 2. İlgili Karar Referanslarını Aç

Her tree üretiminde şu ortak referansları tamamen oku:

- [Architecture Decision Rules](references/architecture-decision-rules.md)
- [structure.md Output Format](references/structure-output-format.md)

Repo modeli çözüldükten sonra yalnız ilgili topology referansını tamamen oku:

- normal repo: [Normal Repo Patterns](references/normal-repo-patterns.md)
- monorepo: [Monorepo Patterns](references/monorepo-patterns.md)

Seçilen framework/provider branch'lerini
[Full-Stack Framework Hints](references/full-stack-patterns.md) içinde oku. Concrete
bir stack bileşimini kurmak için örnek gerekiyorsa
[JS/TS Structure Examples](references/js-stack-examples.md) dosyasını kullan; örnek
domain adlarını hedef tree'ye taşıma.

**Tamamlanma ölçütü:** Ortak referanslar, tek topology referansı ve kaynakların
tetiklediği framework/provider bölümleri okunmuştur; örnekler karar otoritesi olarak
kullanılmamıştır.

## 3. Hedef Tree'yi Kur

Product capability, route surface, feature ownership, provider/persistence ve
app/package adaylarını kaynaklardan çıkar. Her gerçek capability ile yapısal
boundary'yi Source Extraction Rules içindeki Capability Checklist'e karşı tek tek
hesaba kat.

**Tamamlanma ölçütü:** Checklist'in her maddesi kanıtla karşılanmıştır; hiçbir gerçek
capability kaybolmamış, hiçbir source-free boundary veya artifact eklenmemiş ve
tree'yi değiştiren belirsizlik kalmamıştır.

## 4. Çıktıyı Teslim Et

Dosyayı ve konuşma yanıtını Output Format sözleşmesine göre teslim et.

**Tamamlanma ölçütü:** Output Format'taki dosya, side-effect ve konuşma yanıtı
koşullarının tümü karşılanmıştır.

## Bakım ve Regresyon

Bu paketi değiştirirken önce runtime girdisi olmayan
[bakım sözlüğünü](CONTEXT.md), ardından
[regression coverage indexini](references/regression-cases.md) oku.

- Fixture schema veya case metadata'sı değişiyorsa
  [fixture-contract.md](references/fixture-contract.md) dosyasını güncelle.
- Tree/question semantic kuralı değişiyorsa
  [`scripts/check_structure_fixtures.py`](scripts/check_structure_fixtures.py) ve ilgili
  fixture'ları birlikte güncelle.
- Runner payload, activation, output veya side-effect değerlendirmesi değişiyorsa
  [`scripts/run_behavior_evals.py`](scripts/run_behavior_evals.py) sözleşmesini güncelle.
- Her yeni veya değişen güvence için
  [`tests/test_structure_tools.py`](tests/test_structure_tools.py) regresyonu ekle.
