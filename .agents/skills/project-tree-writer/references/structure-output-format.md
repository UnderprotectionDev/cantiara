# structure.md Output Format

Bu dosya `structure.md` side effect'i, içerik şekli ve anti-bloat kurallarının tek
otoriter kaynağıdır.

## Side Effect Sınırı

Structure modunda tek dosya çıktısı hedef root'taki `structure.md` olur. Gerçek
klasör, başka dosya, diff, migration veya scaffold üretme. Soru turunda dosya yazma.
Overwrite izni Source Extraction Rules'a göre çözülmeden mevcut dosyayı değiştirme.

## Zorunlu Şekil

````markdown
# structure.md

```text
.
├── src/
│   ├── app/
│   └── features/
│       └── orders/
│           ├── components/
│           └── views/
├── package.json
└── tsconfig.json
```
````

Kurallar:

- Tek heading `# structure.md`.
- Heading'den sonra yalnız bir fenced `text` block.
- İlk tree satırı `.`.
- Her node geçerli `├──`, `└──`, `│   ` veya dört boşluk connector'ı kullanır.
- Klasörler trailing slash, dosyalar plain filename taşır.
- Her parent altında klasörler dosyalardan önce gelir.
- Son sibling `└──`, önceki sibling'ler `├──` kullanır.
- Kaynak özel sıra vermiyorsa sibling'leri anlaşılır/alphabetical tut; mevcut framework/IDE sırasını sırf alfabetik değil diye bozma.
- Tree satırında comment veya açıklama bulunmaz.
- Tree dışında paragraf, liste, varsayım, kaynak, gerekçe veya checklist bulunmaz.

## Derinlik

- Ana topology ve app/package ownership görünür kalır.
- Her gerçek product feature görünürdür.
- Feature içi yalnız yapısal ownership sınırları açılır.
- Önemli UI, server, schema, state veya params ownership'ini yalnız feature adıyla gizleme.
- Spekülatif component/action filename üretme.
- Çok feature varsa leaf detayını azalt; feature'ı silme veya generic umbrella altında eritme.

## Dosya Seçimi

Kaynakta yapısal anlamı varsa göster:

- root/workspace manifest ve lockfile;
- route entry dosyaları;
- framework generated/runtime entry;
- package manifest ve exports'u temsil eden source entry;
- schema/provider boundary;
- feature public API yalnız gerçekten gerekiyorsa;
- concrete server/action/command dosyası yalnız kaynak adı veriyorsa.

`index.ts`, `procedures.ts`, test klasörü, config, `.env.example`, Dockerfile veya provider bootstrap'ı genel iyi pratik diye ekleme.

## `src/` Default'u

Primary JS/TS greenfield normal repo ve monorepo app'lerinde application source varsayılan olarak `src/` altındadır. Manifest/config app veya package root'unda kalır. Kısmi scaffold açıkça başka convention kullanıyorsa mevcut kaynak convention'ı korunabilir.

Leaf workspace package'ı varsayılan olarak kendi manifesti ve `src/` sınırını taşır. Provider'ın zorunlu source layout'u istisna olabilir.

## Generic İsimler

`shared`, `common`, `utils`, `services`, `config`, `global` gibi generic klasörler yalnız kaynakta açık ownership/convention varsa gösterilir. Feature-local `hooks`, `store`, `lib` gibi seçici sınırlar kendi owner'ı altında generic bucket sayılmaz.

## Final Tree'ye Otomatik Taşınmayanlar

- input PRD, `CONTEXT.md`, tech-stack veya brief dosyaları;
- future/admin/mobile/public API scope'u aktif değilse;
- CI/CD, rollout ve observability notları;
- database tablo/kolon/ilişki detayı;
- kaynak dayanağı olmayan test/deploy/config klasörleri;
- capability checklist veya kalite notu;
- build artifact (`dist`, generated cache) kaynak açıkça hedef structure saymıyorsa.

Dosya yazıldıktan sonra assistant cevabı yalnız dosya yolunu ve tek cümlelik özeti
verir; tree'yi tekrar basmaz.
