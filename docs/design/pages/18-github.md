# 18 · GitHub

Projenin `GitHub` alanı: GitHub App bağlantısı, repository'ler ve salt okunur GitHub dış kayıtları. Hazır `When required PRs merge, mark Work Completed` kuralı → `08.23`; kural kapalıyken İş detayındaki `Mark as Completed` önerisi → `09.10`. Bu sayfa İşi kapatmaz.

| Ekran | Ne çizilir |
|---|---|
| [18.1 · GitHub Connections](#181--github-connections) | repository satırları ve eşitleme durumları |
| [18.2 · Connect Repository](#182--connect-repository) | iki adımlı App kurulum ve seçim dialog'u |
| [18.3 · First-connect Triage](#183--first-connect-triage) | gruplu Issue listesi ve toplu önizleme |
| [18.4 · Disconnect Repository](#184--disconnect-repository) | etki önizlemeli onay dialog'u |
| [18.5 · Reconnect Repository](#185--reconnect-repository) | kimlik ve fark önizlemeli dialog |
| [18.6 · GitHub Records](#186--github-records) | tür sekmeli dış kayıt tablosu |
| [18.7 · Pull Request · PR Context Card](#187--pull-request--pr-context-card) | salt okunur PR detayı ve kart |
| [18.8 · Issue · Create Work and Link](#188--issue--create-work-and-link) | Issue → İş önizleme dialog'u |
| [18.9 · Work GitHub Links](#189--work-github-links) | İş detayında bağlı kayıtlar ve öneriler |

## 18.1 · GitHub Connections
> Proje'ye bağlı repository'leri bağlantı yaşamı, eşitleme durumu ve eylemleriyle göstermek.

**Artboard'lar**
- `18.1 · GitHub Connections · Default · 1440`
- `18.1 · GitHub Connections · No access · 1440`
- `18.1 · GitHub Connections · Paused · 1440`

### Alan başlığı
Başlık iskeleti → DS.10 (Area).
- **Label'lar:** `GitHub`, `GitHub App`, `Repository`; `Connect repository`, `GitHub records`.

### Repository satırı
Kimlik, eşitleme durumu, eylemler. İçerik: repository adı/sahibi (kimlik kararlı GitHub id; ad değişikliği geçmişte), yetkilendiren hesap/organizasyon, bağlantı yaşamı, son başarılı eşitleme, devam eden/son başarısız eşitleme, son hata açıklaması, rate-limit bekleme zamanı (`Retry-After`'a uyulur), yeniden yetkilendirme gereksinimi. Yaşam durumu yalnız `Connected` / `Paused` / `Disconnected`'tır; `No access`, `Source not found` ve App kaldırma yaşam durumu değil, `Disconnected` nedenidir; Proje arşivi `Paused` nedenidir (CONTEXT.md › GitHub bağlantısı).
- **Label'lar:** `Connected`, `Paused`, `Disconnected`, `Out of date`, `Sync now`, `Reconnect`, `Disconnect`; `Last synced`, `Last error`, `Retry after`, `No access`, `Source not found`.

### İzin açıklaması
Sessiz tek blok: App'in yalnız okuma izinleri olduğu ve `Contents`'in gerekçesi; izin listesi ve metin `18.2 · Adım 1 · GitHub App`'tedir, burada yeniden yazılmaz.

### Durumlar
#### Default
İki tidekit repository'si, biri `Out of date` (son başarılı eşitlemeden 30 dakika sonra).
#### Empty
Henüz repository yok: GitHub App'in GitHub login'den ayrı olduğu tek cümle + `Connect repository`.
#### Syncing
Satırda devam eden eşitleme metni; ikinci `Sync now` pasif.
#### Sync error
`Last error` açıklaması + `Retry after` zamanı; eski veri son eşitleme zamanıyla.
#### No access
App kaldırıldı veya erişim geri çekildi: durum `Disconnected`, neden `No access`; eşitleme durdu, `Reconnect`. Hesap kimliği ve ürün oturumları etkilenmez.
#### Login revoked
GitHub login OAuth iznini geri çekmek App installation'ını kaldırmaz: satır `Connected` kalır, tarihsel GitHub dış kayıtları korunur (oturum tarafı → spec 01). Ayrı artboard çizilmez.
#### Source not found
Repository silindi/taşındı: durum `Disconnected`, neden `Source not found`; otomatik başka repoya bağlanmaz.
#### Paused (archived project)
Proje arşivli: `Paused`, son veriler zamanıyla; arşivden çıkınca otomatik sürmez (bant ve uyarı `20.21`, yeniden bağlama akışı `18.5`).
#### Disconnected
`Disconnected`; yakalanmış kayıtlar tarihsel kalır ve artık eşitlenmediği bilgisiyle gösterilir (bu anlamın sahibi burasıdır; `18.4` ve `18.9` bağlanır).
- **Label'lar:** `Captured records stay as history and no longer sync.`

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.2 · Connect Repository
> GitHub App'i kurup repository'leri kararlı kimlikle Proje'ye seçmek.

**Artboard'lar**
- `18.2 · Connect Repository · Install · 1440`
- `18.2 · Connect Repository · Select repositories · 1440`

### Adım 1 · GitHub App
Dialog'un ilk adımı: App'in login'den ayrı yetki olduğu; istenen yalnız okuma izinleri (`Metadata`, `Contents`, `Issues`, `Pull requests`, `Checks`, `Commit statuses`) ve `Contents`'in yalnız release/tag/commit çözümlemek için istendiği; GitHub'a gidiş. İzin adları GitHub'ın kendi adlarıdır, ürün label'ı değildir.
- **Label'lar:** `GitHub App`; `Install GitHub App`.

### Adım 2 · Repository seçimi
Installation'ın erişebildiği repository listesi; seçim kutuları; zaten bağlı olanlar işaretli.
- **Label'lar:** `Repository`; `Connect selected repositories`.

### Durumlar
#### Install
Adım 1: izin açıklaması ve `Install GitHub App`.
#### Select repositories
Adım 2: seçim kutulu repository listesi ve `Connect selected repositories`.
#### Installation canceled
GitHub'dan dönüşte kurulum yok: neden + `Retry`.
- **Label'lar:** `The GitHub App installation was not completed.`, `Retry`.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.3 · First-connect Triage
> İlk bağlantıda mevcut Issue'ları açıklanabilir GitHub alanlarıyla gruplayıp seçilenler için İş oluşturmayı topluca önizlemek; atlanabilir.

**Artboard'lar**
- `18.3 · First-connect Triage · Default · 1440`
- `18.3 · First-connect Triage · Preview · 1440`

### Gruplar
Yalnız GitHub alanlarıyla gruplama (açık/kapalı, son güncelleme, milestone, PR bağlantısı); AI yok.

### Issue listesi
Her satır: başlık, numara, durum, label/milestone özeti, son güncelleme; seçim kutusu.

### Toplu önizleme
Oluşacak İşler, aktarılacak alanlar, kurulacak kaynak bağlantıları. Onaydan önce hiçbir Issue İş olmaz.
- **Label'lar:** `Skip triage`, `Preview Work to create`, `Create selected Work` (önizlemeyi onaylayan eylem).

### Durumlar
#### Default
Gruplar ve seçilebilir Issue listesi.
#### Preview
Seçili 3 Issue için oluşacak İş ve alan önizlemesi.
#### Skipped
Atlama sonrası `18.6 · GitHub Records`'a yönlendirme, hiçbir Issue İş olmadı bilgisi; atlanan Issue'lar aranabilir GitHub dış kaydı olarak kalır.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.4 · Disconnect Repository
> Bağlantıyı kaldırmadan önce etkilenecek repository ve kayıt bağlantılarını önizlemek.

**Artboard'lar**
- `18.4 · Disconnect Repository · Default · 1440`

### Önizleme
Repository; etkilenecek İş–PR/Issue bağlantıları; yeni eşitlemenin duracağı ve secret'ın iptal edileceği; yakalanmış kayıtların durumu `18.1 · Disconnected`'tadır, burada yeniden yazılmaz.
- **Label'lar:** `Disconnect`, `Cancel`.

### Durumlar
#### Default
Etki önizlemesi ve onay.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.5 · Reconnect Repository
> Erişim kaybı veya Proje arşivden çıkışı sonrası aynı kararlı repository kimliğini açıkça yeniden bağlamak ve farkı uzlaştırmak.

**Artboard'lar**
- `18.5 · Reconnect Repository · After unarchive · 1440`
- `18.5 · Reconnect Repository · Verification failed · 1440`

### Kimlik ve fark
Kimlik ve fark önizlemesi: kararlı repository kimliği; son yakalanan ve güncel durum; yetki; yeniden kurulamayan boşluklar (kaçan olaylar üretilmez).
- **Label'lar:** `Reconnect`.

### Durumlar
#### After unarchive
Proje arşivden çıktı; kimlik ve fark önizlemesi, `Reconnect`.
#### Verification failed
Doğrulama başarısız: Proje etkin, bağlantı `Disconnected` kalır.
#### Different repository
Farklı kararlı kimlik yeni bağlantıdır; ada göre eşleme yapılmadığı açıklanır.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.6 · GitHub Records
> Bağlı repository'lerden yakalanan salt okunur GitHub dış kayıtlarını tür, durum ve bağlantı bilgisiyle gezmek.

**Artboard'lar**
- `18.6 · GitHub Records · Default · 1440`
- `18.6 · GitHub Records · Out of date · 1440`

### Tür sekmeleri ve filtre
Tür sekmeleri ve repository filtresi.
- **Label'lar:** `Repository` filtresi; `GitHub external record`; sekmeler `Issue`, `Pull request`, `Branch`, `Commit`, `Check`, `Git tag`, `GitHub Release`.

### Kayıt tablosu
Başlık/ad, numara/SHA, GitHub durumu, bağlı İşler ve rolleri, son eşitleme. Satır eylemleri kaydı yerel yaşam durumlarına geçirir ve geri getirir; kayıt kaynak GitHub'da değişmez.
- **Label'lar:** `Archive`, `Move to Trash` (ortak kayıt eylemleri → `design-system.md` `DS.11 · Record Header`, onay `20.2`), `Restore` (Çöp Kutusu geri yüklemesi → `02.11`), `Permanently Delete` (→ `20.3`). Tombstone satırında `Re-include`.

### Durumlar
#### Default
Üç satırlı tablo.
#### Out of date
`Out of date` ve son eşitleme zamanı; veri güncelmiş gibi sunulmaz.
#### Empty
Henüz yakalanan kayıt yok (ilk eşitleme devam ediyor).
#### Archived record
Yerelde arşivlenen GitHub dış kaydı, Proje bağı sağlıklı olduğu sürece kaynak güncellemelerini almaya devam eder.
#### Trashed record
Çöp Kutusundaki dış kayıt yeni kaynak durumu almaz; geri yüklemede fark açıkça uzlaştırılır.
#### Tombstone
Kalıcı silinen dış kayıt içeriksiz tombstone bırakır; sonraki webhook aynı ürün kimliğini diriltmez. Açıkça yeniden dahil etme yeni kimlik ve görünür köken üretir.
#### Re-include
Tombstone satırında `Re-include` önizleme açar: `Re-including creates a new record. It originates from the deleted GitHub record and is not the same identity.`; onay `Confirm re-include`.
#### Restore reconcile
Çöpten `Restore` sonrası fark önizlemesi: `Restoring syncs the record with GitHub now. Review the difference.`

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.7 · Pull Request · PR Context Card
> Bağlı PR'ın salt okunur detayında ana kayıtlardan türetilen `PR Context Card`'ı göstermek; review ve merge için GitHub'a yönlendirmek.

**Artboard'lar**
- `18.7 · Pull Request · PR Context Card · Default · 1440`
- `18.7 · Pull Request · PR Context Card · Unlinked PR · 1440`

### PR başlığı
Başlık, numara, açık/kapalı/merge durumu, branch, head SHA, son eşitleme; GitHub'a geçiş eylemi (yeni sekme). Kartta review, merge veya eksik bağı doldurarak PR'ı hazır ilan eden yazma eylemi yoktur. Kartta İncelemenin ve merge'in GitHub'da yapıldığı yazılır.
- **Label'lar:** `Open on GitHub`; `Review and merge happen on GitHub.`

### PR Context Card
Problem kaynağı, beklenen sonuç, ilgili Kararlar, açık Riskler, geri bildirimler, hedef Proje Sürümü, test kayıtları, bağlantının rolü; her madde asıl kayda açılır. Kart `Work Context Card` veya bağlam önizleme editörü değildir (spec 61 #16).
Bağlantı rolünün sahibi burasıdır (tür çifti kataloğu `20.10`): `Required for completion` PR'ın İşi tamamlamak için gerekli olduğunu, `Contextual` yalnız bağlam verdiğini söyler; İş durumunu, kapanışı veya blokajı değiştirmez. `18.9` ve `16.5` yalnız referans verir.
- **Label'lar:** `PR Context Card`, `Required for completion`, `Contextual`, `Expected Outcome`, `Open source record`.

### Check özeti
Yalnız güncel head SHA'daki check'ler; sağlayıcı ve kararlı check kimliği; superseded sonuç güncel gösterilmez. `Required` yalnız GitHub öyle diyorsa, aksi `Unknown`. Check Test Oturumuna dönüşmez.
- **Label'lar:** `Required`, `Unknown`.

### Reviewer durumları
Veri varsa kompakt salt okunur liste.
- **Label'lar:** `Pending`, `Approved`, `Changes requested`, `Commented`.

### Durumlar
#### Default
Bağlı İşli PR, dolu kart.
#### Unlinked PR
Bağlı İş yok: kart bölümleri boş ve dürüst (`No linked Work`); `Notification Center`'da tek, kapatılabilir `unlinked-open-pr` sinyali (→ `00.5`). Ayrı bir "Unlinked PR" kaydı oluşmaz.
#### Failed check
`github-check-failed` sinyalinin kaynağı; kart yalnız gösterir. Başarısız check İşi yeniden açmaz.
#### Completed Work with open PR
`work-pr-status-conflict` kaynağı nötr satır; İş durumu değişmez.
#### Out of date
`Out of date` ve son eşitleme zamanı.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.8 · Issue · Create Work and Link
> Bağlı GitHub Issue'dan seçilen alanları önizleyerek bir defalık ana İş taslağı oluşturmak ve bağlamak.

**Artboard'lar**
- `18.8 · Issue · Create Work and Link · Default · 1440`

### Alan seçimi ve önizleme
Giriş `18.6`'daki issue satırından. Issue alanları, oluşacak İş önizlemesi: başlık, açıklama ve desteklenen kaynak alanları seçimi; oluşacak İş; köken ve canlı GitHub bağlantısı. Sürekli çift yönlü senkronizasyon kurulmadığı belirtilir.
- **Label'lar:** `Create work and link`, `Cancel`.

### Durumlar
#### Default
Alanlar seçili, önizleme dolu.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.9 · Work GitHub Links
> İş detayında bağlı Issue/PR/branch/commit kayıtlarını rolleriyle göstermek, açık seçimle bağlamak ve önerileri yönetmek; bağlantı İş durumunu değiştirmez.

**Artboard'lar**
- `18.9 · Work GitHub Links · Default · 1440`
- `18.9 · Work GitHub Links · No links · 1440`

### Bağlı kayıtlar
İş detayında bölüm; her satır: tür, başlık/numara, GitHub durumu, rol, eşleşme kaynağı (hangi anahtar), kaldırma. Rol label'ları ve anlamı → `18.7 · PR Context Card`.

### Öneriler
Bağlı kayıtların altında; eksik, birden çok veya proje dışı anahtar eşleşmeleri yalnız öneri. Her öneri satırı rolü seçerek bağlar ya da öneriyi kapatır; eylem İş durumunu değiştirmez.
- **Label'lar:** `Link as Required for completion`, `Link as Contextual`, `Dismiss suggestion`.

### Bağlama dialog'u
GitHub kaydı seçimi (relation picker deseni → `20.10`), rol seçimi. Dialog'u bağlı kayıtlar bölümündeki açılış eylemi açar; bağlı satırda kaldırma eylemi vardır.
- **Label'lar:** rol label'ları → `18.7`; `Link GitHub record`, `Unlink GitHub record` (bağlı satırdaki kaldırma eylemi; `Remove link` Belge metni bağlantısı için ayrıdır).

### Anahtar eşleşme kuralı
PR gövdesindeki benzersiz İş anahtarı ile `Fixes` / `Closes` / `Resolves` birlikte `Required for completion` üretir; diğer benzersiz eşleşmeler `Contextual` olur; eksik, çoklu veya Proje dışı anahtar yalnız öneri üretir. Bağlama İş durumunu, kapanışı veya blokajları değiştirmez.

### Durumlar
#### Default
İki bağlı kayıt ve bir öneri.
#### No links
Bağlı kayıt yok; açık seçim eylemi (`Link GitHub record`).
#### Repository disconnected
Bağlar tarihsel; artık eşitlenmediği bilgisi `18.1 · Disconnected` ile aynıdır.
#### All required PRs merged
Kural kapalıyken aynı koşul yalnız `Mark as Completed` önerisi üretir; önerinin yeri ve kapanış akışı → `09.10` (kural → `08.23`). Bu bölüm İş durumunu yazmaz. Ayrı artboard çizilmez.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md), [62 Hafif İş Otomasyonları](../../specs/62-work-automation/spec.md) (`Mark as Completed` önerisi; sahibi `08.23`, `09.10`)
