# 18 · GitHub

Projenin `GitHub` alanı: GitHub App bağlantısı, repository ve otomasyon.

| Ekran | Ne çizilir |
|---|---|
| [18.1 · GitHub Connections](#181--github-connections) | Repository satırları ve eşitleme durumları |
| [18.2 · Connect Repository](#182--connect-repository) | İki adımlı App kurulum ve seçim dialog'u |
| [18.3 · First-connect Triage](#183--first-connect-triage) | Gruplu Issue listesi ve toplu önizleme |
| [18.4 · Disconnect Repository](#184--disconnect-repository) | Etki önizlemeli onay dialog'u |
| [18.5 · Reconnect Repository](#185--reconnect-repository) | Kimlik ve fark önizlemeli dialog |
| [18.6 · GitHub Records](#186--github-records) | Tür sekmeli dış kayıt tablosu |
| [18.7 · Pull Request · PR Context Card](#187--pull-request--pr-context-card) | Salt okunur PR detayı ve kart |
| [18.8 · Issue · Create Work and Link](#188--issue--create-work-and-link) | Issue → İş önizleme dialog'u |
| [18.9 · Work GitHub Links](#189--work-github-links) | İş detayında bağlı kayıtlar ve öneriler |

## 18.1 · GitHub Connections
> Proje'ye bağlı repository'leri bağlantı yaşamı, eşitleme durumu ve eylemleriyle göstermek.

**Artboard'lar**
- `18.1 · GitHub Connections · Default · 1440`
- `18.1 · GitHub Connections · Empty · 1440`
- `18.1 · GitHub Connections · No access · 1440`
- `18.1 · GitHub Connections · Paused · 1440`

### Alan başlığı
- **Label'lar:** `GitHub`, `GitHub App`, `Repository`; `Connect repository`, `GitHub records`.

### Repository satırı
Geniş satır: kimlik, eşitleme durumu, eylemler. İçerik: repository adı/sahibi (kimlik kararlı GitHub id; ad değişikliği geçmişte), yetkilendiren hesap/organizasyon, bağlantı yaşamı, son başarılı eşitleme, devam eden/son başarısız eşitleme, son hata açıklaması, rate-limit bekleme zamanı, yeniden yetkilendirme gereksinimi.
- **Label'lar:** `Connected`, `Paused`, `Disconnected`, `Out of date`, `Sync now`, `Reconnect`, `Disconnect`; `Last synced`, `Last error`, `Retry after`, `No access`, `Source not found`.

### İzin açıklaması
Sessiz tek blok: App'in yalnız okuma izinleri (`Metadata`, `Contents`, `Issues`, `Pull requests`, `Checks`, `Commit statuses`) ve `Contents`'in yalnız release/tag/commit çözümlemek için istendiği.

### Durumlar
#### Default
İki repository, biri `Out of date`.
#### Empty
Henüz repository yok: GitHub App'in GitHub login'den ayrı olduğu tek cümle + `Connect repository`.
#### Syncing
Satırda devam eden eşitleme metni; ikinci `Sync now` pasif.
#### Sync error
`Last error` açıklaması + `Retry after` zamanı; eski veri son eşitleme zamanıyla.
#### No access
App kaldırıldı veya erişim geri çekildi: `No access` nedeni, eşitleme durdu, `Reconnect`; Hesap oturumu etkilenmez (dördüncü yaşam durumu değil, neden metni).
#### Source not found
Repository silindi/taşındı: `Source not found`; otomatik başka repoya bağlanmaz.
#### Paused (archived project)
Proje arşivli: `Paused`, son veriler zamanıyla; arşivden çıkınca otomatik sürmez.
#### Disconnected
`Disconnected`; yakalanmış kayıtlar "no longer syncing" bilgisiyle kalır.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.2 · Connect Repository
> GitHub App'i kurup repository'leri kararlı kimlikle Proje'ye seçmek.

**Artboard'lar**
- `18.2 · Connect Repository · Install · 1440`
- `18.2 · Connect Repository · Select repositories · 1440`

### Adım 1 · GitHub App
Orta boy dialog'un ilk adımı: App'in login'den ayrı yetki olduğu; istenen okuma izinleri ve `Contents` gerekçesi; GitHub'a gidiş.
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
GitHub'dan dönüşte kurulum yok: neden + yeniden dene.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.3 · First-connect Triage
> İlk bağlantıda mevcut Issue'ları açıklanabilir GitHub alanlarıyla gruplayıp seçilenler için İş oluşturmayı topluca önizlemek; atlanabilir.

**Artboard'lar**
- `18.3 · First-connect Triage · Default · 1440`
- `18.3 · First-connect Triage · Default · 768`
- `18.3 · First-connect Triage · Preview · 1440`

### Gruplar
Sol dar sütun; yalnız GitHub alanlarıyla gruplama (açık/kapalı, son güncelleme, milestone, PR bağlantısı); AI yok.

### Issue listesi
Sağ geniş alan; her satır: başlık, numara, durum, label/milestone özeti, son güncelleme; seçim kutusu.

### Toplu önizleme
Alt çubuk: oluşacak İşler, aktarılacak alanlar, kurulacak kaynak bağlantıları.
- **Label'lar:** `Skip triage`, `Preview Work to create`.

### Durumlar
#### Default
Gruplar ve seçilebilir Issue listesi.
#### Preview
Seçili 3 Issue için oluşacak İş ve alan önizlemesi.
#### Skipped
Atlama sonrası 18.6'ya yönlendirme, hiçbir Issue İş olmadı bilgisi.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.4 · Disconnect Repository
> Bağlantıyı kaldırmadan önce etkilenecek repository ve kayıt bağlantılarını önizlemek.

**Artboard'lar**
- `18.4 · Disconnect Repository · Default · 1440`
- —

### Önizleme
Orta boy dialog: repository; etkilenecek İş–PR/Issue bağlantıları; yakalanmış kayıtların tarihsel kalacağı; yeni eşitlemenin duracağı ve secret'ın iptal edileceği.
- **Label'lar:** `Disconnect`.

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
Orta boy dialog; üstte kimlik, altta fark önizlemesi: kararlı repository kimliği; son yakalanan ve güncel durum; yetki; yeniden kurulamayan boşluklar (kaçan olaylar üretilmez).
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
- `18.6 · GitHub Records · Default · 768`
- `18.6 · GitHub Records · Out of date · 1440`

### Tür sekmeleri ve filtre
Üstte tür sekmeleri ve repository filtresi.
- **Label'lar:** GitHub kavram adları: issue, pull request, branch, commit, check, tag, Release; `Repository` filtresi; `GitHub external record`.

### Kayıt tablosu
Geniş tablo: başlık/ad, numara/SHA, GitHub durumu, bağlı İşler ve rolleri, son eşitleme.

### Durumlar
#### Default
Üç satırlı tablo.
#### Out of date
Üstte bağlantının güncel olmadığı ve son eşitleme zamanı; veri güncelmiş gibi sunulmaz.
#### Empty
Henüz yakalanan kayıt yok (ilk eşitleme devam ediyor).
#### Trashed record
Çöp Kutusundaki dış kayıt yeni kaynak durumu almaz; geri yüklemede fark açıkça uzlaştırılır.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.7 · Pull Request · PR Context Card
> Bağlı PR'ın salt okunur detayında ana kayıtlardan türetilen `PR Context Card`'ı göstermek; review ve merge için GitHub'a yönlendirmek.

**Artboard'lar**
- `18.7 · Pull Request · PR Context Card · Default · 1440`
- `18.7 · Pull Request · PR Context Card · Unlinked PR · 1440`

### PR başlığı
Üstte başlık, numara, açık/kapalı/merge durumu, branch, head SHA, son eşitleme; GitHub'da aç.

### PR Context Card
Sol geniş sütun: problem kaynağı, beklenen sonuç, ilgili Kararlar, açık Riskler, geri bildirimler, hedef Proje Sürümü, test kayıtları, bağlantının rolü; her madde asıl kayda açılır.
- **Label'lar:** `PR Context Card`, `Required for completion`, `Contextual`, `Expected Outcome`, `Open source record`.

### Check özeti
Sağ dar sütun: yalnız güncel head SHA'daki check'ler; sağlayıcı ve kararlı check kimliği; superseded sonuç güncel gösterilmez.
- **Label'lar:** `Required`, `Unknown`.

### Reviewer durumları
Sağ sütunda, veri varsa kompakt salt okunur liste.
- **Label'lar:** `Pending`, `Approved`, `Changes requested`, `Commented`.

### Durumlar
#### Default
Bağlı İşli PR, dolu kart.
#### Unlinked PR
Bağlı İş yok: kart bölümleri boş ve dürüst ("No linked Work"); `Notification Center`'da tek `unlinked-open-pr` sinyali (→ `00`).
#### Failed check
`github-check-failed` sinyalinin kaynağı; kart yalnız gösterir.
#### Completed Work with open PR
`work-pr-status-conflict` kaynağı nötr satır; İş durumu değişmez.
#### Out of date
Üstte son eşitleme zamanı ve güncel olmadığı.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)

## 18.8 · Issue · Create Work and Link
> Bağlı GitHub Issue'dan seçilen alanları önizleyerek bir defalık ana İş taslağı oluşturmak ve bağlamak.

**Artboard'lar**
- `18.8 · Issue · Create Work and Link · Default · 1440`
- —

### Alan seçimi ve önizleme
Orta boy dialog; Issue alanları, oluşacak İş önizlemesi: başlık, açıklama ve desteklenen kaynak alanları seçimi; oluşacak İş; köken ve canlı GitHub bağlantısı. Sürekli çift yönlü senkronizasyon kurulmadığı belirtilir.
- **Label'lar:** `Create work and link`.

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
İş detayında bölüm; her satır: tür, başlık/numara, GitHub durumu, rol, eşleşme kaynağı (hangi anahtar), kaldırma.
- **Label'lar:** `Required for completion`, `Contextual`.

### Öneriler
Bağlı kayıtların altında; eksik, birden çok veya proje dışı anahtar eşleşmeleri yalnız öneri.

### Bağlama dialog'u
Orta boy dialog: GitHub kaydı seçimi (relation picker deseni → `20`), rol seçimi.
- **Label'lar:** `Required for completion`, `Contextual`.

### Anahtar eşleşme kuralı
PR gövdesindeki benzersiz İş anahtarı ile `Fixes` / `Closes` / `Resolves` birlikte `Required for completion` üretir; diğer benzersiz eşleşmeler `Contextual` olur; eksik, çoklu veya Proje dışı anahtar yalnız öneri üretir. Bağlama İş durumunu, kapanışı veya blokajları değiştirmez.

### Durumlar
#### Default
İki bağlı kayıt ve bir öneri.
#### No links
Bağlı kayıt yok; açık seçim eylemi.
#### Repository disconnected
Bağlar "no longer syncing" bilgisiyle tarihsel.

**Spec:** [61 GitHub Bağlantısı ve Geliştirme Gerçeği](../../specs/61-github-integration/spec.md)
