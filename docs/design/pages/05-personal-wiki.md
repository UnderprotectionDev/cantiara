# 05 · Personal Wiki

Projeye bağlı olmayan kalıcı bilgi: Wiki Belgeleri ve yayını.

| Ekran | Ne çizilir |
|---|---|
| [05.1 · Personal Wiki](#051--personal-wiki) | Wiki Belge ağacı ve editör farkları |
| [05.4 · Publish Wiki Document](#054--publish-wiki-document) | Kapalı dünya yayın önizlemesi |
| [05.5 · Unpublish](#055--unpublish) | Yayını kaldırma onayı |

## 05.1 · Personal Wiki
> Proje seçmeden Wiki Belgelerini klasör ve üst belge hiyerarşisiyle gezmek, yeni Belge açmak ve seçili Belgeyi düzenlemek.

**Artboard'lar**
- `05.1 · Personal Wiki · Default · 1440`
- `05.1 · Personal Wiki · Published · 1440`
- `05.1 · Personal Wiki · Create Document dialog · 1440`

### Sayfa başlığı
Kapsam adı, arşiv görünürlük anahtarı, oluşturma ve içe aktarma eylemleri. `Import` → `20.6 · Import` (tek Markdown dosyası Wiki Belgesi olarak); hedef kapsam `Personal Wiki` önceden dolu.
- **Label'lar:** `Personal Wiki`, `Documents`, `Archived`, `Create Document`, `Import`.

### Belge ağacı
Dar, kaydırılabilir ağaç: önce sahiplik grubu (yalnız `Personal Wiki`), sonra klasörler, klasör içinde üst belge → çocuk belge girintisi. Proje Belgeleri bu ağaçta hiç görünmez; karışık kapsamlı liste (`All Documents`, `Search`) ve satır rozetleri → `02.7`.
- **Label'lar:** Grup adı `Personal Wiki`; her satırda kapsam rozeti `Personal Wiki`.

### Belge editörü (Wiki farkları)
→ `10.2 · Document Editor` (başlık, tür, gövde, araç çubuğu, sürüm geçmişi, şablonlar, klasör ve üst belge, arşiv, ilişkiler, Dosya Ekleri, dışa aktarma) aynen. Wiki'de farklı olanlar:
  - Kayıt başlığındaki kapsam rozeti `Personal Wiki` (Proje adı yerine).
  - Proje gerektiren dönüşümler (Belgeden İş veya Teknik Diyagram dönüşümü) görünmez.
  - Kayıt eylem menüsünde `Publish Wiki Document` vardır → `05.4 · Publish Wiki Document`; Yayımlanmış Belgenin yayın satırı → `Published` durumu.
  - `Copy` hedefi olarak Aktif Proje seçilebilir; `Move` Wiki'den Projeye sunulmaz (→ `10.10 · Move or Copy Document`). Projeden Wiki'ye `Move` ve varsayılan `Target scope` = `Personal Wiki` → `10.10`.
  - Wiki içeriği kendiliğinden Proje şablonuna, İşe veya başka yapılandırılmış kayda dönüşmez.
- **Label'lar:** `Personal Wiki`, `Publish Wiki Document`, `Copy`.

### Durumlar
#### Empty
Hiç Wiki Belgesi yokken ağaç boş, editör yerinde tek satır boşluk ve `Create Document` birincil kalır.
#### Loading
Ağaç ve editör yerinde iskelet satırlar.
#### Error
`Documents could not be loaded.`.
#### Create Document dialog open
→ `10.3 · Create Document`; Wiki farkı: Proje seçici yoktur; `Starter skeleton` Proje gerektirdiği için sunulmaz (kural sahibi `10.3`). Oluşan Belge doğrudan ağaçta seçili açılır.
#### Newer version available
→ `10.2 · Document Editor` › Daha yeni sürüm; Wiki'ye özgü fark yoktur, bu yüzden burada artboard çizilmez.
#### Archived
`Archived` açık; ağaç arşivli Belgeleri listeler. Arşivli kayıt davranışı → `DS.11 · Record Header` (Archived).
#### Published
Yayımlanmış Belgede kayıt başlığının altında sessiz yayın satırı: yayın tarihi, onaylanan sürüm, indeksleme durumu (varsayılan `noindex`; `Enable indexing` / `Disable indexing` → `05.4 › Görünürlük`) ve `Unpublish` (→ `05.5`). Canlı düzenleme yayına akmaz; satır bunu söyler. Kaynakta onaysız değişiklik varsa yayın satırında `Unpublished changes` görünür (spec 75 label'ı, `08.24` ile aynı; Wiki yayınında mevcut ad, yeni bağlam). Yeni revizyonu onaylamak için `Publish Wiki Document` yeniden açılır (→ `05.4`); onaylanana kadar ziyaretçi önceki onaylı revizyonu görür.
#### Never published
Yayın satırı yoktur; ziyaretçi URL'si yoktur. Hiçbir yerde "public" ipucu görünmez.
#### Long content
Derin hiyerarşi: ağaç girintisi en çok birkaç seviye okunur kalır; uzun başlık → `DS.15 · State Patterns` › Long content.

**Spec:** [32 Kişisel Wiki](../../specs/32-personal-wiki/spec.md) (sahip); [31 Belgeler](../../specs/31-documents/spec.md) (editör ve yetenekler); [72 Kişisel kabuk](../../specs/72-personal-shell/spec.md) (giriş); [74 Tekil Wiki Yayını](../../specs/74-wiki-publishing/spec.md) (yayın eylemi).

## 05.4 · Publish Wiki Document
> Tek bir Wiki Belgesini kapalı dünya önizlemesiyle, her gömüyü ayrı onaylayarak bağımsız herkese açık snapshot olarak yayımlamak.

**Artboard'lar**
- `05.4 · Publish Wiki Document · Default · 1440`
- `05.4 · Publish Wiki Document · Placeholders unresolved · 1440`
- `05.4 · Publish Wiki Document · Indexing enabled warning · 1440`
- `05.4 · Publish Wiki Document · Many embeds · 1440`

### Kök Belge
Geniş dialog veya yan sheet'in üstü: yayımlanacak Belge, kesin sürüm ve çıkacak alanlar; başlık Belge başlığıdır, isteğe bağlı açık özet `Public summary` Belgeye özgüdür; isteğe bağlı slug ve arama alanları (`Search title`, `Search description`) snapshot alanıdır (spec 74 Metadata). Hiçbiri sayfayı kendiliğinden indekslenebilir yapmaz ve Proje yüzeyinden miras alınmaz. Wiki yayınında yönlendirme yoktur: her slug sayfayı yönlendirmesiz sunar (spec 74 #486); bu yüzden `20.4 › Yayın ayarları`'ndaki adres çakışması ve `Redirect preview` burada çizilmez.
- **Label'lar:** `Publish Wiki Document`, `Approved snapshot`, `Public summary`, `Page address (optional)` (slug alanı), `Search title`, `Search description`.
- **Spec etiketleri:** `Approved snapshot` → spec 73 (ortak adaptör). `Public summary` → spec 75. `Search description` → PRD 02.

### Gömüler ve üyeler
Kaydırılabilir üye listesi: satır içi referanslar, geri bağlantılar, Dosya Ekleri, çocuk Belgeler, canlı Akıllı Koleksiyon blokları, canlı içerik bölümleri ve diğer gömüler; her biri ayrı satır ve ayrı onay kutusu. Varsayılan seçili değildir; onaylanmayan gömü yayından çıkar. Secret, paylaşım token'ı ve bağlantı parolası listede hiç yoktur (→ `20.4 › Hariç tutulanlar ve dolaylı sızıntı`).
- **Label'lar:** `Live external source` (dış gömü satırı); canlı blok satırı "tarih etiketli salt okunur snapshot olur" açıklamasıyla.

### Yer tutucular
→ `20.4 · Share › Yer tutucu kontrolü` (aynı çizim yeniden kullanılır; yeniden tarif edilmez).
- **Label'lar:** `Publish/share anyway`.

### Görünürlük
Varsayılan `noindex` ve sitemap dışı. İndeksleme yalnız açık eylemle ve üçüncü taraf kopyaların tam geri çağrılamayacağı uyarısı onaylanarak açılır; uyarı çizimi → `20.4 · Share › Yayın ayarları`.
- **Label'lar:** `Enable indexing`, `Disable indexing` (CONTEXT.md › Wiki indeksleme izni; spec 74 #486).

### Eylem satırı
Tek birincil yayın eylemi ve vazgeçme.
- **Label'lar:** `Publish Wiki Document`, `Cancel`.

### Durumlar
#### Default
Üyeler listelenmiş, hiçbiri seçili değil, yer tutucu yok.
#### Placeholders unresolved
Yer tutucu bölümü dolu; `Publish/share anyway` görünür.
#### Indexing enabled warning
`Enable indexing` seçildi; uyarı onayı bekleniyor → `20.4 · Share › Yayın ayarları`.
#### Many embeds
Uzun üye listesi; tür başlıklarıyla gruplu, kaydırılır.
#### Published
Dialog kapanır; `05.1` › `Published` durumu; ziyaretçi sayfası → `19.4 · Published Wiki Page`.
#### Error
Yayın başarısızsa dialog açık kalır, seçimler korunur; → `20.15 · Support Reference Error`.
#### Offline
Yayın çevrimiçi gerektirir → `20.16 · Offline`.

**Spec:** [74 Tekil Wiki Yayını](../../specs/74-wiki-publishing/spec.md) (sahip); [73 Bağlantı paylaşımı](../../specs/73-link-sharing/spec.md) (ortak önizleme, yer tutucu ve erişim adaptörü); [76 Dış yüzey yönetimi](../../specs/76-external-surface-management/spec.md) (sonuç listesi); [32 Kişisel Wiki](../../specs/32-personal-wiki/spec.md) (kök kapsam).

## 05.5 · Unpublish
> Yayımlanmış Wiki Belgesinin yeni HTML ve varlık erişimini cache'den önce kapatmak.

**Artboard'lar**
- `05.5 · Unpublish · Confirm · 1440`

### Onay
Küçük onay dialog'u; metin ve eylemler → `20.4 · Share › Yayın ayarları` (Unpublish onayı). Wiki'ye özgü delta: canlı Wiki Belgesi ve geçmişi silinmez. Ziyaretçi tarafı (`410 Gone`) → `19.9 · 410 Gone`; yaşam döngüsü dizini → `02.13 · Shares and Publications`.
- **Label'lar:** `Unpublish`, `Cancel`.

### Durumlar
#### Confirm
Onay dialog'u açık: `Unpublish` ve `Cancel` görünür; metin `20.4 · Share › Yayın ayarları` (Unpublish onayı) ile aynıdır, burada yeniden yazılmaz.
#### Unpublished
`05.1`'deki yayın satırı kalkar; Belge `05.1` › Never published gibi görünür ama geçmiş yayın `Shares and Publications` listesinde kalır (→ `02.13 · Shares and Publications`). URL yeniden kullanılmaz; yeniden yayın yeni Dış yüzey ve yeni URL doğurur. Ziyaretçi tarafı → `19.9 · 410 Gone`.
#### Error
İptal başarısızsa dialog açık kalır → `20.15 · Support Reference Error`.

**Spec:** [74 Tekil Wiki Yayını](../../specs/74-wiki-publishing/spec.md); [76 Dış yüzey yönetimi](../../specs/76-external-surface-management/spec.md) (`Revoke / Unpublish` aynı eylem).
