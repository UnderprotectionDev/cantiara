# Hata Taksonomisi

| Kod | Belirti | Düzeltme |
|---|---|---|
| `SOURCE_AXIS_COLLISION` | Farklı kaynak eksenleri tek öncelik listesiyle eziliyor | Ürün, teknik, mimari, terminoloji ve mevcut-durum eksenlerini ayır |
| `FEATURE_IDENTITY_LOSS` | Ayrı feature'lar ortak çatı veya model altında kayboluyor | Feature kimliği, yolculuk ve kabul sonucunu anti-merge öncesi koru |
| `SCOPE_PRESSURE_DEMOTION` | Küçük veya alt fazsız bağımsız feature alt seviyeye düşüyor | Büyüklük eşiğini kaldır; Bağımsız Feature Kapısını tek zorunlu kapı yap |
| `SHARED_CRUD_CAPABILITY_LOSS` | Ortak CRUD/model ayrı feature'ları birleştiriyor | Teknik sinyalleri nötr say ve anti-merge kapısını üstün uygula |
| `ENTITY_OR_SURFACE_PHASE` | Entity, ekran veya route kendi kanıtı olmadan faz oluyor | Ayrı amaç, bütünlüklü sonuç ve kabul sınırı ara |
| `TECHNICAL_FOUNDATION_PROMOTION` | Provider, migration, tablo veya adapter ana faz oluyor | Yalnız bağımsız gözlenebilir ürün/sistem sonucunu faz yap |
| `CROSS_CUTTING_INFRASTRUCTURE` | Ortak helper/validasyon kesen feature sanılıyor | Ayrı yolculuk ve başarı sonucu yoksa sahip feature'lara dağıt |
| `LIFECYCLE_PROMOTION` | Create/edit/delete otomatik ana faz oluyor | Doğal feature sahibinde alt-faz kapısını uygula |
| `BROAD_SUBPHASE` | Alt faz birden fazla bağımsız amaç veya lifecycle sonucu taşıyor | Böl ve parçaları ana faz testine geri gönder |
| `MECHANICAL_SUBPHASE_TEMPLATE` | Her alt faz sabit auth/hata/recovery formunu tekrarlıyor | Maddi kuralları doğal akışa yedir; sabit alanları kaldır |
| `OPTIONAL_HARD_EDGE` | Opsiyonel metadata `allOf` olmuş | Minimum geçerli sonucu doğrula ve opsiyonel tut |
| `DISPLAY_ORDER_EDGE` | UI veya PRD sırası sert önkoşul sanılıyor | Somut tüketilen sonuç ve onsuz geçersizliği kanıtla |
| `PREVIEW_FINAL_DRIFT` | HTML ile final hiyerarşi veya adlar ayrışıyor | Aynı kanonik modelden üret ve publish öncesi ordered eşlik denetle |
| `PREVIEW_STATE_CREEP` | HTML onay, feedback veya kalıcı state taşıyor | HTML'yi salt okunur tut; kararı konuşmada yönet |
| `APPROVAL_REVISION_MISMATCH` | Yayın komutu açıkça onaylanan güncel preview revizyonuna bağlı değil | Final staging'i onaydan sonra hazırla ve onaylanan revizyonu publisher'a zorunlu argüman olarak ver |
| `STALE_PREVIEW` | Kaynak değiştiği hâlde eski HTML kullanılıyor | Kaynak hash'lerini doğrula ve yeni açık onay al |
| `DESTRUCTIVE_PUBLISH` | Yeni set hazır olmadan eski set siliniyor | Staging'i bütünüyle doğrula; transaction/rollback kullan |
| `UNKNOWN_OUTPUT_OWNERSHIP` | Marker’sız mevcut dizin skill çıktısı varsayılıyor | Sahiplik kanıtı yoksa fail closed çalış ve üzerine yazma |
| `UNNECESSARY_QUESTION` | Kaynaklardan çözülebilen gerçek kullanıcıya soruluyor | Yalnız maddi aynı-eksen belirsizliğini sor |
