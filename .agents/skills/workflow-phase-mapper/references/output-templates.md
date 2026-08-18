# HTML Önizleme ve Final Sözleşmesi

## Yaşam döngüsü

Geçici semantik JSON'u hedef proje dışında hazırla ve tek önizleme üret:

```text
python3 <skill-root>/scripts/prepare_preview.py <semantic-preview.json> \
  --project-root <target-project> \
  --workflow-dir <target-project>/docs/workflow
```

Araç kaynak hash'lerinden `sourceRevision`, semantik modelden `previewRevision` üretir ve yalnız `docs/workflow/index.html` dosyasını atomik değiştirir.

## Semantik önizleme girdisi

```json
{
  "title": "Randevu ürünü",
  "description": "Önerilen feature fazlarını inceleyin.",
  "sources": [
    {"label": "PRD", "role": "product", "path": "docs/prd.md"},
    {"label": "Stack", "role": "technical", "path": "package.json"}
  ],
  "phases": [
    {
      "id": "appointments",
      "order": 1,
      "phaseKind": "product-feature",
      "name": "Randevuları Planlama",
      "summary": "Kullanıcı randevu yaşam döngüsünü tamamlar ve güncel planını görür.",
      "prerequisites": {"allOf": [], "anyOf": []},
      "subphases": [
        {
          "id": "appointment-create",
          "order": 1,
          "name": "Randevu Ekleme",
          "outcome": "Geçerli randevu planlamaya eklenir."
        }
      ]
    }
  ]
}
```

Kaynak rolleri `product`, `technical`, `architecture`, `terminology`, `existing-state`; diagnostic faz türleri `product-feature`, `cross-cutting-feature`, `observable-system-capability` değerleridir. En az bir ürün ve bir teknik/architecture/existing-state otoritesi kullan.

Faz ve alt faz sıralarını 1'den kesintisiz tut. Kimlikleri kararlı ASCII slug yap. Gerçek bağımlılık graph'ını semantik modelde tut; HTML'de gösterme.

## HTML görünürlüğü

Her kart yalnız sıra/ad, 1–2 cümlelik değer-kapsam özeti ve varsa alt faz adlarıyla tek cümlelik sonuçlarını gösterir.

Kaynak metadata'sı ve hiyerarşi doğrulama alanları görünmeyen HTML metadata'sında kalabilir. Faz kartlarında ana/alt faz kimliği, sırası, adı ve alt faz sonucu deterministik `data-*` alanlarında bulunur. Bunlar kullanıcı state'i değildir.

HTML onay, feedback, kalıcı state, ağ isteği veya dosya yazımı içermez. Kullanıcı geri bildirimi konuşmada verir; her geri bildirim bütün kesimi yeniden doğrulatır ve aynı HTML dosyasını değiştirir.

## Final phase-context

Açık onay gösterilen güncel `PREVIEW_REVISION` değerine bağlanır. Final staging'i
yalnız bu onaydan sonra hazırla. Staging içinde her ana faz için:

```text
NN-<stable-phase-id>/phase-context.md
```

oluştur. Görünür yapı:

```markdown
# <Ana Faz Adı>

<Amaç, kullanıcı/sistem değeri ve kapsam sınırını doğal paragraflarla anlat.>

## Alt Fazlar

### <Alt Faz Adı>

<Amaç, temel akış, gözlenebilir sonuç ve yalnız maddi kuralları doğal anlat.>

## Tamamlanma Ölçütleri

- <Ana feature'ın bütünlüklü sonucunu doğrula.>

## Kapsam Sınırları

- <Feature'a özgü yanlış kapsamı engelle.>
```

Gerçek alt faz yoksa ilgili bölümü hiç yazma. Her alt fazı 2–4 kısa paragraf veya eşdeğer doğal akışla anlat. Yetki, olumsuz sonuç, hata ve toparlanmayı yalnız kaynakta maddi ise doğal metne yedir. Teknik trace, gizli graph ve diagnostic alanları görünür metne taşıma.

Yayımla:

```text
python3 <skill-root>/scripts/publish_phase_contexts.py \
  --workflow-dir <target-project>/docs/workflow \
  --staging-dir <staging-dir> \
  --approved-preview-revision <approved-preview-revision>
```

Araç onaylanan revizyonu mevcut HTML ile eşleştirir; `index.html` bütünlüğünü,
kaynakların güncelliğini, staging dizinlerinin tamlığını, temiz final sözleşmesini ve
preview/final hiyerarşi eşliğini doğrular. Yalnız doğrulanabilir legacy generated set
ilk yeniden üretimde değiştirilebilir. Marker’sız mevcut faz dizininde sahiplik
bilinmediği için işlem reddedilir. Başarılı yayım transaction içinde yapılır, onaylı
revizyonu stdout'ta görünür kılar ve son adımda `index.html` kaldırılır.
