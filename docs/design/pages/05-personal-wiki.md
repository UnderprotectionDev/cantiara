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
- `05.1 · Personal Wiki · Default · 768`
- `05.1 · Personal Wiki · Empty · 1440`
- `05.1 · Personal Wiki · Newer version available · 1440`
- `05.1 · Personal Wiki · Published · 1440`
- `05.1 · Personal Wiki · Create Document dialog · 1440`

### Sayfa başlığı
Kapsam adı, arşiv görünürlük anahtarı, oluşturma eylemi.
- **Label'lar:** `Personal Wiki`, `Documents`, `Archived`, `Create Document`.

### Belge ağacı
Dar, kaydırılabilir ağaç: önce sahiplik grubu (yalnız `Personal Wiki`), sonra klasörler, klasör içinde üst belge → çocuk belge girintisi. Proje Belgeleri bu ağaçta hiç görünmez.
- **Label'lar:** Grup adı `Personal Wiki`; her satırda kapsam rozeti `Personal Wiki`.

### Belge editörü (Wiki farkları)
→ `10.2 · Document Editor` (başlık, tür, gövde, araç çubuğu, sürüm geçmişi, şablonlar, klasör ve üst belge, arşiv, ilişkiler, Dosya Ekleri, dışa aktarma) aynen. Wiki'de farklı olanlar:
  - Kayıt başlığındaki kapsam rozeti `Personal Wiki` (Proje adı yerine).
  - Proje gerektiren dönüşümler (Belgeden İş veya Teknik Diyagram dönüşümü) ve başlangıç iskeletleri görünmez.
  - Kayıt eylem menüsünde `Publish Wiki Document` vardır → `05.4 · Publish Wiki Document`; Belge yayımlanmışsa yerinde yayın satırı ve `Unpublish` → `05.5 · Unpublish`.
  - `Copy` hedefi olarak Aktif Proje seçilebilir; `Move` Wiki'den Projeye sunulmaz (Move yalnız Aktif Projeden başlar).
- **Label'lar:** `Personal Wiki`, `Publish Wiki Document`, `Unpublish`, `Copy`, `A newer Document version is available.`, `Reload latest version`, `Save`.

### Durumlar
#### Empty
Hiç Wiki Belgesi yokken ağaç boş, editör yerinde tek satır boşluk ve `Create Document` birincil kalır.
#### Loading
Ağaç ve editör yerinde iskelet satırlar.
#### Error
`Documents could not be loaded.`.
#### Create Document dialog open
→ `10.3 · Create Document`; Wiki farkı: Proje seçici yoktur, `Starter skeleton` seçeneği yoktur; seçilirse `Starter skeletons require a Project.`. Oluşan Belge doğrudan ağaçta seçili açılır.
#### Newer version available
Uzaktan kayıt sonrası editör üstünde `A newer Document version is available.`; yerel başlık, tür ve gövde korunur; `Save` devre dışı; `Reload latest version` açık eylem.
#### Archived
`Archived` açık; ağaç arşivli Belgeleri listeler; editör 10'daki arşiv bandıyla.
#### Published
Yayımlanmış Belgede kayıt başlığının altında sessiz yayın satırı: yayın tarihi, onaylanan sürüm, `noindex` bilgisi ve `Unpublish`. Canlı düzenleme yayına akmaz; satır bunu söyler.
#### Never published
Yayın satırı yoktur; ziyaretçi URL'si yoktur. Hiçbir yerde "public" ipucu görünmez.
#### Long content
Derin hiyerarşi ve uzun başlıklar: ağaç girintisi en çok birkaç seviye okunur kalır, başlık kırılır.

**Spec:** [32 Kişisel Wiki](../../specs/32-personal-wiki/spec.md) (sahip); [31 Belgeler](../../specs/31-documents/spec.md) (editör ve yetenekler); [72 Kişisel kabuk](../../specs/72-personal-shell/spec.md) (giriş); [74 Tekil Wiki Yayını](../../specs/74-wiki-publishing/spec.md) (yayın eylemi).

## 05.4 · Publish Wiki Document
> Tek bir Wiki Belgesini kapalı dünya önizlemesiyle, her gömüyü ayrı onaylayarak bağımsız herkese açık snapshot olarak yayımlamak.

**Artboard'lar**
- `05.4 · Publish Wiki Document · Default · 1440`
- `05.4 · Publish Wiki Document · Placeholders unresolved · 1440`
- `05.4 · Publish Wiki Document · Indexing enabled warning · 1440`
- `05.4 · Publish Wiki Document · Many embeds · 1440`

### Kök Belge
Geniş dialog veya yan sheet'in üstü: yayımlanacak Belge, kesin sürüm ve çıkacak alanlar; başlık ve isteğe bağlı açık özet.
- **Label'lar:** `Publish Wiki Document`, `Approved snapshot`.

### Gömüler ve üyeler
Kaydırılabilir üye listesi: satır içi referanslar, geri bağlantılar, Dosya Ekleri, çocuk Belgeler, canlı Akıllı Koleksiyon blokları, canlı içerik bölümleri ve diğer gömüler; her biri ayrı satır ve ayrı onay kutusu. Varsayılan seçili değildir.
- **Label'lar:** `Live external source` (dış gömü satırı); canlı blok satırı "tarih etiketli salt okunur snapshot olur" açıklamasıyla.

### Yer tutucular
Çözülmemiş `{{alan_adı}}` listesi; her biri yeriyle.
- **Label'lar:** `Publish/share anyway`.

### Görünürlük
Varsayılan `noindex` ve sitemap dışı; indeksleme ayrı açık anahtar ve uyarısı.

### Eylem satırı
Tek birincil yayın eylemi ve vazgeçme.
- **Label'lar:** `Publish Wiki Document`, `Cancel`.

### Durumlar
#### Default
Üyeler listelenmiş, hiçbiri seçili değil, yer tutucu yok.
#### Placeholders unresolved
Yer tutucu bölümü dolu; `Publish/share anyway` görünür.
#### Many embeds
Uzun üye listesi; tür başlıklarıyla gruplu, kaydırılır.
#### Published
Dialog kapanır; 05.1 `Published` durumu ve ziyaretçi sayfası → `19 · Public Surfaces` › yayımlanmış Wiki sayfası.
#### Error
Yayın başarısızsa dialog açık kalır, seçimler korunur; → `20.15 · Support Reference Error`.
#### Offline
Yayın çevrimiçi gerektirir → `20.16 · Offline`.

**Spec:** [74 Tekil Wiki Yayını](../../specs/74-wiki-publishing/spec.md) (sahip); [73 Bağlantı paylaşımı](../../specs/73-link-sharing/spec.md) (ortak önizleme, yer tutucu ve erişim adaptörü); [76 Dış yüzey yönetimi](../../specs/76-external-surface-management/spec.md) (sonuç listesi).

## 05.5 · Unpublish
> Yayımlanmış Wiki Belgesinin yeni HTML ve varlık erişimini cache'den önce kapatmak.

**Artboard'lar**
- `05.5 · Unpublish · Confirm · 1440`
- (yok)

### Onay
Küçük onay dialog'u; ne olacağını anlatan kısa metin: yeni erişim hemen durur, cache temizliği başlar, URL yeniden kullanılmaz, ziyaretçi `410 Gone` görür; canlı Wiki Belgesi ve geçmişi silinmez.
- **Label'lar:** `Unpublish`, `Cancel`.

### Durumlar
#### Unpublished
05.1'deki yayın satırı kalkar; Belge "Never published" gibi görünür ama geçmiş yayın `Shares and Publications` listesinde kalır (→ `02 · Workspace`). Ziyaretçi tarafı → `19 · Public Surfaces` › `410 Gone`.

**Spec:** [74 Tekil Wiki Yayını](../../specs/74-wiki-publishing/spec.md); [76 Dış yüzey yönetimi](../../specs/76-external-surface-management/spec.md) (`Revoke / Unpublish` aynı eylem).
